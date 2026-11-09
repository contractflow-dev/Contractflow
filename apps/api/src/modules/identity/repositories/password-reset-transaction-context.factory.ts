import type { EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { AppUser } from '../entities/app-user.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { UserSession } from '../entities/user-session.entity';
import type { IPasswordResetTransactionContext } from '../interface/password-reset-persistence.interface';
import { AppUserRepository } from './app-user.repository';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { UserSessionRepository } from './user-session.repository';

/** Every repository of a password reset, bound to one transaction. */
export class PasswordResetTransactionContextFactory implements ITransactionContextFactory<IPasswordResetTransactionContext> {
  create(manager: EntityManager): IPasswordResetTransactionContext {
    return {
      users: new AppUserRepository(manager.getRepository(AppUser)),
      resetTokens: new PasswordResetTokenRepository(
        manager.getRepository(PasswordResetToken),
      ),
      sessions: new UserSessionRepository(manager.getRepository(UserSession)),
    };
  }
}
