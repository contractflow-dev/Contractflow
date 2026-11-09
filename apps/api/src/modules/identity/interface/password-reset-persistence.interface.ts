import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { AppUser } from '../entities/app-user.entity';
import type { PasswordResetToken } from '../entities/password-reset-token.entity';

export const PASSWORD_RESET_UNIT_OF_WORK = Symbol('PASSWORD_RESET_UNIT_OF_WORK');

/** The user lookups and the password write a reset needs. */
export interface IPasswordResetUserRepository {
  findByEmailForUpdate(email: string): Promise<AppUser | null>;
  findByIdForUpdate(id: string): Promise<AppUser | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export interface IPasswordResetTokenRepository {
  createToken(
    token: Pick<
      PasswordResetToken,
      'userId' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): PasswordResetToken;
  saveToken(token: PasswordResetToken): Promise<PasswordResetToken>;
  /** Locks the row until the transaction ends, so a token is checked once at a time. */
  findByHashForUpdate(tokenHash: string): Promise<PasswordResetToken | null>;
  findLatestForUser(userId: string): Promise<PasswordResetToken | null>;
  countCreatedSince(userId: string, since: Date): Promise<number>;
  /**
   * Marks the token used only if it is still unused and unexpired. Returns
   * false when another request already used it.
   */
  consume(id: string, at: Date): Promise<boolean>;
  /** Voids every unused token of the user. */
  invalidateUnusedForUser(userId: string, at: Date): Promise<void>;
}

export interface IPasswordResetSessionRepository {
  /** Revokes every session of the user that is not already revoked. */
  revokeAllActiveForUser(userId: string, at: Date): Promise<void>;
}

export interface IPasswordResetTransactionContext {
  users: IPasswordResetUserRepository;
  resetTokens: IPasswordResetTokenRepository;
  sessions: IPasswordResetSessionRepository;
}

export type IPasswordResetUnitOfWork = IUnitOfWork<IPasswordResetTransactionContext>;
