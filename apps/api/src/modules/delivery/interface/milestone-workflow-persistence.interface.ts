import type { ContractRole } from '@contractflow/contracts-schema';
import type { ActivityEntryInput } from '../../../common/application/activity-entry';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import type { ContractParty } from '../../contract/entities/contract-party.entity';
import type { Contract } from '../../contract/entities/contract.entity';
import type { CompanyUser } from '../../identity/entities/company-user.entity';
import type { ContractStage } from '../entities/contract-stage.entity';
import type { ContractStageHistory } from '../entities/contract-stage-history.entity';
import type { MilestoneDecision } from '../entities/milestone-decision.entity';
import type { MilestoneOutstandingItem } from '../entities/milestone-outstanding-item.entity';
import type { MilestoneSubmissionEvidence } from '../entities/milestone-submission-evidence.entity';
import type { MilestoneSubmissionItem } from '../entities/milestone-submission-item.entity';
import type { MilestoneSubmission } from '../entities/milestone-submission.entity';
import type { Milestone } from '../entities/milestone.entity';
import type { IMilestoneListFilters } from '../repositories/milestone.repository';

export const MILESTONE_WORKFLOW_UNIT_OF_WORK = Symbol(
  'MILESTONE_WORKFLOW_UNIT_OF_WORK',
);
export const MILESTONE_WORKFLOW_READER = Symbol('MILESTONE_WORKFLOW_READER');

/**
 * Every operation takes the scope `ContractAccessService.authorize` returned:
 * the contract, and the caller's company, which must be a party to it.
 */
type Scope = IContractCompanyScope;

/** A contract document offered as evidence, with its current available version. */
export interface IEvidenceCandidate {
  documentId: string;
  ownerCompanyId: string;
  category: string;
  visibility: string;
  title: string;
  /** The latest version whose upload is available; null if none is. */
  currentVersionId: string | null;
}

/** One evidence file of a submission, with its document's title and version. */
export interface IEvidenceRecord {
  id: string;
  submissionId: string;
  documentId: string;
  documentVersionId: string;
  caption: string | null;
  title: string;
  fileName: string;
  versionNumber: number;
}

/**
 * The operations of one Stages and Milestones transaction. They are
 * implemented by the module repositories, all bound to that transaction.
 */
