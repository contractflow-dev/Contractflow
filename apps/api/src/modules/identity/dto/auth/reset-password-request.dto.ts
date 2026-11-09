import { IsNotEmpty, IsString, IsStrongPassword, Length, MaxLength } from 'class-validator';
import type { ResetPasswordRequest } from '@contractflow/contracts-schema';
import { MAX_PASSWORD_LENGTH, STRONG_PASSWORD_OPTIONS } from './password-policy';

export class ResetPasswordRequestDto implements ResetPasswordRequest {
  /** The raw token from the reset link (32 random bytes, base64url). */
  @IsString()
  @Length(32, 128)
  token!: string;

  @IsStrongPassword(STRONG_PASSWORD_OPTIONS)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @IsNotEmpty()
  password!: string;
}
