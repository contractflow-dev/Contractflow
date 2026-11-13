import type {
  ECompanyRole,
  EInvitationStatus,
} from '@contractflow/contracts-schema';

/** What an invitee may see about a pending invitation. */
export interface ICompanyInvitationDetailsDto {
  companyName: string;
  inviterName: string | null;
  email: string;
  companyRole: ECompanyRole;
  expiresAt: Date;
}

/**
 * The preview of an invitation link. Only a pending invitation carries its
 * details; an answered, expired or revoked one reports only its status.
 */
export type CompanyInvitationPublicResponseDto =
  | ({ status: EInvitationStatus.PENDING } & ICompanyInvitationDetailsDto)
  | { status: Exclude<EInvitationStatus, EInvitationStatus.PENDING> };

/** One of the signed-in user's own pending invitations. */
export interface IMyCompanyInvitationResponseDto extends ICompanyInvitationDetailsDto {
  id: string;
}
