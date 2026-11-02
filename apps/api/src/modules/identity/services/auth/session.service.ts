import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { EUserStatus } from '@contractflow/contracts-schema';
import { AppUser } from '../../entities/app-user.entity';
import {
  RequestMetadata,
  AuthenticatedSession,
} from '../../interface/auth-context.interface';
import {
  USER_SESSION_REPOSITORY,
  type IUserSessionRepository,
} from '../../interface/user-session-repository.interface';

@Injectable()
export class SessionService {
  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessions: IUserSessionRepository,
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

    await this.sessions.createSession({
      userId: user.id,
      refreshTokenHash: this.hashToken(sessionToken),
      metadata,
      expiresAt,
    });

    return {
      sessionToken,
      expiresAt,
    };
  }

  async authenticate(sessionToken: string): Promise<AuthenticatedSession> {
    const session = await this.sessions.findActiveWithUser(
      this.hashToken(sessionToken),
    );

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

    await this.sessions.revokeActive(this.hashToken(sessionToken), new Date());
  }
}