export interface IMilestoneWorkflowContext {
  memberships: {
    /** The caller's active membership, locked so it can't end mid-operation. */
    findActiveForUpdate(
      scope: Scope,
      userId: string,
    ): Promise<CompanyUser | null>;
  };
  parties: {
    /** The scope company's party on the contract, share-locked. */
    findOwnForShare(scope: Scope): Promise<ContractParty | null>;
  };
  roleAssignments: {
    hasActiveRoleForShare(
      scope: Scope,
      companyUserId: string,
      contractPartyId: string,
      role: ContractRole,
    ): Promise<boolean>;
  };
  contracts: {
    /**
     * The contract if it isn't archived and the member can see it, locked:
     * `share` so it isn't archived meanwhile, `update` to serialize planning.
     */
    findActiveForLock(
      scope: Scope,
      companyUserId: string,
      mode: 'share' | 'update',
    ): Promise<Contract | null>;
  };
  stages: {
    findForUpdate(scope: Scope, stageId: string): Promise<ContractStage | null>;
    findForShare(scope: Scope, stageId: string): Promise<ContractStage | null>;
    totalWeight(scope: Scope, excludeStageId?: string): Promise<number>;
    nextSequence(scope: Scope): Promise<number>;
    append(scope: Scope, data: Partial<ContractStage>): Promise<ContractStage>;
    update(
      scope: Scope,
      stageId: string,
      changes: Partial<ContractStage>,
    ): Promise<ContractStage>;
  };
  milestones: {
    findForUpdate(scope: Scope, milestoneId: string): Promise<Milestone | null>;
    totalWeightInStage(
      scope: Scope,
      stageId: string,
      excludeMilestoneId?: string,
    ): Promise<number>;
    nextSequenceInStage(scope: Scope, stageId: string): Promise<number>;
    countNotApprovedInStage(scope: Scope, stageId: string): Promise<number>;
    /** The stage's milestones that aren't cancelled. */
    countActiveInStage(scope: Scope, stageId: string): Promise<number>;
    /**
     * How many of the stage's milestones (not cancelled) have a planned start
     * or due date outside `start`..`end`.
     */
    countOutsideDates(
      scope: Scope,
      stageId: string,
      start: string,
      end: string,
    ): Promise<number>;
    append(scope: Scope, data: Partial<Milestone>): Promise<Milestone>;
    update(
      scope: Scope,
      milestoneId: string,
      changes: Partial<Milestone>,
    ): Promise<Milestone>;
  };
  submissions: {
    countForMilestone(scope: Scope, milestoneId: string): Promise<number>;
    latestForMilestone(
      scope: Scope,
      milestoneId: string,
    ): Promise<MilestoneSubmission | null>;
    findInMilestone(
      scope: Scope,
      milestoneId: string,
      submissionId: string,
    ): Promise<MilestoneSubmission | null>;
    append(
      scope: Scope,
      data: Partial<MilestoneSubmission>,
    ): Promise<MilestoneSubmission>;
  };
  evidence: {
    appendMany(
      scope: Scope,
      rows: Partial<MilestoneSubmissionEvidence>[],
    ): Promise<MilestoneSubmissionEvidence[]>;
  };
  documents: {
    /** The contract's documents the scope company can see, share-locked. */
    findEvidenceCandidates(
      scope: Scope,
      documentIds: string[],
    ): Promise<IEvidenceCandidate[]>;
  };
  decisions: {
    latestForMilestone(
      scope: Scope,
      milestoneId: string,
    ): Promise<MilestoneDecision | null>;
    findForSubmission(
      scope: Scope,
      submissionId: string,
    ): Promise<MilestoneDecision | null>;
    append(
      scope: Scope,
      data: Partial<MilestoneDecision>,
    ): Promise<MilestoneDecision>;
  };
  outstandingItems: {
    /** The milestone's open items, locked for update. */
    listOpenForUpdate(
      scope: Scope,
      milestoneId: string,
    ): Promise<MilestoneOutstandingItem[]>;
    appendMany(
      scope: Scope,
      rows: Partial<MilestoneOutstandingItem>[],
    ): Promise<MilestoneOutstandingItem[]>;
    /** Records acceptance of still-open items once; returns how many. */
    accept(
      scope: Scope,
      itemIds: string[],
      decisionId: string,
      acceptedAt: Date,
    ): Promise<number>;
  };
  submissionItems: {
    appendMany(
      scope: Scope,
      rows: Partial<MilestoneSubmissionItem>[],
    ): Promise<MilestoneSubmissionItem[]>;
    listForSubmissions(
      scope: Scope,
      submissionIds: string[],
    ): Promise<MilestoneSubmissionItem[]>;
  };
  /** Append-only stage history, written with the change it records. */
  stageHistory: {
    record(scope: Scope, data: Partial<ContractStageHistory>): Promise<void>;
  };
  activity: {
    record(scope: Scope, entry: ActivityEntryInput): Promise<void>;
  };
}

export type IMilestoneWorkflowUnitOfWork =
  IUnitOfWork<IMilestoneWorkflowContext>;

/** A submission with its evidence, decision and covered items, for history. */
export interface ISubmissionHistoryRecord {
  submission: MilestoneSubmission;
  evidence: IEvidenceRecord[];
  addressedItemIds: string[];
  decision: MilestoneDecision | null;
}

/** Reads outside a transaction, within an authorized scope. */
export interface IMilestoneWorkflowReader {
  listStages(
    scope: Scope,
    page: { skip: number; take: number },
  ): Promise<{ items: ContractStage[]; total: number }>;
  findStage(scope: Scope, stageId: string): Promise<ContractStage | null>;
  /** Every stage of the contract, in order. */
  allStages(scope: Scope): Promise<ContractStage[]>;
  /** The contract's time zone, for its calendar days; null if unknown. */
  contractTimezone(scope: Scope): Promise<string | null>;
  /** Approved progress of each listed stage, in bps of the stage. */
  stageProgress(scope: Scope, stageIds: string[]): Promise<Map<string, number>>;
  listMilestones(
    scope: Scope,
    filters: IMilestoneListFilters,
    page: { skip: number; take: number },
  ): Promise<{ items: Milestone[]; total: number }>;
  findMilestone(scope: Scope, milestoneId: string): Promise<Milestone | null>;
  submissionHistory(
    scope: Scope,
    milestoneId: string,
  ): Promise<ISubmissionHistoryRecord[]>;
  decisions(scope: Scope, milestoneId: string): Promise<MilestoneDecision[]>;
  outstandingItems(
    scope: Scope,
    milestoneId: string,
  ): Promise<
    Array<{
      item: MilestoneOutstandingItem;
      addressedBySubmissionIds: string[];
    }>
  >;
  /** Items raised or accepted by each decision. */
  decisionItems(
    scope: Scope,
    decisionIds: string[],
  ): Promise<{
    raised: Map<string, string[]>;
    accepted: Map<string, string[]>;
  }>;
}
