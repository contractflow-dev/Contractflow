import {
  EMilestoneOutstandingItemStatus,
  EMilestoneStatus,
  type ContractStage as ContractStageResponse,
  type ContractVariation as ContractVariationResponse,
  type Milestone as MilestoneResponse,
  type MilestoneDecision as MilestoneDecisionResponse,
  type MilestoneOutstandingItem as MilestoneOutstandingItemResponse,
  type MilestoneSubmission as MilestoneSubmissionResponse,
} from '@contractflow/contracts-schema';
import {
  toDateOnly,
  toIntegerString,
  toNullableDateOnly,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from '../../../common/dto/response-values';
import type { ContractStage } from '../entities/contract-stage.entity';
import type { MilestoneDecision } from '../entities/milestone-decision.entity';
import type { MilestoneOutstandingItem } from '../entities/milestone-outstanding-item.entity';
import type { ISubmissionHistoryRecord } from '../interface/milestone-workflow-persistence.interface';
import type { ContractVariation } from '../entities/contract-variation.entity';
import type { Milestone } from '../entities/milestone.entity';

export function toContractStageResponse(
  stage: ContractStage,
  progressBps = 0,
): ContractStageResponse {
  return {
    id: stage.id,
    contractId: stage.contractId,
    stageCode: stage.stageCode ?? null,
    name: stage.name,
    description: toNullableText(stage.description),
    sequence: Number(stage.sequence),
    status: stage.status,
    isApplicable: stage.isApplicable ?? true,
    applicabilityReason: stage.applicabilityReason ?? null,
    weightBps: stage.weightBps,
    progressBps,
    plannedStartDate: toDateOnly(stage.plannedStartDate),
    plannedEndDate: toDateOnly(stage.plannedEndDate),
    actualStartDate: toNullableDateOnly(stage.actualStartDate),
    actualEndDate: toNullableDateOnly(stage.actualEndDate),
    createdAt: toTimestamp(stage.createdAt),
    updatedAt: toTimestamp(stage.updatedAt),
  };
}

/** Today as a UTC calendar day, the day overdue milestones are judged by. */
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isMilestoneOverdue(
  milestone: Milestone,
  today: string,
): boolean {
  if (
    milestone.status === EMilestoneStatus.APPROVED ||
    milestone.status === EMilestoneStatus.CANCELLED
  ) {
    return false;
  }
  const due = toDateOnly(milestone.revisedDueDate ?? milestone.dueDate);
  return due < today;
}

export function toMilestoneResponse(
  milestone: Milestone,
  today = utcToday(),
): MilestoneResponse {
  return {
    id: milestone.id,
    contractId: milestone.contractId,
    contractStageId: milestone.contractStageId,
    title: milestone.title,
    description: toNullableText(milestone.description),
    acceptanceCriteria: toNullableText(milestone.acceptanceCriteria),
    deliverables: toNullableText(milestone.deliverables),
    sequence: milestone.sequence,
    status: milestone.status,
    progressBps: milestone.progressBps,
    approvedBps: milestone.approvedBps ?? 0,
    weightBps: milestone.weightBps,
    targetQuantity: milestone.targetQuantity ?? null,
    quantityUnit: toNullableText(milestone.quantityUnit),
    approvedQuantity: milestone.approvedQuantity ?? null,
    isPaymentMilestone: milestone.isPaymentMilestone,
    amountMinor:
      milestone.amountMinor === null || milestone.amountMinor === undefined
        ? null
        : toIntegerString(milestone.amountMinor),
    currencyCode: milestone.currencyCode ?? null,
    plannedStartDate: toNullableDateOnly(milestone.plannedStartDate),
    actualStartDate: toNullableDateOnly(milestone.actualStartDate),
    dueDate: toDateOnly(milestone.dueDate),
    revisedDueDate: toNullableDateOnly(milestone.revisedDueDate),
    completedDate: toNullableDateOnly(milestone.completedDate),
    isOverdue: isMilestoneOverdue(milestone, today),
    submittedAt: toNullableTimestamp(milestone.submittedAt),
    submittedById: toNullableText(milestone.submittedById),
    approvedAt: toNullableTimestamp(milestone.approvedAt),
    approvedById: toNullableText(milestone.approvedById),
    rejectionReason: toNullableText(milestone.rejectionReason),
    legacyStatus: milestone.legacyStatus ?? null,
    createdAt: toTimestamp(milestone.createdAt),
    updatedAt: toTimestamp(milestone.updatedAt),
  };
}

export function toContractVariationResponse(
  variation: ContractVariation,
): ContractVariationResponse {
  return {
    id: variation.id,
    contractId: variation.contractId,
    raisedByPartyId: variation.raisedByPartyId,
    referenceNumber: variation.referenceNumber,
    title: variation.title,
    description: variation.description,
    variationType: variation.variationType,
    status: variation.status,
    amountDeltaMinor: toIntegerString(variation.amountDeltaMinor),
    currencyCode: variation.currencyCode,
    timeExtensionDays: variation.timeExtensionDays,
    submittedAt: toNullableTimestamp(variation.submittedAt),
    submittedById: toNullableText(variation.submittedById),
    decidedAt: toNullableTimestamp(variation.decidedAt),
    decidedById: toNullableText(variation.decidedById),
    decisionNote: toNullableText(variation.decisionNote),
    createdAt: toTimestamp(variation.createdAt),
    updatedAt: toTimestamp(variation.updatedAt),
  };
}

export function toMilestoneDecisionResponse(
  decision: MilestoneDecision,
  items: { raised: Map<string, string[]>; accepted: Map<string, string[]> },
): MilestoneDecisionResponse {
  return {
    id: decision.id,
    milestoneId: decision.milestoneId,
    submissionId: decision.submissionId,
    decision: decision.decision,
    reason: toNullableText(decision.reason),
    approvedBps: decision.approvedBps,
    cumulativeApprovedBps: decision.cumulativeApprovedBps,
    approvedWork: toNullableText(decision.approvedWork),
    approvedQuantity: decision.approvedQuantity ?? null,
    decidedById: decision.decidedById,
    decidedAt: toTimestamp(decision.decidedAt),
    raisedItemIds: items.raised.get(decision.id) ?? [],
    acceptedItemIds: items.accepted.get(decision.id) ?? [],
  };
}

export function toMilestoneSubmissionResponse(
  record: ISubmissionHistoryRecord,
  items: { raised: Map<string, string[]>; accepted: Map<string, string[]> },
): MilestoneSubmissionResponse {
  const { submission } = record;
  return {
    id: submission.id,
    milestoneId: submission.milestoneId,
    sequence: submission.sequence,
    submissionType: submission.submissionType,
    previousDecisionId: submission.previousDecisionId ?? null,
    submittedById: submission.submittedById,
    submittedAt: toTimestamp(submission.submittedAt),
    notes: submission.notes,
    reportedProgressBps: submission.reportedProgressBps ?? null,
    evidence: record.evidence.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      title: row.title,
      fileName: row.fileName,
      versionNumber: row.versionNumber,
      caption: toNullableText(row.caption),
    })),
    addressedItemIds: record.addressedItemIds,
    decision: record.decision
      ? toMilestoneDecisionResponse(record.decision, items)
      : null,
  };
}

export function toMilestoneOutstandingItemResponse(
  item: MilestoneOutstandingItem,
  addressedBySubmissionIds: string[],
): MilestoneOutstandingItemResponse {
  return {
    id: item.id,
    milestoneId: item.milestoneId,
    description: item.description,
    quantity: item.quantity ?? null,
    status: item.acceptedByDecisionId
      ? EMilestoneOutstandingItemStatus.ACCEPTED
      : EMilestoneOutstandingItemStatus.OUTSTANDING,
    raisedByDecisionId: item.raisedByDecisionId,
    acceptedByDecisionId: item.acceptedByDecisionId ?? null,
    acceptedAt: toNullableTimestamp(item.acceptedAt),
    addressedBySubmissionIds,
    createdAt: toTimestamp(item.createdAt),
  };
}
