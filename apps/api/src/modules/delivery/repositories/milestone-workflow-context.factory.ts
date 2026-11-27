import type { EntityManager } from 'typeorm';
import { buildActivityEntry } from '../../../common/application/activity-entry';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../contract/entities/contract-role-assignment.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { ContractPartyRepository } from '../../contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../contract/repositories/contract-role-assignment.repository';
import { ContractRepository } from '../../contract/repositories/contract.repository';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { Document } from '../../cross-cutting/entities/document.entity';
import { ActivityLogRepository } from '../../cross-cutting/repositories/activity-log.repository';
import { DocumentRepository } from '../../cross-cutting/repositories/document.repository';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { ContractStage } from '../entities/contract-stage.entity';
import { ContractStageHistory } from '../entities/contract-stage-history.entity';
import { MilestoneDecision } from '../entities/milestone-decision.entity';
import { MilestoneOutstandingItem } from '../entities/milestone-outstanding-item.entity';
import { MilestoneSubmissionEvidence } from '../entities/milestone-submission-evidence.entity';
import { MilestoneSubmissionItem } from '../entities/milestone-submission-item.entity';
import { MilestoneSubmission } from '../entities/milestone-submission.entity';
import { Milestone } from '../entities/milestone.entity';
import type {
  IMilestoneWorkflowContext,
  IMilestoneWorkflowReader,
  ISubmissionHistoryRecord,
} from '../interface/milestone-workflow-persistence.interface';
import { ContractStageRepository } from './contract-stage.repository';
import { ContractStageHistoryRepository } from './contract-stage-history.repository';
import {
  MilestoneDecisionRepository,
  MilestoneOutstandingItemRepository,
  MilestoneSubmissionEvidenceRepository,
  MilestoneSubmissionItemRepository,
  MilestoneSubmissionRepository,
} from './milestone-history.repositories';
import { MilestoneRepository } from './milestone.repository';

/**
 * The module repositories the Stages and Milestones port uses, all built on
 * one EntityManager: within a Unit of Work they share its transaction.
 */
function repositoriesFor(manager: EntityManager) {
  return {
    memberships: new CompanyUserRepository(manager.getRepository(CompanyUser)),
    parties: new ContractPartyRepository(manager.getRepository(ContractParty)),
    roleAssignments: new ContractRoleAssignmentRepository(
      manager.getRepository(ContractRoleAssignment),
    ),
    contracts: new ContractRepository(manager.getRepository(Contract)),
    documents: new DocumentRepository(manager.getRepository(Document)),
    activity: new ActivityLogRepository(manager.getRepository(ActivityLog)),
    stages: new ContractStageRepository(manager.getRepository(ContractStage)),
    stageHistory: new ContractStageHistoryRepository(
      manager.getRepository(ContractStageHistory),
    ),
    milestones: new MilestoneRepository(manager.getRepository(Milestone)),
    submissions: new MilestoneSubmissionRepository(
      manager.getRepository(MilestoneSubmission),
    ),
    evidence: new MilestoneSubmissionEvidenceRepository(
      manager.getRepository(MilestoneSubmissionEvidence),
    ),
    decisions: new MilestoneDecisionRepository(
      manager.getRepository(MilestoneDecision),
    ),
    items: new MilestoneOutstandingItemRepository(
      manager.getRepository(MilestoneOutstandingItem),
    ),
    submissionItems: new MilestoneSubmissionItemRepository(
      manager.getRepository(MilestoneSubmissionItem),
    ),
  };
}

/** The Stages and Milestones persistence port, on the module repositories. */
export class TypeOrmMilestoneWorkflowContext implements IMilestoneWorkflowContext {
  readonly memberships: IMilestoneWorkflowContext['memberships'];
  readonly parties: IMilestoneWorkflowContext['parties'];
  readonly roleAssignments: IMilestoneWorkflowContext['roleAssignments'];
  readonly contracts: IMilestoneWorkflowContext['contracts'];
  readonly stages: IMilestoneWorkflowContext['stages'];
  readonly milestones: IMilestoneWorkflowContext['milestones'];
  readonly submissions: IMilestoneWorkflowContext['submissions'];
  readonly evidence: IMilestoneWorkflowContext['evidence'];
  readonly documents: IMilestoneWorkflowContext['documents'];
  readonly decisions: IMilestoneWorkflowContext['decisions'];
  readonly outstandingItems: IMilestoneWorkflowContext['outstandingItems'];
  readonly submissionItems: IMilestoneWorkflowContext['submissionItems'];
  readonly stageHistory: IMilestoneWorkflowContext['stageHistory'];
  readonly activity: IMilestoneWorkflowContext['activity'];

