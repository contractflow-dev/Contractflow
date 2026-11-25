import {
  EClientContractRole,
  EContractStatus,
  EContractorContractRole,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EPartyType,
  EStatus,
  type ContractRole,
  type ContractStage,
  type Milestone,
} from "@contractflow/contracts-schema";
import { humanizeEnumValue } from "@/lib/format";

/**
 * What the Project workspace offers the viewer. It mirrors the API's rules
 * (MilestoneWorkflowService) only to decide which controls to show: the API
 * checks the role, the side of the contract and the contract's status again
 * on every change, and its 403 or 409 answer is shown when it refuses.
 */
export interface ProjectPermissions {
  /** Client Project Manager on the client side: plans and decides. */
  isPlanner: boolean;
  /** Contractor Project Lead on a contractor-side party: starts and submits. */
  isSubmitter: boolean;
  /** Create and change stages and milestones. */
  canPlan: boolean;
  /** Start, hold, resume and complete stages; decide on submissions. */
  canOperateAsPlanner: boolean;
  /** Start milestones and submit work. */
  canSubmit: boolean;
  /**
   * Why the contract's status limits changes, or null when it doesn't. Shown
   * once, above the workspace's content.
   */
  statusNotice: string | null;
}

/** The actions each contract status allows (approved 22 November 2026, rule 6). */
const ALLOWED: Record<
  EContractStatus,
  { planning: boolean; operation: boolean }
> = {
  [EContractStatus.DRAFT]: { planning: true, operation: false },
  [EContractStatus.ACTIVE]: { planning: true, operation: true },
  [EContractStatus.SUSPENDED]: { planning: false, operation: false },
  [EContractStatus.COMPLETED]: { planning: false, operation: false },
};

export function projectPermissions({
  roles,
  partyType,
  contractStatus,
  archived,
}: {
  /** The viewer's active Project workspace roles. */
  roles: readonly ContractRole[];
  /** The viewer's company's party on the contract. */
  partyType: EPartyType | `${EPartyType}` | null | undefined;
  contractStatus: EContractStatus;
  /** The contract is archived (soft-deleted). */
  archived: boolean;
}): ProjectPermissions {
  const clientSide = partyType === EPartyType.AWARDING;
  const isPlanner =
    clientSide && roles.includes(EClientContractRole.CLIENT_PROJECT_MANAGER);
  const isSubmitter =
    !!partyType &&
    !clientSide &&
    roles.includes(EContractorContractRole.CONTRACTOR_PROJECT_LEAD);
  const allowed = archived
    ? { planning: false, operation: false }
    : (ALLOWED[contractStatus] ?? { planning: false, operation: false });
  return {
    isPlanner,
    isSubmitter,
    canPlan: isPlanner && allowed.planning,
    canOperateAsPlanner: isPlanner && allowed.operation,
    canSubmit: isSubmitter && allowed.operation,
    statusNotice: archived
      ? "This contract is archived: its stages and milestones can be read but not changed."
      : contractStatus === EContractStatus.DRAFT
        ? "This contract is still a draft: stages and milestones can be planned, but work can only be started, submitted or reviewed once it is active."
        : contractStatus === EContractStatus.SUSPENDED ||
            contractStatus === EContractStatus.COMPLETED
          ? `This contract is ${contractStatus}: its stages and milestones can be read but not changed.`
          : null,
  };
}

// --- Days --------------------------------------------------------------------

/**
 * Today's calendar day in the contract's time zone, as `YYYY-MM-DD`, the day
 * the API uses for overdue and for the dates it records. A time zone the
 * browser doesn't know falls back to UTC, as the API's does.
 */
export function contractToday(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const part = (type: string) => parts.find((p) => p.type === type)?.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    } catch {
      // An unknown time zone: UTC below.
    }
  }
  return now.toISOString().slice(0, 10);
}

/** A `YYYY-MM-DD` day moved by whole days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The due date that counts: the revised one, else the original. */
export function effectiveDueDate(
  milestone: Pick<Milestone, "dueDate" | "revisedDueDate">,
): string {
  return milestone.revisedDueDate ?? milestone.dueDate;
}

// --- Stages --------------------------------------------------------------------

export type StageTransition = "start" | "hold" | "resume" | "complete";

export const STAGE_TRANSITIONS: Record<
  StageTransition,
  {
    to: EStatus.IN_PROGRESS | EStatus.ON_HOLD | EStatus.COMPLETED;
    label: string;
    /** The confirmation once it is done. */
    done: string;
    /** The API refuses it without a reason. */
    needsReason: boolean;
    /** It records an actual date, which can be given. */
    recordsDate: boolean;
  }
> = {
  start: {
    to: EStatus.IN_PROGRESS,
    label: "Start stage",
    done: "Stage started",
    needsReason: false,
    recordsDate: true,
  },
  hold: {
    to: EStatus.ON_HOLD,
    label: "Put on hold",
    done: "Stage put on hold",
    needsReason: true,
    recordsDate: false,
  },
  resume: {
    to: EStatus.IN_PROGRESS,
    label: "Resume stage",
    done: "Stage resumed",
    needsReason: true,
    recordsDate: false,
  },
  complete: {
    to: EStatus.COMPLETED,
    label: "Complete stage",
    done: "Stage completed",
    needsReason: false,
    recordsDate: true,
  },
};

/** The moves the API allows from a stage's status. */
export function stageTransitions(status: EStatus): StageTransition[] {
  switch (status) {
    case EStatus.PLANNED:
      return ["start"];
    case EStatus.IN_PROGRESS:
      return ["hold", "complete"];
    case EStatus.ON_HOLD:
      return ["resume"];
    default:
      return [];
  }
}

