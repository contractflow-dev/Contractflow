import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { EContractStatus } from '@contractflow/contracts-schema';

export class ListContractsRequestDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(EContractStatus)
  status?: EContractStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class ListContractStatusHistoryRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
