import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  EContractSortField,
  EContractStatus,
  ESortOrder,
} from '@contractflow/contracts-schema';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListContractsRequestDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeDeleted = false;

  @IsOptional()
  @IsEnum(EContractStatus)
  status?: EContractStatus;

  @IsOptional()
  @IsEnum(EContractSortField)
  sortBy?: EContractSortField;

  @IsOptional()
  @IsEnum(ESortOrder)
  sortOrder?: ESortOrder;
}

export class ListContractStatusHistoryRequestDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(EContractStatus)
  status?: EContractStatus;

  @IsOptional()
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i)
  userId?: string;
}
