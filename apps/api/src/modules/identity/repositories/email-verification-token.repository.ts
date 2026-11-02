import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';

@Injectable()
export class EmailVerificationTokenRepository {
  createInTransaction(
    manager: EntityManager,
    token: Pick<
      EmailVerificationToken,
      'userId' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): EmailVerificationToken {
    return manager.getRepository(EmailVerificationToken).create(token);
  }

  findByHashForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailVerificationToken | null> {
    return manager.getRepository(EmailVerificationToken).findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findLatestForUser(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailVerificationToken | null> {
    return manager.getRepository(EmailVerificationToken).findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async invalidateUnusedForUser(
    manager: EntityManager,
    userId: string,
    at: Date,
  ): Promise<void> {
    await manager
      .getRepository(EmailVerificationToken)
      .update({ userId, usedAt: IsNull() }, { usedAt: at });
  }

  saveInTransaction(
    manager: EntityManager,
    token: EmailVerificationToken,
  ): Promise<EmailVerificationToken> {
    return manager.getRepository(EmailVerificationToken).save(token);
  }
}
