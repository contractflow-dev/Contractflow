import type {
  ECurrencyCode,
  EMilestoneStatus,
} from '@contractflow/contracts-schema';

export interface IMilestoneEntity {
  contractId: string;
  contractStageId: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  deliverables: string | null;
  sequence: number;
  status: EMilestoneStatus;
  progressBps: number;
  approvedBps: number;
  weightBps: number;
  targetQuantity: number | null;
  quantityUnit: string | null;
  approvedQuantity: number | null;
  isPaymentMilestone: boolean;
  amountMinor: string | null;
  currencyCode: ECurrencyCode | null;
  plannedStartDate: string | null;
  actualStartDate: string | null;
  dueDate: string;
  revisedDueDate: string | null;
  completedDate: string | null;
  submittedAt: Date | null;
  submittedById: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  rejectionReason: string | null;
  legacyStatus: string | null;
}
