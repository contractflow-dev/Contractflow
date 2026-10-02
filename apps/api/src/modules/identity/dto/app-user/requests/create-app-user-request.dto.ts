import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsStrongPassword,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsTimeZone,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAppUserRequestDto {
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  middleName: string;

  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(255)
  @IsNotEmpty()
  password: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  phoneNumber: string;

  @IsTimeZone()
  timezone: string;
}
