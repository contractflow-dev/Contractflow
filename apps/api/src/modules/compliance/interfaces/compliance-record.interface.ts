import { EComplianceRecordStatus } from '@contractflow/contracts-schema';

export interface IComplianceRecordEntity {
  contractId: string;
  complianceRequirementId: string;
  contractPartyId: string;
  referenceNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  coveredAmountMinor: number;
  currencyCode: string;
  status: EComplianceRecordStatus;
  verifiedAt: Date;
  verifiedById: string;
  remarks: string;
}