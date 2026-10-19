import {
  EInvitationRole,
  EInvitationStatus,
} from '@contractflow/contracts-schema';
import { CompanyInvitation } from '../../../entities/company-invitation.entity';

export type CompanyInvitationDisplayStatus =
  EInvitationStatus | 'expired' | 'revoked';

export interface ICompanyInvitationResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyRole: EInvitationRole;
  status: CompanyInvitationDisplayStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export class CompanyInvitationResponseDto implements ICompanyInvitationResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyRole: EInvitationRole;
  status: CompanyInvitationDisplayStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;

  static fromEntity(
    entity: Pick<
      CompanyInvitation,
      | 'id'
      | 'email'
      | 'firstName'
      | 'lastName'
      | 'companyRole'
      | 'status'
      | 'expiresAt'
      | 'acceptedAt'
      | 'revokedAt'
      | 'createdAt'
    >,
    at = new Date(),
  ): ICompanyInvitationResponseDto {
    const status = entity.revokedAt
      ? 'revoked'
      : entity.status === EInvitationStatus.PENDING && entity.expiresAt <= at
        ? 'expired'
        : entity.status;
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      companyRole: entity.companyRole,
      status,
      expiresAt: entity.expiresAt,
      acceptedAt: entity.acceptedAt,
      createdAt: entity.createdAt,
    };
  }
}
