import { IsEnum } from 'class-validator';
import { ECompanyRole } from '@contractflow/contracts-schema';

export class UpdateCompanyMemberRoleRequestDto {
  @IsEnum(ECompanyRole)
  companyRole!: ECompanyRole;
}
