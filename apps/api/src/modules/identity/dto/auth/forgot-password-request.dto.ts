import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import type { ForgotPasswordRequest } from '@contractflow/contracts-schema';

export class ForgotPasswordRequestDto implements ForgotPasswordRequest {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
