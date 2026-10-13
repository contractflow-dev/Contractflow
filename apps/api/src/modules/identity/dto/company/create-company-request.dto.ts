import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCompanyRequestDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  legalName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  registrationNumber!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  taxIdentificationNumber!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phoneNumber!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(255)
  website?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  addressLine1!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stateRegion!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  defaultCurrencyCode!: string;
}
