import {
  EInvitationRole,
  EInvitationStatus,
} from '@contractflow/contracts-schema';

export interface ICompanyInvitationEntity {
  companyId: string;
  invitedByCompanyUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyRole: EInvitationRole;
  tokenHash: string;
  status: EInvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}
