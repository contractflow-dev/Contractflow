import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  EContractStatus,
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyInvitationRepository } from '../repositories/company-invitation.repository';
import { Contract } from '../../contract/entities/contract.entity';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { CompanyResponseDto } from '../dto/company/responses/company-response.dto';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';

import type {
  ICompanyAccessResponse,
  ICompanyDashboardContractResponse,
  ICompanyDashboardResponse,
  ICompanyMembershipResponse,
  ICompanyProfileResponse,
} from '@contractflow/contracts-schema';

const COMPANY_DASHBOARD_RECENT_WINDOW_DAYS = 30;
const COMPANY_DASHBOARD_CONTRACT_LIMIT = 5;

interface DashboardContractRow {
  id: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  endDate: Date | string | null;
  updatedAt: Date | string;
}

@Injectable()
export class CompanyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,
    private readonly invitationRepository: CompanyInvitationRepository,
    @InjectRepository(ContractParty)
    private readonly contractPartyRepository: Repository<ContractParty>,
  ) {}

  async create(
    userId: string,
    dto: CreateCompanyRequestDto,
  ): Promise<ICompanyAccessResponse> {
    const result = await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(AppUser);
      const user = await users.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('Authentication required.');
      }

      if (user.status !== EUserStatus.ACTIVE || !user.emailVerifiedAt) {
        throw new ForbiddenException(
          'Only verified, active accounts can create companies.',
        );
      }

      const companyRepository = manager.getRepository(Company);
      const savedCompany = await companyRepository.save(
        companyRepository.create({
          ...dto,
          website: dto.website ?? '',
          addressLine2: dto.addressLine2 ?? '',
          status: ECompanyStatus.ACTIVE,
        }),
      );

      const membershipRepository = manager.getRepository(CompanyUser);
      const savedMembership = await membershipRepository.save(
        membershipRepository.create({
          companyId: savedCompany.id,
          userId: user.id,
          companyRole: ECompanyRole.COMPANY_ADMIN,
          jobTitle: 'Company Administrator',
          status: ECompanyUserStatus.ACTIVE,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );

      return {
        company: savedCompany,
        membership: savedMembership,
      };
    });

    return {
      company: CompanyResponseDto.fromEntity(result.company),
      membership: this.mapMembership(result.membership),
    };
  }

  async listForUser(userId: string): Promise<ICompanyAccessResponse[]> {
    const memberships = await this.companyUserRepository.find({
      where: {
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      order: { joinedAt: 'DESC' },
      relations: { company: true },
    });

    return memberships.map((membership) => ({
      company: CompanyResponseDto.fromEntity(membership.company),
      membership: this.mapMembership(membership),
    }));
  }

  async getCurrent(userId: string): Promise<ICompanyProfileResponse> {
    const membership = await this.companyUserRepository.findOne({
      where: {
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      order: { joinedAt: 'DESC' },
      relations: { company: true },
    });

    if (!membership?.company) {
      throw new ForbiddenException('Active company membership is required');
    }

    return CompanyResponseDto.fromEntity(membership.company);
  }

  async getMembership(
    userId: string,
    companyId: string,
  ): Promise<ICompanyAccessResponse> {
    const membership = await this.companyUserRepository.findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      relations: { company: true },
    });

    if (!membership?.company) {
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
    const membership = await this.companyUserRepository.findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      relations: { company: true },
    });

    if (!membership?.company) {
      throw new ForbiddenException('Active company membership is required.');
    }

    if (membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can access dashboard data.',
      );
    }

    const activeMembershipCount = await this.companyUserRepository.count({
      where: {
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });

    const pendingInvitationCount = await this.invitationRepository.countPending(
      { companyId },
    );

    const [totalContractCount, activeContractCount] = await Promise.all([
      this.countCompanyContracts(companyId),
      this.countCompanyContracts(companyId, EContractStatus.ACTIVE),
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
      this.countExpiringCompanyContracts(companyId, todayDate, expiryDate),
      this.findExpiringContracts(companyId, todayDate, expiryDate),
    ]);
    const recentlyUpdatedContracts = await this.findRecentlyUpdatedContracts(
      companyId,
      new Date(now.getTime() - COMPANY_DASHBOARD_RECENT_WINDOW_DAYS * 86400000),
    );

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
      expiringContracts,
      recentlyUpdatedContracts,
    };
  }

  private async countCompanyContracts(
    companyId: string,
    status?: EContractStatus,
  ): Promise<number> {
    const query = this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .select('COUNT(DISTINCT contract.id)', 'count')
      .where('party.companyId = :companyId', { companyId });
    if (status) {
      query.andWhere('contract.status = :status', { status });
    }
    const result = await query.getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
  }

  private async countExpiringCompanyContracts(
    companyId: string,
    today: string,
    expiryLimit: string,
  ): Promise<number> {
    const result = await this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .select('COUNT(DISTINCT contract.id)', 'count')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :today AND :expiryLimit',
        { today, expiryLimit },
      )
      .getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
  }

  private async findExpiringContracts(
    companyId: string,
    today: string,
    expiryLimit: string,
  ): Promise<ICompanyDashboardContractResponse[]> {
    const rows = await this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .distinct(true)
      .select('contract.id', 'id')
      .addSelect('contract.referenceNumber', 'referenceNumber')
      .addSelect('contract.title', 'title')
      .addSelect('contract.status', 'status')
      .addSelect(
        'COALESCE(contract.revisedEndDate, contract.endDate)',
        'endDate',
      )
      .addSelect('contract.updatedAt', 'updatedAt')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :today AND :expiryLimit',
        { today, expiryLimit },
      )
      .orderBy('COALESCE(contract.revisedEndDate, contract.endDate)', 'ASC')
      .addOrderBy('contract.id', 'ASC')
      .take(COMPANY_DASHBOARD_CONTRACT_LIMIT)
      .getRawMany<DashboardContractRow>();

    return rows.map(mapDashboardContract);
  }

  private async findRecentlyUpdatedContracts(
    companyId: string,
    updatedSince: Date,
  ): Promise<ICompanyDashboardContractResponse[]> {
    const rows = await this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .distinct(true)
      .select('contract.id', 'id')
      .addSelect('contract.referenceNumber', 'referenceNumber')
      .addSelect('contract.title', 'title')
      .addSelect('contract.status', 'status')
      .addSelect(
        'COALESCE(contract.revisedEndDate, contract.endDate)',
        'endDate',
      )
      .addSelect('contract.updatedAt', 'updatedAt')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.updatedAt >= :updatedSince', { updatedSince })
      .orderBy('contract.updatedAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .take(COMPANY_DASHBOARD_CONTRACT_LIMIT)
      .getRawMany<DashboardContractRow>();

    return rows.map(mapDashboardContract);
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
