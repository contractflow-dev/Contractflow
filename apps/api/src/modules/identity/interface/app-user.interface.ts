import type { EUserStatus } from '@contractflow/contracts-schema';

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
  emailVerifiedAt: Date;
  lastLoginAt: Date;
}