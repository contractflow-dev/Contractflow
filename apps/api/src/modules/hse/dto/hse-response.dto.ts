import type {
  HseCorrectiveAction as HseCorrectiveActionResponse,
  HseIncident as HseIncidentResponse,
  HseInspection as HseInspectionResponse,
} from '@contractflow/contracts-schema';
import {
  toDateOnly,
  toIntegerString,
  toNullable,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from '../../../common/dto/response-values';
import type { HseCorrectiveAction } from '../entities/hse-corrective-action.entity';
import type { HseIncident } from '../entities/hse-incident.entity';
import type { HseInspection } from '../entities/hse-inspection.entity';

/**
 * Copies named fields only, so the people involved in an incident (with
 * their injury descriptions, treatment, statements and phone numbers) are
 * never returned, even if a query later loads them onto the entity.
 */
export function toHseIncidentResponse(
  incident: HseIncident,
): HseIncidentResponse {
  return {
    id: incident.id,
    contractId: incident.contractId,
    contractSiteId: incident.contractSiteId,
    referenceNumber: incident.referenceNumber,
    incidentType: incident.incidentType,
    severity: incident.severity,
    status: incident.status,
    occurredAt: toTimestamp(incident.occurredAt),
    locationDetail: incident.locationDetail,
    description: incident.description,
    immediateActionTaken: incident.immediateActionTaken,
    rootCause: toNullableText(incident.rootCause),
    investigationSummary: toNullableText(incident.investigationSummary),
    lostTimeDays: incident.lostTimeDays,
    estimatedCostMinor: toIntegerString(incident.estimatedCostMinor),
    currencyCode: incident.currencyCode,
    isNotifiable: incident.isNotifiable,
    authorityNotifiedAt: toNullableTimestamp(incident.authorityNotifiedAt),
    reportedAt: toTimestamp(incident.reportedAt),
    reportedById: incident.reportedById,
    investigatedById: toNullableText(incident.investigatedById),
    closedAt: toNullableTimestamp(incident.closedAt),
    closedById: toNullableText(incident.closedById),
    createdAt: toTimestamp(incident.createdAt),
    updatedAt: toTimestamp(incident.updatedAt),
  };
}

export function toHseInspectionResponse(
  inspection: HseInspection,
): HseInspectionResponse {
  return {
    id: inspection.id,
    contractId: inspection.contractId,
    contractSiteId: inspection.contractSiteId,
    inspectorCompanyUserId: toNullableText(inspection.inspectorCompanyUserId),
    referenceNumber: inspection.referenceNumber,
    inspectionType: inspection.inspectionType,
    status: inspection.status,
    scheduledDate: toDateOnly(inspection.scheduledDate),
    conductedAt: toNullableTimestamp(inspection.conductedAt),
    externalInspectorFirstName: toNullableText(
      inspection.externalInspectorFirstName,
    ),
    externalInspectorLastName: toNullableText(
      inspection.externalInspectorLastName,
    ),
    externalInspectorOrganization: toNullableText(
      inspection.externalInspectorOrganization,
    ),
    overallResult: toNullable(inspection.overallResult),
    scoreBps: toNullable(inspection.scoreBps),
    summary: toNullableText(inspection.summary),
    createdAt: toTimestamp(inspection.createdAt),
    updatedAt: toTimestamp(inspection.updatedAt),
  };
}

export function toHseCorrectiveActionResponse(
  action: HseCorrectiveAction,
): HseCorrectiveActionResponse {
  return {
    id: action.id,
    contractId: action.contractId,
    hseIncidentId: toNullableText(action.hseIncidentId),
    hseInspectionFindingId: toNullableText(action.hseInspectionFindingId),
    assignedToCompanyUserId: action.assignedToCompanyUserId,
    description: action.description,
    priority: action.priority,
    status: action.status,
    dueDate: toDateOnly(action.dueDate),
    completedAt: toNullableTimestamp(action.completedAt),
    verifiedAt: toNullableTimestamp(action.verifiedAt),
    verifiedById: toNullableText(action.verifiedById),
    closureNote: toNullableText(action.closureNote),
    createdAt: toTimestamp(action.createdAt),
    updatedAt: toTimestamp(action.updatedAt),
  };
}
