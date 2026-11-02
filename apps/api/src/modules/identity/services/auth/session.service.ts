import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { EUserStatus } from '@contractflow/contracts-schema';

import { UserSession } from '../../entities/user-session.entity';
import { AppUser } from '../../entities/app-user.entity';

import {
  RequestMetadata,
  AuthenticatedSession,
} from '../../interface/auth-context.interface';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    user: AppUser,
    metadata: RequestMetadata,
    sessionDays: number,
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    const sessionToken = randomBytes(32).toString('base64url');

    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    const session = this.sessions.create({
      userId: user.id,
      refreshTokenHash: this.hashToken(sessionToken),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt,
      revokedAt: null,
    });

    await this.sessions.save(session);

    return {
      sessionToken,
      expiresAt,
    };
  }

  async authenticate(sessionToken: string): Promise<AuthenticatedSession> {
    const session = await this.sessions.findOne({
      where: {
        refreshTokenHash: this.hashToken(sessionToken),
        revokedAt: IsNull(),
      },
      relations: {
        user: true,
      },
    });

    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user ||
      session.user.status !== EUserStatus.ACTIVE ||
      !session.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException('Authentication required.');
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        emailVerifiedAt: session.user.emailVerifiedAt,
        isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      },
      sessionId: session.id,
    };
  }

  async revokeSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;

    const session = await this.sessions.findOne({
      where: {
        refreshTokenHash: this.hashToken(sessionToken),
        revokedAt: IsNull(),
      },
    });

    if (!session) return;

    session.revokedAt = new Date();

    await this.sessions.save(session);
  }
}
