import type { UserStatus } from "../enums/identity.enum.js";

export interface IGetAppUserResponse {
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
