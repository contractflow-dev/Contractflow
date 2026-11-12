import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import type { ChangePasswordRequest } from '@contractflow/contracts-schema';
import {
  MAX_PASSWORD_LENGTH,
  STRONG_PASSWORD_OPTIONS,
} from '../../auth/password-policy';

export class ChangePasswordRequestDto implements ChangePasswordRequest {
  /** Checked against the stored hash, not against the policy. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  /** The same rules as registration and password reset. */
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @IsNotEmpty()
  newPassword!: string;
}
