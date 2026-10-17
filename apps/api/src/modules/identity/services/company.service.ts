import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
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
      },
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
      },
      order: { joinedAt: 'DESC' },
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
      },
    });

    if (!membership?.company) {
      throw new Error('Company membership was not found.');
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
      },
    });

    if (!membership?.company) {
      throw new Error('Company membership was not found.');
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
      },
    });

    return {
      company: CompanyResponseDto.fromEntity(membership.company),
      membership: this.mapMembership(membership),
      summary: { activeMembershipCount },
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
