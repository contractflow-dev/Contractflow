import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
} from 'class-validator';
import type { UpdateMyProfileRequest } from '@contractflow/contracts-schema';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * The signed-in user's own profile. Every field is optional and only the
 * fields sent are changed. Email is deliberately absent (a new address needs
 * verifying first); unknown fields are stripped by the global whitelist.
 */
export class UpdateAppUserRequestDto implements UpdateMyProfileRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  /** May be cleared with an empty string, as at registration. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  /** `app_user.phone_number` is varchar(20). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
