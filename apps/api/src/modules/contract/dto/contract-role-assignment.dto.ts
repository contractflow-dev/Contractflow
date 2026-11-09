import {
  IsBoolean,
  Matches,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EContractRole } from '@contractflow/contracts-schema';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export const ASSIGNABLE_WORKSPACES = ['project', 'hse', 'finance'] as const;

export class ListContractRoleAssignmentsRequestDto {
  @IsIn(ASSIGNABLE_WORKSPACES)
  workspace!: AssignableContractWorkspace;
}

/**
 * Filters for the company-wide list of contract roles. The company comes
 * from X-Company-Id; these only narrow it. There is deliberately no contract
 * filter: contract ids never travel in the query string.
 */
export class ListCompanyRoleAssignmentsRequestDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(/^[0-9A-HJKMNP-TV-Z]{26}$/i, {
    message: 'companyUserId must be a valid ULID',
  })
  companyUserId?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_WORKSPACES)
  workspace?: AssignableContractWorkspace;
}

export class CreateContractRoleAssignmentRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(26)
  companyUserId!: string;

  @IsEnum(EContractRole)
  role!: EContractRole;

  @IsOptional()
  @IsBoolean()
  isWorkspaceAdmin?: boolean;
}

export class SetWorkspaceAdminRequestDto {
  @IsBoolean()
  isWorkspaceAdmin!: boolean;
}

export class CreateContractRoleInvitationRequestDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(EContractRole)
  role!: EContractRole;

  @IsOptional()
  @IsBoolean()
  isWorkspaceAdmin?: boolean;
}

export class ContractRoleInvitationTokenRequestDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}

export class RespondContractRoleInvitationRequestDto extends ContractRoleInvitationTokenRequestDto {
  @IsIn(['accept', 'decline'])
  decision!: 'accept' | 'decline';
}
