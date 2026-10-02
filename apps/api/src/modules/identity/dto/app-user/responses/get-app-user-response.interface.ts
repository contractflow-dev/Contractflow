import { UserStatus } from '../../../entities/app-user';

export interface IGetAppUserResponseDto {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  status: UserStatus;
  timezone: string;
  emailVerifiedAt: Date;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
