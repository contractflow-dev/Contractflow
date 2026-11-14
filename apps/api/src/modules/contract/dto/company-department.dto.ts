import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';
import {
  ECompanyDepartment,
  EContractStatus,
  EDepartmentContractSort,
  EPartyType,
  type DepartmentWaitingOn,
} from '@contractflow/contracts-schema';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** The `:department` route parameter. */
export class CompanyDepartmentParamDto {
  @IsEnum(ECompanyDepartment)
  department!: ECompanyDepartment;
}

/**
 * Filters for a department's contracts inside the header company. The
 * company comes from X-Company-Id; these only narrow the list.
 */
export class ListDepartmentContractsRequestDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(EContractStatus)
  status?: EContractStatus;

  @IsOptional()
  @IsEnum(EPartyType)
  partyType?: EPartyType;

  @IsOptional()
  @IsIn(['us', 'others'])
  waitingOn?: DepartmentWaitingOn;

  @IsOptional()
  @IsEnum(EDepartmentContractSort)
  sort?: EDepartmentContractSort;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeArchived?: boolean;
}
