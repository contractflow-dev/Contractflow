import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
  ICompanyDashboardResponse,
  ICompanyMembershipResponse,
  ICompanyProfileResponse,
} from '@contractflow/contracts-schema';

@Injectable()
export class CompanyService {
  constructor(
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
      new Date(),
    );

    const activeContractCount = await this.countCompanyContracts(
      companyId,
      EContractStatus.ACTIVE,
    );
    const expiringContractCount =
      await this.countExpiringCompanyContracts(companyId);

    return {
      company: CompanyResponseDto.fromEntity(membership.company),
      membership: this.mapMembership(membership),
      summary: {
        activeMembershipCount,
        pendingInvitationCount,
        activeContractCount,
        expiringContractCount,
      },
    };
  }

  private async countCompanyContracts(
    companyId: string,
    status: EContractStatus,
  ): Promise<number> {
    const result = await this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .select('COUNT(DISTINCT contract.id)', 'count')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', { status })
      .getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
  }

  private async countExpiringCompanyContracts(
    companyId: string,
  ): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiryLimit = new Date(today);
    expiryLimit.setUTCDate(expiryLimit.getUTCDate() + 30);
    const todayDate = today.toISOString().slice(0, 10);
    const expiryDate = expiryLimit.toISOString().slice(0, 10);

    const result = await this.contractPartyRepository
      .createQueryBuilder('party')
      .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
      .select('COUNT(DISTINCT contract.id)', 'count')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere('contract.endDate >= :today', { today: todayDate })
      .andWhere('contract.endDate <= :expiryLimit', {
        expiryLimit: expiryDate,
      })
      .getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
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
