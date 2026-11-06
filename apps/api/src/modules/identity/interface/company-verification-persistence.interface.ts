import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { Company } from '../entities/company.entity';
import type { CompanyVerificationToken } from '../entities/company-verification-token.entity';

export const COMPANY_VERIFICATION_UNIT_OF_WORK = Symbol(
  'COMPANY_VERIFICATION_UNIT_OF_WORK',
);

export interface ICompanyVerificationContext {
  findCompanyForUpdate(companyId: string): Promise<Company | null>;
  /** Another company that has already verified this email, if any. */
  findOtherVerifiedCompanyByEmail(
    email: string,
    excludeCompanyId: string,
  ): Promise<Company | null>;
  saveCompany(company: Company): Promise<Company>;
  isActiveCompanyAdmin(userId: string, companyId: string): Promise<boolean>;
  createToken(
    data: Pick<
      CompanyVerificationToken,
      'companyId' | 'email' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): Promise<CompanyVerificationToken>;
  findTokenByHashForUpdate(
    tokenHash: string,
  ): Promise<CompanyVerificationToken | null>;
  findLatestToken(companyId: string): Promise<CompanyVerificationToken | null>;
  invalidateUnusedTokens(companyId: string, at: Date): Promise<void>;
  saveToken(token: CompanyVerificationToken): Promise<CompanyVerificationToken>;
}

export type ICompanyVerificationUnitOfWork =
  IUnitOfWork<ICompanyVerificationContext>;
