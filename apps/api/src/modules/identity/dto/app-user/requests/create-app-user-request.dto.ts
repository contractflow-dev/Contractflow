import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsStrongPassword,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsTimeZone,
  IsOptional,
} from 'class-validator';
import type { RegisterRequest } from '@contractflow/contracts-schema';
import {
  MAX_PASSWORD_LENGTH,
  STRONG_PASSWORD_OPTIONS,
} from '../../auth/password-policy';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAppUserRequestDto implements RegisterRequest {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsStrongPassword(STRONG_PASSWORD_OPTIONS)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @IsNotEmpty()
  password: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  phoneNumber: string;

  @IsTimeZone()
  timezone: string;
}
