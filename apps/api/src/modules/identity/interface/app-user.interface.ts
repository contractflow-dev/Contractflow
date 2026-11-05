import type { EUserStatus } from '@contractflow/contracts-schema';
import { AppUser } from '../entities/app-user.entity';

export interface IAppUserEntity {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
  passwordHash: string;
  status: EUserStatus;
  isPlatformAdmin: boolean;
  mfaEnabled: boolean;
  timezone: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

export interface ICreateAppUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber?: string;
  timezone?: string;
}

export type IUpdateAppUserProfileInput = Partial<
  Pick<
    AppUser,
    'firstName' | 'lastName' | 'middleName' | 'phoneNumber' | 'timezone'
  >
>;
