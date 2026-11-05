import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ECompanyUserStatus } from '@contractflow/contracts-schema';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';

export class ListCompanyMembersRequestDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ECompanyUserStatus)
  status?: ECompanyUserStatus;
}
