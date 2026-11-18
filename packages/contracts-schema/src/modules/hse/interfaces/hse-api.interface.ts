import type {
  DateOnlyString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { MinorAmount } from "../../../common/money/minor-amount.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  EHseActionStatus,
  EHseCorrectiveActionPriority,
  EHseIncidentStatus,
  EHseIncidentType,
  EHseInspectionStatus,
  EHseInspectionType,
  EHseOverallResult,
  EHseSeverity,
} from "../enums/hse.enum.js";

/**
 * `GET /contract/hse/incidents`, HSE workspace.
 *
 * Deliberately lists no people involved. Their injury descriptions, body
 * parts affected, treatment, statements and phone numbers are sensitive
 * personal and medical data that need tighter access than ordinary HSE
 * records; no endpoint returns them until that access rule is defined.
 */
export interface HseIncident {
  id: string;
  contractId: string;
  contractSiteId: string;
  referenceNumber: string;
  incidentType: EHseIncidentType;
  severity: EHseSeverity;
  status: EHseIncidentStatus;
  occurredAt: TimestampString;
  locationDetail: string;
  description: string;
  immediateActionTaken: string;
  rootCause: string | null;
  investigationSummary: string | null;
  lostTimeDays: number;
  estimatedCostMinor: MinorAmount;
  currencyCode: ECurrencyCode;
  isNotifiable: boolean;
  authorityNotifiedAt: TimestampString | null;
  reportedAt: TimestampString;
  reportedById: string;
  investigatedById: string | null;
  closedAt: TimestampString | null;
  closedById: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/hse/inspections`, HSE workspace. */
export interface HseInspection {
  id: string;
  contractId: string;
  contractSiteId: string;
  /** The inspecting member, when the inspector is on a party team. */
  inspectorCompanyUserId: string | null;
  referenceNumber: string;
  inspectionType: EHseInspectionType;
  status: EHseInspectionStatus;
  scheduledDate: DateOnlyString;
  conductedAt: TimestampString | null;
  /** Set when an outside inspector carried out the inspection. */
  externalInspectorFirstName: string | null;
  externalInspectorLastName: string | null;
  externalInspectorOrganization: string | null;
  overallResult: EHseOverallResult | null;
  scoreBps: number | null;
  summary: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/hse/corrective-actions`, HSE workspace. */
export interface HseCorrectiveAction {
  id: string;
  contractId: string;
  /** What the action responds to: an incident or an inspection finding. */
  hseIncidentId: string | null;
  hseInspectionFindingId: string | null;
  assignedToCompanyUserId: string;
  description: string;
  priority: EHseCorrectiveActionPriority;
  status: EHseActionStatus;
  dueDate: DateOnlyString;
  completedAt: TimestampString | null;
  verifiedAt: TimestampString | null;
  verifiedById: string | null;
  closureNote: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}
