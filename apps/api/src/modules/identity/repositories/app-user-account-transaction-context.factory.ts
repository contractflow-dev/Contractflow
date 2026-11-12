import type { EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { AppUser } from '../entities/app-user.entity';
import { UserSession } from '../entities/user-session.entity';
import type { IAppUserAccountTransactionContext } from '../interface/app-user-account-persistence.interface';
import { AppUserRepository } from './app-user.repository';
import { UserSessionRepository } from './user-session.repository';

/** The repositories of a signed-in user's account changes, bound to one transaction. */
export class AppUserAccountTransactionContextFactory
  implements ITransactionContextFactory<IAppUserAccountTransactionContext>
{
  create(manager: EntityManager): IAppUserAccountTransactionContext {
    return {
      users: new AppUserRepository(manager.getRepository(AppUser)),
      sessions: new UserSessionRepository(manager.getRepository(UserSession)),
    };
  }
}
