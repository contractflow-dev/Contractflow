import type { RequestMetadata } from './auth-context.interface';
import type { UserSession } from '../entities/user-session.entity';

export const USER_SESSION_REPOSITORY = Symbol('USER_SESSION_REPOSITORY');

export interface ICreateUserSession {
  userId: string;
  refreshTokenHash: string;
  metadata: RequestMetadata;
  expiresAt: Date;
}

export interface IUserSessionRepository {
  createSession(data: ICreateUserSession): Promise<void>;
  findActiveWithUser(refreshTokenHash: string): Promise<UserSession | null>;
  revokeActive(refreshTokenHash: string, revokedAt: Date): Promise<void>;
}
