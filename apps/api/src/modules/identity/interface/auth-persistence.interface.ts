import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { EUserStatus } from '@contractflow/contracts-schema';
import type { AppUser } from '../entities/app-user.entity';
import type { EmailVerificationToken } from '../entities/email-verification-token.entity';

export const APP_USER_REPOSITORY = Symbol('APP_USER_REPOSITORY');
export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol(
  'EMAIL_VERIFICATION_TOKEN_REPOSITORY',
);
export const AUTH_UNIT_OF_WORK = Symbol('AUTH_UNIT_OF_WORK');

export interface ICreateAuthUser {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  timezone: string;
  passwordHash: string;
  status: EUserStatus;
  isPlatformAdmin: false;
  mfaEnabled: false;
  emailVerifiedAt: null;
  lastLoginAt: null;
}

export interface IAppUserRepository {
  findByEmailWithPassword(email: string): Promise<AppUser | null>;
  updateLastLogin(id: string, at: Date): Promise<void>;
  createUser(data: ICreateAuthUser): AppUser;
  findByEmailForUpdate(email: string): Promise<AppUser | null>;
  findByIdForUpdate(id: string): Promise<AppUser | null>;
  saveUser(user: AppUser): Promise<AppUser>;
}

export interface IEmailVerificationTokenRepository {
  createToken(
    token: Pick<
      EmailVerificationToken,
      'userId' | 'tokenHash' | 'expiresAt' | 'usedAt'
    >,
  ): EmailVerificationToken;
  findByHashForUpdate(
    tokenHash: string,
  ): Promise<EmailVerificationToken | null>;
  findLatestForUser(userId: string): Promise<EmailVerificationToken | null>;
  invalidateUnusedForUser(userId: string, at: Date): Promise<void>;
  saveToken(token: EmailVerificationToken): Promise<EmailVerificationToken>;
}

export interface IAuthTransactionContext {
  users: IAppUserRepository;
  verificationTokens: IEmailVerificationTokenRepository;
}

export type IAuthUnitOfWork = IUnitOfWork<IAuthTransactionContext>;
