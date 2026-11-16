import type {
  DateOnlyString,
  IntegerString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  EAppliesToParty,
  EComplianceCategory,
  EComplianceFrequency,
  EComplianceRecordStatus,
} from "../enums/compliance.enum.js";

/** `GET /contract/compliance/requirements`. */
export interface ComplianceRequirement {
  id: string;
  contractId: string;
  name: string;
  description: string;
  category: EComplianceCategory;
  appliesToPartyType: EAppliesToParty;
  isMandatory: boolean;
  frequency: EComplianceFrequency;
  firstDueDate: DateOnlyString;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/compliance/records`. */
export interface ComplianceRecord {
  id: string;
  contractId: string;
  complianceRequirementId: string;
  contractPartyId: string;
  referenceNumber: string;
  issuingAuthority: string;
  issueDate: DateOnlyString;
  expiryDate: DateOnlyString | null;
  coveredAmountMinor: IntegerString | null;
  currencyCode: ECurrencyCode | null;
  status: EComplianceRecordStatus;
  verifiedAt: TimestampString | null;
  verifiedById: string | null;
  remarks: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}
