import type {
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import type {
  IPageQuery,
  IPersistencePage,
} from '../../../common/application/pagination.interface';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import type { AppUser } from '../entities/app-user.entity';
import type { Company } from '../entities/company.entity';
import type { CompanyInvitation } from '../entities/company-invitation.entity';
import type { CompanyUser } from '../entities/company-user.entity';
import type { ICompanyInvitationEntity } from './company-invitation.interface';
import type { ICompanyUserEntity } from './company-user.interface';

export const COMPANY_ADMIN_READ_REPOSITORY = Symbol(
  'COMPANY_ADMIN_READ_REPOSITORY',
);
export const COMPANY_ADMIN_UNIT_OF_WORK = Symbol('COMPANY_ADMIN_UNIT_OF_WORK');

export interface IListCompanyMembersCriteria extends IPageQuery {
  status?: ECompanyUserStatus;
  search?: string;
}

export interface ICompanyAdminReadRepository {
  findActiveRole(
    scope: ICompanyScope,
    userId: string,
  ): Promise<ECompanyRole | null>;
  listMembers(
    scope: ICompanyScope,
    criteria: IListCompanyMembersCriteria,
  ): Promise<IPersistencePage<CompanyUser>>;
  listInvitations(
    scope: ICompanyScope,
    query: IPageQuery,
  ): Promise<IPersistencePage<CompanyInvitation>>;
  /** Deliberately unscoped: the invitee holds only the token. */
  findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<CompanyInvitation | null>;
  expireInvitation(scope: ICompanyScope, invitationId: string): Promise<void>;
  findCompanyName(
    companyId: string,
  ): Promise<{ id: string; name: string } | null>;
}

export interface ICompanyAdminCompanyWriter {
  lockById(scope: ICompanyScope): Promise<Company | null>;
  save(company: Company): Promise<Company>;
}

export interface ICompanyAdminMemberWriter {
  lockActiveByUser(
    scope: ICompanyScope,
    userId: string,
  ): Promise<CompanyUser | null>;
  lockActiveById(
    scope: ICompanyScope,
    membershipId: string,
  ): Promise<CompanyUser | null>;
  lockAnyByUser(
    scope: ICompanyScope,
    userId: string,
  ): Promise<CompanyUser | null>;
  findActiveByUser(
    scope: ICompanyScope,
    userId: string,
  ): Promise<CompanyUser | null>;
  countActiveAdmins(scope: ICompanyScope): Promise<number>;
  create(data: ICompanyUserEntity): Promise<CompanyUser>;
  save(member: CompanyUser): Promise<CompanyUser>;
}

export interface ICompanyAdminUserReader {
  findIdByEmail(email: string): Promise<{ id: string; email: string } | null>;
  findById(userId: string): Promise<AppUser | null>;
}

export interface ICompanyAdminInvitationWriter {
  findActivePendingByEmail(
    scope: ICompanyScope,
    email: string,
    now: Date,
  ): Promise<CompanyInvitation | null>;
  expirePendingByEmail(
    scope: ICompanyScope,
    email: string,
    now: Date,
  ): Promise<void>;
  lockById(
    scope: ICompanyScope,
    invitationId: string,
  ): Promise<CompanyInvitation | null>;
  /** Deliberately unscoped: the invitee holds only the token. */
  lockByTokenHash(tokenHash: string): Promise<CompanyInvitation | null>;
  create(data: ICompanyInvitationEntity): Promise<CompanyInvitation>;
  save(invitation: CompanyInvitation): Promise<CompanyInvitation>;
  /** Returns true only when exactly one still-pending row was revoked. */
  revokePending(
    scope: ICompanyScope,
    invitationId: string,
    revokedAt: Date,
  ): Promise<boolean>;
}

export interface ICompanyAdminTransactionContext {
  companies: ICompanyAdminCompanyWriter;
  members: ICompanyAdminMemberWriter;
  users: ICompanyAdminUserReader;
  invitations: ICompanyAdminInvitationWriter;
}

export type ICompanyAdminUnitOfWork =
  IUnitOfWork<ICompanyAdminTransactionContext>;
