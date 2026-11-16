import type {
  DateOnlyString,
  IntegerString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  EContractVariationStatus,
  EContractVariationType,
  EMilestoneStatus,
  EStatus,
} from "../enums/delivery.enum.js";

/** `GET /contract/stages`, Project workspace. */
export interface ContractStage {
  id: string;
  contractId: string;
  name: string;
  description: string;
  sequence: number;
  status: EStatus;
  /** Share of the contract, in basis points (10,000 = 100%). */
  weightBps: number;
  plannedStartDate: DateOnlyString;
  plannedEndDate: DateOnlyString;
  actualStartDate: DateOnlyString | null;
  actualEndDate: DateOnlyString | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/milestones`, Project workspace. */
export interface Milestone {
  id: string;
  contractId: string;
  contractStageId: string;
  title: string;
  description: string;
  sequence: number;
  status: EMilestoneStatus;
  progressBps: number;
  weightBps: number;
  isPaymentMilestone: boolean;
  amountMinor: IntegerString;
  currencyCode: ECurrencyCode;
  dueDate: DateOnlyString;
  revisedDueDate: DateOnlyString | null;
  completedDate: DateOnlyString | null;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  approvedAt: TimestampString | null;
  approvedById: string | null;
  rejectionReason: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/variations`, Project workspace. */
export interface ContractVariation {
  id: string;
  contractId: string;
  raisedByPartyId: string;
  referenceNumber: string;
  title: string;
  description: string;
  variationType: EContractVariationType;
  status: EContractVariationStatus;
  /** Change to the contract value; negative for a reduction. */
  amountDeltaMinor: IntegerString;
  currencyCode: ECurrencyCode;
  timeExtensionDays: number;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  decidedAt: TimestampString | null;
  decidedById: string | null;
  decisionNote: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}
