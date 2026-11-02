import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsStrongPassword,
} from 'class-validator';
import type { LoginRequest } from '@contractflow/contracts-schema';

export class LoginAppUserDto implements LoginRequest {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(255)
  @IsNotEmpty()
  @IsString()
  password: string;
}
