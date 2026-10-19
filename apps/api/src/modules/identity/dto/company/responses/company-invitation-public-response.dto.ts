import { EInvitationRole } from '@contractflow/contracts-schema';

export interface CompanyInvitationPublicResponseDto {
  companyName: string;
  email: string;
  companyRole: EInvitationRole;
  expiresAt: Date;
}
