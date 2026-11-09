import { IsNull, MoreThan, MoreThanOrEqual } from 'typeorm';
import type { Repository } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import type { IPasswordResetTokenRepository } from '../interface/password-reset-persistence.interface';

/**
 * Reset tokens are not company- or contract-scoped: they belong to one user
 * and are found by the hash of a secret only that user received. Use only
 * through the password reset workflow.
 */
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly repository: Repository<PasswordResetToken>) {}

  createToken(
    token: Pick<
      PasswordResetToken,
      'userId' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): PasswordResetToken {
    return this.repository.create(token);
  }

  saveToken(token: PasswordResetToken): Promise<PasswordResetToken> {
    return this.repository.save(token);
  }

  findByHashForUpdate(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.repository.findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findLatestForUser(userId: string): Promise<PasswordResetToken | null> {
    return this.repository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  countCreatedSince(userId: string, since: Date): Promise<number> {
    return this.repository.count({
      where: { userId, createdAt: MoreThanOrEqual(since) },
    });
  }

  async consume(id: string, at: Date): Promise<boolean> {
    // Conditional, so a token can only ever be spent once whatever the
    // caller has in memory.
    const result = await this.repository.update(
      { id, usedAt: IsNull(), expiresAt: MoreThan(at) },
      { usedAt: at },
    );
    return result.affected === 1;
  }

  async invalidateUnusedForUser(userId: string, at: Date): Promise<void> {
    await this.repository.update({ userId, usedAt: IsNull() }, { usedAt: at });
  }
}