  constructor(manager: EntityManager) {
    const r = repositoriesFor(manager);

    this.memberships = {
      findActiveForUpdate: (scope, userId) =>
        r.memberships.findActiveMemberForUpdate(
          { companyId: scope.companyId },
          userId,
        ),
    };
    this.parties = {
      findOwnForShare: (scope) =>
        r.parties.findByCompanyForShare(scope, scope.companyId),
    };
    this.roleAssignments = {
      hasActiveRoleForShare: (scope, companyUserId, contractPartyId, role) =>
        r.roleAssignments.hasActiveRoleForShare(
          { companyId: scope.companyId },
          companyUserId,
          contractPartyId,
          role,
        ),
    };
    this.contracts = {
      findActiveForLock: (scope, companyUserId, mode) =>
        r.contracts.findActiveForLock(
          {
            companyId: scope.companyId,
            companyUserId,
            // Only a contract the member holds a role on: never oversight.
            includeCompanyAdminOversight: false,
          },
          scope.contractId,
          mode,
        ),
    };
    this.stages = {
      findForUpdate: (scope, id) => r.stages.findForUpdate(scope, id),
      findForShare: (scope, id) => r.stages.findForShare(scope, id),
      totalWeight: (scope, exclude) => r.stages.totalWeight(scope, exclude),
      nextSequence: (scope) => r.stages.nextSequence(scope),
      append: (scope, data) => r.stages.append(scope, data),
      update: (scope, id, changes) => r.stages.update(scope, id, changes),
    };
    this.milestones = {
      findForUpdate: (scope, id) => r.milestones.findForUpdate(scope, id),
      totalWeightInStage: (scope, stageId, exclude) =>
        r.milestones.totalWeightInStage(scope, stageId, exclude),
      nextSequenceInStage: (scope, stageId) =>
        r.milestones.nextSequenceInStage(scope, stageId),
      countNotApprovedInStage: (scope, stageId) =>
        r.milestones.countNotApprovedInStage(scope, stageId),
      countActiveInStage: (scope, stageId) =>
        r.milestones.countActiveInStage(scope, stageId),
      countOutsideDates: (scope, stageId, start, end) =>
        r.milestones.countOutsideDates(scope, stageId, start, end),
      append: (scope, data) => r.milestones.append(scope, data),
      update: (scope, id, changes) => r.milestones.update(scope, id, changes),
    };
    this.submissions = {
      countForMilestone: (scope, id) =>
        r.submissions.countForMilestone(scope, id),
      latestForMilestone: (scope, id) =>
        r.submissions.latestForMilestone(scope, id),
      findInMilestone: (scope, milestoneId, submissionId) =>
        r.submissions.findInMilestone(scope, milestoneId, submissionId),
      append: (scope, data) => r.submissions.append(scope, data),
    };
    this.evidence = {
      appendMany: (scope, rows) => r.evidence.appendMany(scope, rows),
    };
    this.documents = {
      findEvidenceCandidates: async (scope, documentIds) => {
        const documents = await r.documents.findManyVisibleInContractForShare(
          scope,
          documentIds,
        );
        const versions = await r.documents.latestAvailableVersions(
          documents.map(({ id }) => id),
        );
        return documents.map((document) => ({
          documentId: document.id,
          ownerCompanyId: document.ownerCompanyId,
          category: document.category,
          visibility: document.visibility,
          title: document.title,
          currentVersionId: versions.get(document.id)?.id ?? null,
        }));
      },
    };
    this.decisions = {
      latestForMilestone: (scope, id) =>
        r.decisions.latestForMilestone(scope, id),
      findForSubmission: (scope, id) =>
        r.decisions.findForSubmission(scope, id),
      append: (scope, data) => r.decisions.append(scope, data),
    };
    this.outstandingItems = {
      listOpenForUpdate: (scope, id) => r.items.listOpenForUpdate(scope, id),
      appendMany: (scope, rows) => r.items.appendMany(scope, rows),
      accept: (scope, ids, decisionId, at) =>
        r.items.accept(scope, ids, decisionId, at),
    };
    this.submissionItems = {
      appendMany: (scope, rows) => r.submissionItems.appendMany(scope, rows),
      listForSubmissions: (scope, ids) =>
        r.submissionItems.listForSubmissions(scope, ids),
    };
    this.stageHistory = {
      record: async (scope, data) => {
        await r.stageHistory.append(scope, data);
      },
    };
    this.activity = {
      record: async (scope, entry) => {
        await r.activity.append(scope, buildActivityEntry(entry));
      },
    };
  }
}

