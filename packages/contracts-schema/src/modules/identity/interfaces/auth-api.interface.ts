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

/**
 * The signed-in user's own profile fields, all optional; only the fields
 * sent are changed. Email is not editable here: a new address would need
 * verifying first.
 */
export interface UpdateMyProfileRequest {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
  timezone?: string;
}

/**
 * Changes the signed-in user's password. The current password is required;
 * every other session of the user is signed out, the current one stays.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}
