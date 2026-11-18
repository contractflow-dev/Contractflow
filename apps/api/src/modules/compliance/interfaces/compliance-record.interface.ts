import { EComplianceRecordStatus, ECurrencyCode } from '@contractflow/contracts-schema';

export interface IComplianceRecordEntity {
  contractId: string;
  complianceRequirementId: string;
  contractPartyId: string;
  referenceNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  coveredAmountMinor: string;
  currencyCode: ECurrencyCode;
  status: EComplianceRecordStatus;
  verifiedAt: Date;
  verifiedById: string;
  remarks: string;
}