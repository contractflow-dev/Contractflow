import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { AppUser } from '../entities/app-user.entity';
import type { IUpdateAppUserProfileInput } from './app-user.interface';

export const APP_USER_ACCOUNT_UNIT_OF_WORK = Symbol(
  'APP_USER_ACCOUNT_UNIT_OF_WORK',
);

/** The user reads and writes a signed-in user's own account needs. */
export interface IAppUserAccountUserRepository {
  /** The user without the password hash, or null. */
  findProfileById(id: string): Promise<AppUser | null>;
  /** The stored password hash only, or null when the user doesn't exist. */
  findPasswordHash(id: string): Promise<string | null>;
  /**
   * The stored password hash, row-locked until the transaction ends, so a
   * concurrent password change waits and then sees the new hash.
   */
  findPasswordHashForUpdate(id: string): Promise<string | null>;
  /** Writes only the fields that are provided. */
  updateProfile(id: string, data: IUpdateAppUserProfileInput): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export interface IAppUserAccountSessionRepository {
  /** Revokes every active session of the user except `keepSessionId`. */
  revokeAllActiveForUserExcept(
    userId: string,
    keepSessionId: string,
    at: Date,
  ): Promise<void>;
}

export interface IAppUserAccountTransactionContext {
  users: IAppUserAccountUserRepository;
  sessions: IAppUserAccountSessionRepository;
}

export type IAppUserAccountUnitOfWork =
  IUnitOfWork<IAppUserAccountTransactionContext>;
