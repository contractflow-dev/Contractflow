import type {
  ECompanyStatus,
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import type { AppUser } from '../entities/app-user.entity';
import type { Company } from '../entities/company.entity';
import type { CompanyUser } from '../entities/company-user.entity';

export const COMPANY_CREATION_UNIT_OF_WORK = Symbol(
  'COMPANY_CREATION_UNIT_OF_WORK',
);

export interface ICreateCompanyRecord extends CreateCompanyRequestDto {
  website: string;
  addressLine2: string;
  status: ECompanyStatus;
  verifiedAt: null;
}

export interface ICreateCompanyAdministratorMembership {
  companyId: string;
  userId: string;
  companyRole: ECompanyRole;
  jobTitle: string;
  status: ECompanyUserStatus;
  joinedAt: Date;
  leftAt: null;
}

export interface ICompanyCreationContext {
  findUserById(userId: string): Promise<AppUser | null>;
  createCompany(data: ICreateCompanyRecord): Promise<Company>;
  createMembership(
    data: ICreateCompanyAdministratorMembership,
  ): Promise<CompanyUser>;
}

export type ICompanyCreationUnitOfWork = IUnitOfWork<ICompanyCreationContext>;
