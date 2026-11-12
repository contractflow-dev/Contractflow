import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EContractStatus,
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { CompanyUser } from '../../entities/company-user.entity';
import { CompanyInvitationRepository } from '../../repositories/company-invitation.repository';
import { ContractPartyRepository } from '../../../contract/repositories/contract-party.repository';
import type { DashboardContractRow } from '../../../contract/interfaces/dashboard-contract-row.interface';
import { CompanyResponseDto } from '../../dto/company/responses/company-response.dto';
import { CreateCompanyRequestDto } from '../../dto/company/requests/create-company-request.dto';
import { CompanyUserRepository } from '../../repositories/company-user.respository';
import { CompanyVerificationService } from './company-verification.service';
import {
  COMPANY_CREATION_UNIT_OF_WORK,
  type ICompanyCreationUnitOfWork,
} from '../../interface/company-creation-persistence.interface';

import type {
  ICompanyAccessResponse,
  ICompanyAccessSummaryResponse,
  ICompanyDashboardContractResponse,
  ICompanyDashboardResponse,
  ICompanyMembershipResponse,
  ICompanyProfileResponse,
} from '@contractflow/contracts-schema';

const COMPANY_DASHBOARD_RECENT_WINDOW_DAYS = 30;
const COMPANY_DASHBOARD_CONTRACT_LIMIT = 5;
/** An active contract with no recorded change for this long is stalled. */
const COMPANY_DASHBOARD_STALLED_AFTER_DAYS = 14;
/** Finance looks this far ahead for invoices falling due. */
const COMPANY_DASHBOARD_DUE_WINDOW_DAYS = 30;

