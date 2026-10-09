import type { EUserStatus } from "../enums/identity.enum.js";

export interface IGetAppUserResponse {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  status: EUserStatus;
  timezone: string;
  emailVerifiedAt: Date;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
