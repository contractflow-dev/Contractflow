import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import type {
  ICreateUserSession,
  IUserSessionRepository,
} from '../interface/user-session-repository.interface';
import { UserSession } from '../entities/user-session.entity';
import type { IPasswordResetSessionRepository } from '../interface/password-reset-persistence.interface';
import type { IAppUserAccountSessionRepository } from '../interface/app-user-account-persistence.interface';

@Injectable()
export class UserSessionRepository
  extends BaseRepository<UserSession>
  implements
    IUserSessionRepository,
    IPasswordResetSessionRepository,
    IAppUserAccountSessionRepository
{
  constructor(
    @InjectRepository(UserSession) repository: Repository<UserSession>,
  ) {
    super(repository);
  }

  async createSession(data: ICreateUserSession): Promise<void> {
    await this.repository.save(
      this.repository.create({
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        ipAddress: data.metadata.ipAddress,
        userAgent: data.metadata.userAgent,
        expiresAt: data.expiresAt,
        revokedAt: null,
      }),
    );
  }

  findActiveWithUser(refreshTokenHash: string): Promise<UserSession | null> {
    return this.repository.findOne({
      where: { refreshTokenHash, revokedAt: IsNull() },
      relations: { user: true },
    });
  }

  async revokeActive(refreshTokenHash: string, revokedAt: Date): Promise<void> {
    await this.repository.update(
      { refreshTokenHash, revokedAt: IsNull() },
      { revokedAt },
    );
  }

  async revokeAllActiveForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.repository.update({ userId, revokedAt: IsNull() }, { revokedAt });
  }

  async revokeAllActiveForUserExcept(
    userId: string,
    keepSessionId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull(), id: Not(keepSessionId) },
      { revokedAt },
    );
  }
}
