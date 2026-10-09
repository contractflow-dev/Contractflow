import { EPartyType } from '@contractflow/contracts-schema';

export interface IContractPartyEntity {
  contractId: string;
  companyId: string;
  partyType: EPartyType;
  signatoryFirstName: string;
  signatoryLastName: string;
  signatoryTitle: string;
  signedAt: Date;
}

// IGetUserResponse for interface
// GetUserResponseDto IGetUserResponseDto for Dto
