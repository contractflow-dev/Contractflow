import {
  IGetAppUserResponse,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { AppUser } from '../../../entities/app-user.entity';

export class AppUserResponseDto implements IGetAppUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  timezone: string;
  status: EUserStatus;
  createdAt: Date;
  updatedAt: Date;
  emailVerifiedAt: Date;
  lastLoginAt: Date;

  static fromEntity(entity: AppUser): AppUserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      middleName: entity.middleName,
      lastName: entity.lastName,
      status: entity.status,
      timezone: entity.timezone,
      emailVerifiedAt: entity.emailVerifiedAt,
      lastLoginAt: entity.lastLoginAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      phoneNumber: entity.phoneNumber,
    };
  }
}
