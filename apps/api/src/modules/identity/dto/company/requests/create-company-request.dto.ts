import { ECountryCode, ECurrencyCode } from '@contractflow/contracts-schema';
import { Transform } from 'class-transformer';
import {
  IsEnum,
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

/**
 * Trims an optional text field. `null` is treated as "not sent", so it never
 * reaches a NOT NULL column; an empty string is kept so a profile update can
 * clear the field.
 */
const trimOptional = ({ value }: { value: unknown }) =>
  value === null ? undefined : trim({ value });

/** Trims and prefixes `https://` when no scheme is given (e.g. `www.example.com`). */
export const normalizeWebsite = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const WEBSITE_URL_OPTIONS = {
  require_protocol: true,
  protocols: ['http', 'https'],
};

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

  /** Optional; a blank value is stored as an empty string ("not provided"). */
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  /** Optional; a blank value is stored as an empty string ("not provided"). */
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxIdentificationNumber?: string;

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

  @Transform(({ value }) => normalizeWebsite(value) || undefined)
  @IsOptional()
  @IsUrl(WEBSITE_URL_OPTIONS)
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
  @IsEnum(ECountryCode)
  countryCode!: ECountryCode;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  @IsEnum(ECurrencyCode)
  defaultCurrencyCode!: ECurrencyCode;
}
