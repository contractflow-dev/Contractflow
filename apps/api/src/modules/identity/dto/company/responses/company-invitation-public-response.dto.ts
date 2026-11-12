import { ECompanyRole } from '@contractflow/contracts-schema';

export interface CompanyInvitationPublicResponseDto {
  companyName: string;
  email: string;
  companyRole: ECompanyRole;
  expiresAt: Date;
}
