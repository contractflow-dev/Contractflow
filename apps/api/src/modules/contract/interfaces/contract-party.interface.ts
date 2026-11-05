import { EPartyType } from '@contractflow/contracts-schema';

export interface IContractPartyEntity {
  contractId: string;
  companyId: string;
  partyType: EPartyType;
  signatoryFirstName: string | null;
  signatoryLastName: string | null;
  signatoryTitle: string | null;
  signedAt: Date | null;
}

// IGetUserResponse for interface
// GetUserResponseDto IGetUserResponseDto for Dto
