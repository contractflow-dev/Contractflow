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
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
