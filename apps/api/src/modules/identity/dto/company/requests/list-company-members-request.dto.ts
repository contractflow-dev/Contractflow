import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import {
  ECompanyMemberSortField,
  ECompanyRole,
  ECompanyUserStatus,
  ESortOrder,
} from '@contractflow/contracts-schema';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';

export class ListCompanyMembersRequestDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ECompanyUserStatus)
  status?: ECompanyUserStatus;

  @IsOptional()
  @IsEnum(ECompanyRole)
  companyRole?: ECompanyRole;

  @IsOptional()
  @IsEnum(ECompanyMemberSortField)
  sortBy?: ECompanyMemberSortField;

  @IsOptional()
  @IsEnum(ESortOrder)
  sortOrder?: ESortOrder;
}
