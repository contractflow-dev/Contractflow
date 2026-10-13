import type { EUserStatus } from "../enums/identity.enum.js";

export interface IGetAppUserResponse {
  id: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  status: EUserStatus;
  timezone: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
