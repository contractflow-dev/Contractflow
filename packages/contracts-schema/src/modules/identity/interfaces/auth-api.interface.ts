import type { IGetAppUserResponse } from "./get-app-user-response.interface.js";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
  timezone: string;
}

export interface AuthResponse {
  user: IGetAppUserResponse;
}

export interface AuthMessageResponse {
  message: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}
