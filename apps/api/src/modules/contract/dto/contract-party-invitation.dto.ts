import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length } from 'class-validator';
import { EPartyType } from '@contractflow/contracts-schema';
import type {
  ContractPartyInvitationStatus,
  InvitableContractPartyType,
} from '../entities/contract-party-invitation.entity';

export class CreateContractPartyInvitationRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 320)
  email!: string;

  @IsIn([EPartyType.CONTRACTOR, EPartyType.SUBCONTRACTOR])
  partyType!: InvitableContractPartyType;
}

export class ContractPartyInvitationTokenRequestDto {
  @IsString()
  @Length(32, 128)
  token!: string;
}

export class RespondContractPartyInvitationRequestDto extends ContractPartyInvitationTokenRequestDto {
  @IsIn(['accept', 'reject'])
  decision!: 'accept' | 'reject';
}

export interface ContractPartyInvitationResponse {
  id: string;
  email: string;
  partyType: InvitableContractPartyType;
  status: ContractPartyInvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  revokedAt: Date | null;
}

export interface ContractPartyInvitationPreviewResponse {
  companyId: string;
  contractTitle: string;
  invitingCompanyName: string;
  email: string;
  partyType: InvitableContractPartyType;
  expiresAt: Date;
}
