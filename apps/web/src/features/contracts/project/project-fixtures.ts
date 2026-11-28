import {
  ECurrencyCode,
  EContractStatus,
  EContractType,
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
  EMilestoneDecisionType,
  EMilestoneOutstandingItemStatus,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EStatus,
  type Contract,
  type ContractStage,
  type DocumentSummary,
  type IPaginatedResponse,
  type Milestone,
  type MilestoneDecision,
  type MilestoneOutstandingItem,
  type MilestoneSubmission,
} from "@contractflow/contracts-schema";
import type { ProjectPermissions } from "./project-rules";
import type { ProjectContext } from "./project-ui";

/** Test data shaped exactly as the API returns it. */

export const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Streetlight installation",
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.ACTIVE,
  currencyCode: ECurrencyCode.NGN,
  timezone: "Africa/Lagos",
  deletedAt: null,
} as Contract;

export const noPermissions: ProjectPermissions = {
  isPlanner: false,
  isSubmitter: false,
  canPlan: false,
  canChangePlan: false,
  canOperateAsPlanner: false,
  canSubmit: false,
  statusNotice: null,
};

export const plannerPermissions: ProjectPermissions = {
  ...noPermissions,
  isPlanner: true,
  canPlan: true,
  // The fixture contract predates lifecycles, so its plan stays editable.
  canChangePlan: true,
  canOperateAsPlanner: true,
};

export const submitterPermissions: ProjectPermissions = {
  ...noPermissions,
  isSubmitter: true,
  canSubmit: true,
};

export function projectContext(
  permissions: ProjectPermissions,
  overrides: Partial<ProjectContext> = {},
): ProjectContext {
  return {
    companyId: "company-1",
    contractId: "contract-1",
    contract,
    permissions,
    viewerMembershipId: "member-self",
    ...overrides,
  };
}

export const stage: ContractStage = {
  id: "01J0000000000000000000STG1",
  contractId: "contract-1",
  stageCode: null,
  name: "Civil works",
  description: "Foundations and ducting",
  sequence: 1,
  status: EStatus.IN_PROGRESS,
  isApplicable: true,
  applicabilityReason: null,
  weightBps: 4000,
  progressBps: 2500,
  plannedStartDate: "2027-01-01",
  plannedEndDate: "2027-06-30",
  actualStartDate: "2027-01-04",
  actualEndDate: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

export const milestone: Milestone = {
  id: "01J0000000000000000000MS01",
  contractId: "contract-1",
  contractStageId: stage.id,
  title: "Install 100 streetlights",
  description: "Along the main road",
  acceptanceCriteria: "All lights working at night inspection",
  deliverables: "Inspection report",
  sequence: 1,
  status: EMilestoneStatus.IN_PROGRESS,
  progressBps: 0,
  approvedBps: 0,
  weightBps: 5000,
  targetQuantity: null,
  quantityUnit: null,
  approvedQuantity: null,
  isPaymentMilestone: false,
  amountMinor: null,
  currencyCode: null,
  plannedStartDate: "2027-02-01",
  actualStartDate: "2027-02-03",
  dueDate: "2027-03-31",
  revisedDueDate: null,
  completedDate: null,
  isOverdue: false,
  submittedAt: null,
  submittedById: null,
  approvedAt: null,
  approvedById: null,
  rejectionReason: null,
  legacyStatus: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

export const evidence = {
  id: "evidence-1",
  documentId: "01J0000000000000000000DOC1",
  documentVersionId: "01J0000000000000000000VER1",
  title: "Night inspection report",
  fileName: "inspection.pdf",
  versionNumber: 2,
  caption: "Signed by the engineer",
};

export function decision(
  overrides: Partial<MilestoneDecision> = {},
): MilestoneDecision {
  return {
    id: "01J0000000000000000000DEC1",
    milestoneId: milestone.id,
    submissionId: "01J0000000000000000000SUB1",
    decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
    reason: "Twenty lights are not working",
    approvedBps: 8000,
    cumulativeApprovedBps: 8000,
    approvedWork: "Eighty lights accepted",
    approvedQuantity: null,
    decidedById: "member-client",
    decidedAt: "2027-03-10T10:00:00.000Z",
    raisedItemIds: ["01J0000000000000000000ITM1"],
    acceptedItemIds: [],
    ...overrides,
  };
}

export function submission(
  overrides: Partial<MilestoneSubmission> = {},
): MilestoneSubmission {
  return {
    id: "01J0000000000000000000SUB1",
    milestoneId: milestone.id,
    sequence: 1,
    submissionType: EMilestoneSubmissionType.INITIAL,
    previousDecisionId: null,
    submittedById: "member-self",
    submittedAt: "2027-03-01T09:00:00.000Z",
    notes: "All lights installed",
    reportedProgressBps: 10000,
    evidence: [evidence],
    addressedItemIds: [],
    decision: null,
    ...overrides,
  };
}

export function outstandingItem(
  overrides: Partial<MilestoneOutstandingItem> = {},
): MilestoneOutstandingItem {
  return {
    id: "01J0000000000000000000ITM1",
    milestoneId: milestone.id,
    description: "Repair twenty lights",
    quantity: null,
    status: EMilestoneOutstandingItemStatus.OUTSTANDING,
    raisedByDecisionId: "01J0000000000000000000DEC1",
    acceptedByDecisionId: null,
    acceptedAt: null,
    addressedBySubmissionIds: [],
    createdAt: "2027-03-10T10:00:00.000Z",
    ...overrides,
  };
}

export function document(
  overrides: Partial<DocumentSummary> = {},
): DocumentSummary {
  return {
    id: "01J0000000000000000000DOC1",
    contractId: "contract-1",
    ownerCompanyId: "company-1",
    title: "Night inspection report",
    documentNumber: "RPT-1",
    category: EDocumentCategory.REPORT,
    visibility: EDocumentVisibility.PUBLIC,
    status: EDocumentStatus.VALID,
    createdAt: "2027-03-01T00:00:00.000Z",
    updatedAt: "2027-03-01T00:00:00.000Z",
    currentVersion: {
      id: "01J0000000000000000000VER1",
      versionNumber: 1,
      fileName: "inspection.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      checksumSha256: "a".repeat(64),
      changeNote: "",
      uploadStatus: EDocumentUploadStatus.AVAILABLE,
      uploadedById: "member-self",
      uploadedAt: "2027-03-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

export function page<T>(
  data: T[],
  totalItems = data.length,
): IPaginatedResponse<T> {
  return {
    data,
    meta: {
      totalItems,
      itemCount: data.length,
      itemsPerPage: 20,
      totalPages: Math.max(1, Math.ceil(totalItems / 20)),
      currentPage: 1,
    },
  };
}

/** An RTK Query hook result that has loaded. */
export const loaded = <T>(currentData: T) => ({
  currentData,
  data: currentData,
  error: undefined,
  isLoading: false,
  isFetching: false,
  refetch: () => undefined,
});

/** A mutation hook's trigger and state; `trigger` resolves to `result`. */
export function mutation(
  trigger: (...args: unknown[]) => unknown,
  state: Record<string, unknown> = {},
) {
  return [trigger, { isLoading: false, error: undefined, ...state }] as const;
}
