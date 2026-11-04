import {
  EContractSiteStatus,
  ECountryCode,
  type CreateContractSiteRequest,
} from '@contractflow/contracts-schema';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateContractSiteRequestDto implements CreateContractSiteRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 40)
  siteCode!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 255)
  addressLine1!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  city!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  stateRegion!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(ECountryCode)
  countryCode!: ECountryCode;

  @IsInt()
  @Min(-90_000_000)
  @Max(90_000_000)
  latitudeE6!: number;

  @IsInt()
  @Min(-180_000_000)
  @Max(180_000_000)
  longitudeE6!: number;

  @IsEnum(EContractSiteStatus)
  status!: EContractSiteStatus;
}

export class UpdateContractSiteRequestDto extends PartialType(
  CreateContractSiteRequestDto,
) {}