export class MilestoneWorkflowContextFactory implements ITransactionContextFactory<IMilestoneWorkflowContext> {
  create(manager: EntityManager): IMilestoneWorkflowContext {
    return new TypeOrmMilestoneWorkflowContext(manager);
  }
}

/** Reads for the Stages and Milestones API, on the module repositories. */
export class TypeOrmMilestoneWorkflowReader implements IMilestoneWorkflowReader {
  private readonly r: ReturnType<typeof repositoriesFor>;

  constructor(manager: EntityManager) {
    this.r = repositoriesFor(manager);
  }

  listStages: IMilestoneWorkflowReader['listStages'] = (scope, page) =>
    this.r.stages.findOrderedPage(scope, page);

  findStage: IMilestoneWorkflowReader['findStage'] = (scope, stageId) =>
    this.r.stages.findById(scope, stageId);

  allStages: IMilestoneWorkflowReader['allStages'] = (scope) =>
    this.r.stages.findAll(scope, { order: { sequence: 'ASC' } });

  contractTimezone: IMilestoneWorkflowReader['contractTimezone'] = (scope) =>
    this.r.contracts.findTimezoneForParty(scope);

  stageProgress: IMilestoneWorkflowReader['stageProgress'] = (
    scope,
    stageIds,
  ) => this.r.milestones.approvedProgressByStage(scope, stageIds);

  listMilestones: IMilestoneWorkflowReader['listMilestones'] = (
    scope,
    filters,
    page,
  ) => this.r.milestones.findFilteredPage(scope, filters, page);

  findMilestone: IMilestoneWorkflowReader['findMilestone'] = (scope, id) =>
    this.r.milestones.findById(scope, id);

  submissionHistory: IMilestoneWorkflowReader['submissionHistory'] = async (
    scope,
    milestoneId,
  ): Promise<ISubmissionHistoryRecord[]> => {
    const submissions = await this.r.submissions.listForMilestone(
      scope,
      milestoneId,
    );
    if (!submissions.length) return [];
    const ids = submissions.map(({ id }) => id);
    const [evidence, decisions, items] = await Promise.all([
      this.r.evidence.listWithFiles(scope, ids),
      this.r.decisions.listForSubmissions(scope, ids),
      this.r.submissionItems.listForSubmissions(scope, ids),
    ]);
    return submissions.map((submission) => ({
      submission,
      evidence: evidence.filter((row) => row.submissionId === submission.id),
      addressedItemIds: items
        .filter((row) => row.submissionId === submission.id)
        .map((row) => row.outstandingItemId),
      decision:
        decisions.find((row) => row.submissionId === submission.id) ?? null,
    }));
  };

  decisions: IMilestoneWorkflowReader['decisions'] = (scope, milestoneId) =>
    this.r.decisions.listForMilestone(scope, milestoneId);

  outstandingItems: IMilestoneWorkflowReader['outstandingItems'] = async (
    scope,
    milestoneId,
  ) => {
    const items = await this.r.items.listForMilestone(scope, milestoneId);
    const links = await this.r.submissionItems.listForItems(
      scope,
      items.map(({ id }) => id),
    );
    return items.map((item) => ({
      item,
      addressedBySubmissionIds: links
        .filter((link) => link.itemId === item.id)
        .map((link) => link.submissionId),
    }));
  };

  decisionItems: IMilestoneWorkflowReader['decisionItems'] = async (
    scope,
    decisionIds,
  ) => {
    const raised = new Map<string, string[]>();
    const accepted = new Map<string, string[]>();
    const items = await this.r.items.listForDecisions(scope, decisionIds);
    for (const item of items) {
      if (decisionIds.includes(item.raisedByDecisionId)) {
        raised.set(item.raisedByDecisionId, [
          ...(raised.get(item.raisedByDecisionId) ?? []),
          item.id,
        ]);
      }
      if (item.acceptedByDecisionId) {
        accepted.set(item.acceptedByDecisionId, [
          ...(accepted.get(item.acceptedByDecisionId) ?? []),
          item.id,
        ]);
      }
    }
    return { raised, accepted };
  };
}
