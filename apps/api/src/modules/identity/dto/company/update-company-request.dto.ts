import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CreateCompanyRequestDto } from './requests/create-company-request.dto';

export class UpdateCompanyRequestDto extends PartialType(
  OmitType(CreateCompanyRequestDto, ['website', 'addressLine2'] as const),
) {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(255)
  website?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;
}
