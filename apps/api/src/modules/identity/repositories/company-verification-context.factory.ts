import { IsNull, Not, type EntityManager } from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyVerificationToken } from '../entities/company-verification-token.entity';
import type { ICompanyVerificationContext } from '../interface/company-verification-persistence.interface';

export class CompanyVerificationContextFactory implements ITransactionContextFactory<ICompanyVerificationContext> {
  create(manager: EntityManager): ICompanyVerificationContext {
    const companies = manager.getRepository(Company);
    const memberships = manager.getRepository(CompanyUser);
    const tokens = manager.getRepository(CompanyVerificationToken);

    return {
      findCompanyForUpdate: (companyId) =>
        companies.findOne({
          where: { id: companyId },
          lock: { mode: 'pessimistic_write' },
        }),
      // citext makes the email comparison case-insensitive.
      findOtherVerifiedCompanyByEmail: (email, excludeCompanyId) =>
        companies.findOne({
          where: {
            email,
            id: Not(excludeCompanyId),
            verifiedAt: Not(IsNull()),
          },
        }),
      saveCompany: (company) => companies.save(company),
      isActiveCompanyAdmin: (userId, companyId) =>
        memberships.exists({
          where: {
            userId,
            companyId,
            companyRole: ECompanyRole.COMPANY_ADMIN,
            status: ECompanyUserStatus.ACTIVE,
            leftAt: IsNull(),
          },
        }),
      createToken: (data) => tokens.save(tokens.create(data)),
      findTokenByHashForUpdate: (tokenHash) =>
        tokens.findOne({
          where: { tokenHash },
          lock: { mode: 'pessimistic_write' },
        }),
      findLatestToken: (companyId) =>
        tokens.findOne({
          where: { companyId },
          order: { createdAt: 'DESC' },
        }),
      invalidateUnusedTokens: async (companyId, at) => {
        await tokens.update({ companyId, usedAt: IsNull() }, { usedAt: at });
      },
      saveToken: (token) => tokens.save(token),
    };
  }
}
