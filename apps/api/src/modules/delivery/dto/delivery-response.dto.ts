import type {
  ContractStage as ContractStageResponse,
  ContractVariation as ContractVariationResponse,
  Milestone as MilestoneResponse,
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
import type { ContractVariation } from '../entities/contract-variation.entity';
import type { Milestone } from '../entities/milestone.entity';

export function toContractStageResponse(
  stage: ContractStage,
): ContractStageResponse {
  return {
    id: stage.id,
    contractId: stage.contractId,
    name: stage.name,
    description: stage.description,
    sequence: Number(stage.sequence),
    status: stage.status,
    weightBps: stage.weightBps,
    plannedStartDate: toDateOnly(stage.plannedStartDate),
    plannedEndDate: toDateOnly(stage.plannedEndDate),
    actualStartDate: toNullableDateOnly(stage.actualStartDate),
    actualEndDate: toNullableDateOnly(stage.actualEndDate),
    createdAt: toTimestamp(stage.createdAt),
    updatedAt: toTimestamp(stage.updatedAt),
  };
}

export function toMilestoneResponse(milestone: Milestone): MilestoneResponse {
  return {
    id: milestone.id,
    contractId: milestone.contractId,
    contractStageId: milestone.contractStageId,
    title: milestone.title,
    description: milestone.description,
    sequence: milestone.sequence,
    status: milestone.status,
    progressBps: milestone.progressBps,
    weightBps: milestone.weightBps,
    isPaymentMilestone: milestone.isPaymentMilestone,
    amountMinor: toIntegerString(milestone.amountMinor),
    currencyCode: milestone.currencyCode,
    dueDate: toDateOnly(milestone.dueDate),
    revisedDueDate: toNullableDateOnly(milestone.revisedDueDate),
    completedDate: toNullableDateOnly(milestone.completedDate),
    submittedAt: toNullableTimestamp(milestone.submittedAt),
    submittedById: toNullableText(milestone.submittedById),
    approvedAt: toNullableTimestamp(milestone.approvedAt),
    approvedById: toNullableText(milestone.approvedById),
    rejectionReason: toNullableText(milestone.rejectionReason),
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
