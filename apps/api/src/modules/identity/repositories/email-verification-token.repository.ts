import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import type { IEmailVerificationTokenRepository } from '../interface/auth-persistence.interface';

@Injectable()
export class EmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repository: Repository<EmailVerificationToken>,
  ) {}

  createToken(
    token: Pick<
      EmailVerificationToken,
      'userId' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): EmailVerificationToken {
    return this.repository.create(token);
  }

  findByHashForUpdate(
    tokenHash: string,
  ): Promise<EmailVerificationToken | null> {
    return this.repository.findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findLatestForUser(userId: string): Promise<EmailVerificationToken | null> {
    return this.repository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async invalidateUnusedForUser(userId: string, at: Date): Promise<void> {
    await this.repository.update({ userId, usedAt: IsNull() }, { usedAt: at });
  }

  saveToken(token: EmailVerificationToken): Promise<EmailVerificationToken> {
    return this.repository.save(token);
  }
}
