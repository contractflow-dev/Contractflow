import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ECompanyRole } from '@contractflow/contracts-schema';

export class UpdateCompanyMemberRequestDto {
  @IsOptional()
  @IsEnum(ECompanyRole)
  companyRole?: ECompanyRole;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;
}
