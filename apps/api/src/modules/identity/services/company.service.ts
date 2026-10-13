import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { DataSource, Repository } from 'typeorm';
import { CreateCompanyRequestDto } from '../dto/company/create-company-request.dto';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';

export interface CompanyProfileResponse {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxIdentificationNumber: string;
  email: string;
  phoneNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  defaultCurrencyCode: string;
  status: ECompanyStatus;
}

export interface CompanyMembershipResponse {
  id: string;
  companyId: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  canManageCompany: boolean;
}

export interface CompanyAccessResponse {
  company: CompanyProfileResponse;
  membership: CompanyMembershipResponse;
}

export interface CompanyDashboardResponse extends CompanyAccessResponse {
  summary: {
    activeMembershipCount: number;
  };
}

function companyProfile(company: Company): CompanyProfileResponse {
  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    registrationNumber: company.registrationNumber,
    taxIdentificationNumber: company.taxIdentificationNumber,
    email: company.email,
    phoneNumber: company.phoneNumber,
    website: company.website,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    stateRegion: company.stateRegion,
    postalCode: company.postalCode,
    countryCode: company.countryCode,
    defaultCurrencyCode: company.defaultCurrencyCode,
    status: company.status,
  };
}

function membershipResponse(
  membership: CompanyUser,
): CompanyMembershipResponse {
  return {
    id: membership.id,
    companyId: membership.companyId,
    companyRole: membership.companyRole,
    status: membership.status,
    canManageCompany:
      membership.companyRole === ECompanyRole.COMPANY_ADMIN &&
      membership.status === ECompanyUserStatus.ACTIVE,
  };
}

function accessResponse(membership: CompanyUser): CompanyAccessResponse {
  return {
    company: companyProfile(membership.company),
    membership: membershipResponse(membership),
  };
}

@Injectable()
export class CompanyService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CompanyUser)
    private readonly memberships: Repository<CompanyUser>,
  ) {}

  async create(
    userId: string,
    input: CreateCompanyRequestDto,
  ): Promise<CompanyAccessResponse> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(AppUser).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!user || user.status !== EUserStatus.ACTIVE) {
        throw new UnauthorizedException('Authentication required.');
      }
      if (!user.emailVerifiedAt) {
        throw new ForbiddenException(
          'Verify your email before creating a company.',
        );
      }

      const companyRepository = manager.getRepository(Company);
      const company = await companyRepository.save(
        companyRepository.create({
          ...input,
          website: input.website ?? '',
          addressLine2: input.addressLine2 ?? '',
          status: ECompanyStatus.ACTIVE,
          verifiedAt: null,
        }),
      );

      const membershipRepository = manager.getRepository(CompanyUser);
      const membership = await membershipRepository.save(
        membershipRepository.create({
          companyId: company.id,
          userId: user.id,
          companyRole: ECompanyRole.COMPANY_ADMIN,
          jobTitle: 'Company Administrator',
          status: ECompanyUserStatus.ACTIVE,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      membership.company = company;

      return accessResponse(membership);
    });
  }

  async listForUser(userId: string): Promise<CompanyAccessResponse[]> {
    const memberships = await this.memberships.find({
      where: { userId, status: ECompanyUserStatus.ACTIVE },
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
    return memberships
      .filter(({ company }) => company.status === ECompanyStatus.ACTIVE)
      .map(accessResponse);
  }

  async getCurrent(userId: string): Promise<CompanyAccessResponse> {
    const [company] = await this.listForUser(userId);
    if (!company) {
      throw new NotFoundException('No active company membership was found.');
    }
    return company;
  }

  async getMembership(
    userId: string,
    companyId: string,
  ): Promise<CompanyMembershipResponse> {
    const membership = await this.findActiveMembership(userId, companyId);
    return membershipResponse(membership);
  }

  async getDashboard(
    userId: string,
    companyId: string,
  ): Promise<CompanyDashboardResponse> {
    const membership = await this.findActiveMembership(userId, companyId);
    if (membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Company administrator access is required.',
      );
    }

    const activeMembershipCount = await this.memberships.count({
      where: {
        companyId,
        status: ECompanyUserStatus.ACTIVE,
      },
    });
    return {
      ...accessResponse(membership),
      summary: { activeMembershipCount },
    };
  }

  private async findActiveMembership(
    userId: string,
    companyId: string,
  ): Promise<CompanyUser> {
    const membership = await this.memberships.findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
      },
      relations: { company: true },
    });
    if (
      !membership ||
      membership.company.status !== ECompanyStatus.ACTIVE
    ) {
      throw new NotFoundException('Company membership was not found.');
    }
    return membership;
  }
}
