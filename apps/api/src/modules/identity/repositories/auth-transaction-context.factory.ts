import type { EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { AppUser } from '../entities/app-user.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import type { IAuthTransactionContext } from '../interface/auth-persistence.interface';
import { AppUserRepository } from './app-user.repository';
import { EmailVerificationTokenRepository } from './email-verification-token.repository';

export class AuthTransactionContextFactory implements ITransactionContextFactory<IAuthTransactionContext> {
  create(manager: EntityManager): IAuthTransactionContext {
    return {
      users: new AppUserRepository(manager.getRepository(AppUser)),
      verificationTokens: new EmailVerificationTokenRepository(
        manager.getRepository(EmailVerificationToken),
      ),
    };
  }
}
