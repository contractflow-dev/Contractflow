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

/** Asks for a password reset link; the response never says whether the account exists. */
export interface ForgotPasswordRequest {
  email: string;
}

/** Sets a new password with the single-use token from a reset link. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}
