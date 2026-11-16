import type {
  ComplianceRecord as ComplianceRecordResponse,
  ComplianceRequirement as ComplianceRequirementResponse,
} from '@contractflow/contracts-schema';
import {
  toDateOnly,
  toNullable,
  toNullableDateOnly,
  toNullableIntegerString,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from '../../../common/dto/response-values';
import type { ComplianceRecord } from '../entities/compliance-record.entity';
import type { ComplianceRequirement } from '../entities/compliance-requirement.entity';

export function toComplianceRequirementResponse(
  requirement: ComplianceRequirement,
): ComplianceRequirementResponse {
  return {
    id: requirement.id,
    contractId: requirement.contractId,
    name: requirement.name,
    description: requirement.description,
    category: requirement.category,
    appliesToPartyType: requirement.appliesToPartyType,
    isMandatory: requirement.isMandatory,
    frequency: requirement.frequency,
    firstDueDate: toDateOnly(requirement.firstDueDate),
    createdAt: toTimestamp(requirement.createdAt),
    updatedAt: toTimestamp(requirement.updatedAt),
  };
}

export function toComplianceRecordResponse(
  record: ComplianceRecord,
): ComplianceRecordResponse {
  return {
    id: record.id,
    contractId: record.contractId,
    complianceRequirementId: record.complianceRequirementId,
    contractPartyId: record.contractPartyId,
    referenceNumber: record.referenceNumber,
    issuingAuthority: record.issuingAuthority,
    issueDate: toDateOnly(record.issueDate),
    expiryDate: toNullableDateOnly(record.expiryDate),
    coveredAmountMinor: toNullableIntegerString(record.coveredAmountMinor),
    currencyCode: toNullable(record.currencyCode),
    status: record.status,
    verifiedAt: toNullableTimestamp(record.verifiedAt),
    verifiedById: toNullableText(record.verifiedById),
    remarks: toNullableText(record.remarks),
    createdAt: toTimestamp(record.createdAt),
    updatedAt: toTimestamp(record.updatedAt),
  };
}