/** Completed and cancelled stages take no planning changes or milestones. */
export function isStageClosed(stage: Pick<ContractStage, "status">): boolean {
  return (
    stage.status === EStatus.COMPLETED || stage.status === EStatus.CANCELLED
  );
}

/** A stage's work can't be started or submitted while on hold or closed. */
export function stageBlocksWork(
  stage: Pick<ContractStage, "status"> | null | undefined,
): string | null {
  if (!stage) return null;
  if (stage.status === EStatus.ON_HOLD) {
    return "This milestone's stage is on hold; work can't be started or submitted until it resumes.";
  }
  if (isStageClosed(stage)) return "This milestone's stage is closed.";
  return null;
}

/**
 * The milestones whose planned start or due date would fall outside these
 * stage dates: the API then needs a date override reason.
 */
export function milestonesOutsideDates(
  milestones: readonly Pick<
    Milestone,
    "id" | "title" | "plannedStartDate" | "dueDate"
  >[],
  plannedStartDate: string,
  plannedEndDate: string,
) {
  return milestones.filter(
    (milestone) =>
      datesOutsideStage({ plannedStartDate, plannedEndDate }, milestone)
        .length > 0,
  );
}

/** Which of a milestone's planned dates fall outside its stage's (as the API checks). */
export function datesOutsideStage(
  stage: Pick<ContractStage, "plannedStartDate" | "plannedEndDate">,
  milestone: Pick<Milestone, "plannedStartDate" | "dueDate">,
): Array<"plannedStartDate" | "dueDate"> {
  const within = (day: string) =>
    day >= stage.plannedStartDate && day <= stage.plannedEndDate;
  const problems: Array<"plannedStartDate" | "dueDate"> = [];
  if (milestone.plannedStartDate && !within(milestone.plannedStartDate)) {
    problems.push("plannedStartDate");
  }
  if (milestone.dueDate && !within(milestone.dueDate)) {
    problems.push("dueDate");
  }
  return problems;
}

/** The API refused dates outside the stage and asks for an override reason. */
export function asksForDateOverride(message: string | null): boolean {
  return !!message && message.includes("dateOverrideReason");
}

// --- Milestones ------------------------------------------------------------------

/** Statuses from which the contractor may submit (as the API allows). */
const SUBMITTABLE: readonly EMilestoneStatus[] = [
  EMilestoneStatus.PLANNED,
  EMilestoneStatus.IN_PROGRESS,
  EMilestoneStatus.REJECTED,
  EMilestoneStatus.PARTIALLY_APPROVED,
];

export function isSubmittable(status: EMilestoneStatus): boolean {
  return SUBMITTABLE.includes(status);
}

/** Approved milestones can no longer change at all. */
export function isMilestoneLocked(
  milestone: Pick<Milestone, "status">,
): boolean {
  return milestone.status === EMilestoneStatus.APPROVED;
}

/**
 * The scope (title, description, criteria, deliverables, target, weight,
 * payment) is fixed from the first submission; `submittedAt` is set by it.
 */
export function isScopeFrozen(
  milestone: Pick<Milestone, "submittedAt">,
): boolean {
  return milestone.submittedAt !== null;
}

export const SUBMISSION_TYPE_LABEL: Record<EMilestoneSubmissionType, string> = {
  [EMilestoneSubmissionType.INITIAL]: "First submission",
  [EMilestoneSubmissionType.RESUBMISSION]: "Resubmission",
  [EMilestoneSubmissionType.OUTSTANDING_WORK]: "Outstanding work",
};

export const DECISION_LABEL: Record<EMilestoneDecisionType, string> = {
  [EMilestoneDecisionType.APPROVED]: "Approved",
  [EMilestoneDecisionType.PARTIALLY_APPROVED]: "Partially approved",
  [EMilestoneDecisionType.REJECTED]: "Rejected",
};

/** The statuses the API currently gives milestones, for the status filter. */
export const MILESTONE_FILTER_STATUSES: readonly EMilestoneStatus[] = [
  EMilestoneStatus.PLANNED,
  EMilestoneStatus.IN_PROGRESS,
  EMilestoneStatus.PENDING_APPROVAL,
  EMilestoneStatus.PARTIALLY_APPROVED,
  EMilestoneStatus.REJECTED,
  EMilestoneStatus.APPROVED,
];

/**
 * A legacy status kept from before the approval workflow (such as `at_risk`),
 * shown as context beside the current status, never in its place.
 */
export function legacyStatusLabel(legacyStatus: string | null): string | null {
  return legacyStatus
    ? `Earlier status: ${humanizeEnumValue(legacyStatus)}`
    : null;
}

/**
 * Who acted, from the membership ids the API returns: "You" for the viewer,
 * otherwise the side's role. The API doesn't name the other company's members.
 */
export function actorLabel(
  membershipId: string,
  viewerMembershipId: string | undefined,
  role: "Contractor Project Lead" | "Client Project Manager",
): string {
  return membershipId === viewerMembershipId ? "You" : role;
}

// --- Decisions ---------------------------------------------------------------------

export const FULL_BPS = 10_000;

/**
 * The share a partial approval accepts when the milestone has a target
 * quantity: the API requires the accepted share to follow the quantity,
 * `floor(accepted × 10,000 / target)` overall.
 */
export function shareForQuantity({
  targetQuantity,
  approvedQuantity,
  approvedBps,
  quantity,
}: {
  targetQuantity: number;
  /** Accepted before this decision. */
  approvedQuantity: number | null;
  approvedBps: number;
  /** Accepted by this decision. */
  quantity: number;
}): number {
  const cumulative = (approvedQuantity ?? 0) + quantity;
  return Math.floor((cumulative * FULL_BPS) / targetQuantity) - approvedBps;
}