@Injectable()
export class CompanyService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(COMPANY_CREATION_UNIT_OF_WORK)
    private readonly companyCreation: ICompanyCreationUnitOfWork,
    private readonly companyUserRepository: CompanyUserRepository,
    private readonly invitationRepository: CompanyInvitationRepository,
    private readonly contractPartyRepository: ContractPartyRepository,
    private readonly companyVerification: CompanyVerificationService,
  ) {}

  async create(
    userId: string,
    dto: CreateCompanyRequestDto,
  ): Promise<ICompanyAccessResponse> {
    const result = await this.companyCreation.execute(async (context) => {
      const user = await context.findUserById(userId);

      if (!user) {
        throw new UnauthorizedException('Authentication required.');
      }

      if (user.status !== EUserStatus.ACTIVE || !user.emailVerifiedAt) {
        throw new ForbiddenException(
          'Only verified, active accounts can create companies.',
        );
      }

      const savedCompany = await context.createCompany({
        ...dto,
        registrationNumber: dto.registrationNumber ?? '',
        taxIdentificationNumber: dto.taxIdentificationNumber ?? '',
        website: dto.website ?? '',
        addressLine2: dto.addressLine2 ?? '',
        status: ECompanyStatus.ACTIVE,
        verifiedAt: null,
      });

      const savedMembership = await context.createMembership({
        companyId: savedCompany.id,
        userId: user.id,
        companyRole: ECompanyRole.COMPANY_ADMIN,
        jobTitle: 'Company Administrator',
        status: ECompanyUserStatus.ACTIVE,
        joinedAt: new Date(),
        leftAt: null,
      });

      return {
        company: savedCompany,
        membership: savedMembership,
      };
    });

    await this.companyVerification.sendAfterEmailChange(result.company.id);

    return {
      company: CompanyResponseDto.fromEntity(result.company),
      membership: this.mapMembership(result.membership),
    };
  }

  async listForUser(userId: string): Promise<ICompanyAccessResponse[]> {
    const memberships =
      await this.companyUserRepository.findActiveMembershipsForUser(userId);

    return memberships
      .filter(
        (membership) => membership.company.status === ECompanyStatus.ACTIVE,
      )
      .map((membership) => ({
        company: CompanyResponseDto.fromEntity(membership.company),
        membership: this.mapMembership(membership),
      }));
  }

  async getAccessSummary(
    userId: string,
  ): Promise<ICompanyAccessSummaryResponse> {
    const memberships =
      await this.companyUserRepository.findAllMembershipsForUser(userId);
    const summary: ICompanyAccessSummaryResponse = {
      activeCompanyCount: 0,
      hasEndedMembership: false,
      hasInactiveCompanyMembership: false,
    };

    for (const membership of memberships) {
      // Same definition of "active" as findActiveMembershipsForUser.
      if (
        membership.status !== ECompanyUserStatus.ACTIVE ||
        membership.leftAt !== null
      ) {
        summary.hasEndedMembership = true;
      } else if (membership.company?.status === ECompanyStatus.ACTIVE) {
        summary.activeCompanyCount += 1;
      } else {
        summary.hasInactiveCompanyMembership = true;
      }
    }

    return summary;
  }

  async getCurrent(userId: string): Promise<ICompanyProfileResponse> {
    const membership =
      await this.companyUserRepository.findCurrentMembershipWithCompany(userId);

    if (
      !membership?.company ||
      membership.company.status !== ECompanyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Active company membership is required');
    }

    return CompanyResponseDto.fromEntity(membership.company);
  }

  async getMembership(
    userId: string,
    companyId: string,
  ): Promise<ICompanyAccessResponse> {
    const membership =
      await this.companyUserRepository.findActiveMembershipWithCompany(
        userId,
        companyId,
      );

    if (
      !membership?.company ||
      membership.company.status !== ECompanyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Active company membership is required.');
    }

    return {
      company: CompanyResponseDto.fromEntity(membership.company),
      membership: this.mapMembership(membership),
    };
  }

  async getDashboard(
    userId: string,
    companyId: string,
  ): Promise<ICompanyDashboardResponse> {
    const membership =
      await this.companyUserRepository.findActiveMembershipWithCompany(
        userId,
        companyId,
      );

    if (
      !membership?.company ||
      membership.company.status !== ECompanyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Active company membership is required.');
    }

    if (membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can access dashboard data.',
      );
    }

    const activeMembershipCount =
      await this.companyUserRepository.countActiveMembers(companyId);

    const pendingInvitationCount = await this.invitationRepository.countPending(
      { companyId },
    );

    const [totalContractCount, activeContractCount] = await Promise.all([
      this.contractPartyRepository.countCompanyContracts(companyId),
      this.contractPartyRepository.countCompanyContracts(
        companyId,
        EContractStatus.ACTIVE,
      ),
    ]);
    const expiryWindowDays = this.configService.get<number>(
      'COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS',
      30,
    );
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const expiryLimit = new Date(today);
    expiryLimit.setUTCDate(expiryLimit.getUTCDate() + expiryWindowDays);
    const todayDate = today.toISOString().slice(0, 10);
    const expiryDate = expiryLimit.toISOString().slice(0, 10);
    const [expiringContractCount, expiringContracts] = await Promise.all([
      this.contractPartyRepository.countExpiringCompanyContracts(
        companyId,
        todayDate,
        expiryDate,
      ),
      this.contractPartyRepository
        .findExpiringCompanyContracts(
          companyId,
          todayDate,
          expiryDate,
          COMPANY_DASHBOARD_CONTRACT_LIMIT,
        )
        .then((rows) => rows.map(mapDashboardContract)),
    ]);
    const dueLimit = new Date(today);
    dueLimit.setUTCDate(
      dueLimit.getUTCDate() + COMPANY_DASHBOARD_DUE_WINDOW_DAYS,
    );
    const portfolio =
      await this.contractPartyRepository.getCompanyPortfolioCounts(companyId, {
        stalledBefore: new Date(
          now.getTime() - COMPANY_DASHBOARD_STALLED_AFTER_DAYS * 86400000,
        ),
        today: todayDate,
        expiryLimit: expiryDate,
        dueLimit: dueLimit.toISOString().slice(0, 10),
      });
    const recentlyUpdatedContracts = (
      await this.contractPartyRepository.findRecentlyUpdatedCompanyContracts(
        companyId,
        new Date(
          now.getTime() - COMPANY_DASHBOARD_RECENT_WINDOW_DAYS * 86400000,
        ),
        COMPANY_DASHBOARD_CONTRACT_LIMIT,
      )
    ).map(mapDashboardContract);

    return {
      company: CompanyResponseDto.fromEntity(membership.company),
      membership: this.mapMembership(membership),
      summary: {
        activeMembershipCount,
        pendingInvitationCount,
        totalContractCount,
        activeContractCount,
        expiringContractCount,
      },
      expiryWindowDays,
      portfolioHealth: {
        stalledAfterDays: COMPANY_DASHBOARD_STALLED_AFTER_DAYS,
        stalledContractCount: portfolio.stalledContractCount,
        nonCompliantContractorCount: portfolio.nonCompliantContractorCount,
        overduePaymentCount: portfolio.overduePaymentCount,
      },
      departments: {
        complianceAttentionCount: portfolio.complianceAttentionCount,
        contractsNeedingAttentionCount:
          portfolio.contractsNeedingAttentionCount,
        openIncidentCount: portfolio.openIncidentCount,
        invoicesDueSoonCount: portfolio.invoicesDueSoonCount,
        dueWindowDays: COMPANY_DASHBOARD_DUE_WINDOW_DAYS,
      },
      expiringContracts,
      recentlyUpdatedContracts,
    };
  }

  private mapMembership(membership: CompanyUser): ICompanyMembershipResponse {
    return {
      id: membership.id,
      companyId: membership.companyId,
      companyRole: membership.companyRole,
      status: membership.status,
      canManageCompany: membership.companyRole === ECompanyRole.COMPANY_ADMIN,
    };
  }
}

function mapDashboardContract(
  row: DashboardContractRow,
): ICompanyDashboardContractResponse {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    title: row.title,
    status: row.status,
    endDate: toDateOnly(row.endDate),
    updatedAt: toISOString(row.updatedAt),
  };
}

function toDateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

function toISOString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
