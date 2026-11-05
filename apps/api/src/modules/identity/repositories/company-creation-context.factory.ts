import type { EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
import type { ICompanyCreationContext } from '../interface/company-creation-persistence.interface';

export class CompanyCreationContextFactory implements ITransactionContextFactory<ICompanyCreationContext> {
  create(manager: EntityManager): ICompanyCreationContext {
    const users = manager.getRepository(AppUser);
    const companies = manager.getRepository(Company);
    const memberships = manager.getRepository(CompanyUser);

    return {
      findUserById: (userId) => users.findOne({ where: { id: userId } }),
      createCompany: (data) => companies.save(companies.create(data)),
      createMembership: (data) => memberships.save(memberships.create(data)),
    };
  }
}
