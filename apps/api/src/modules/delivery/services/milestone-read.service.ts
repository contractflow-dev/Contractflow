import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EMilestoneStatus,
  type ContractStage as ContractStageResponse,
  type IPaginatedResponse,
  type ListMilestonesFilters,
  type Milestone as MilestoneResponse,
  type MilestoneDecision as MilestoneDecisionResponse,
  type MilestoneOutstandingItem as MilestoneOutstandingItemResponse,
} from '@contractflow/contracts-schema';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import { toInstantRange } from '../../../common/application/instant-range';
import { dayInTimeZone } from './milestone-workflow.rules';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import {
  toContractStageResponse,
  toMilestoneDecisionResponse,
  toMilestoneOutstandingItemResponse,
  toMilestoneResponse,
} from '../dto/delivery-response.dto';
import {
  MILESTONE_WORKFLOW_READER,
  type IMilestoneWorkflowReader,
} from '../interface/milestone-workflow-persistence.interface';

interface Caller {
  userId: string;
  companyId: string;
  contractId: string;
}

/**
 * Stages, milestones and their history for any Project workspace role, on
 * either side of the contract. Access is `ContractAccessService.authorize`
 * for the Project workspace; every query is limited to the authorized
 * contract.
 */
@Injectable()
export class MilestoneReadService {
  constructor(
    private readonly access: ContractAccessService,
    @Inject(MILESTONE_WORKFLOW_READER)
    private readonly reader: IMilestoneWorkflowReader,
  ) {}

  async listStages(
    caller: Caller,
    query: IPageQuery,
  ): Promise<IPaginatedResponse<ContractStageResponse>> {
    const scope = await this.authorize(caller);
    const page = await this.reader.listStages(scope, {
      skip: pageOffset(query),
      take: query.limit,
    });
    const progress = await this.reader.stageProgress(
      scope,
      page.items.map(({ id }) => id),
    );
    return toPaginatedResponse(
      {
        items: page.items.map((stage) =>
          toContractStageResponse(stage, progress.get(stage.id) ?? 0),
        ),
        total: page.total,
      },
      query,
    );
  }

  async getStage(
    caller: Caller,
    stageId: string,
  ): Promise<ContractStageResponse> {
    const scope = await this.authorize(caller);
    const stage = await this.reader.findStage(scope, stageId);
    if (!stage) throw new NotFoundException('Stage was not found.');
    const progress = await this.reader.stageProgress(scope, [stage.id]);
    return toContractStageResponse(stage, progress.get(stage.id) ?? 0);
  }

  async listMilestones(
    caller: Caller,
    query: IPageQuery & ListMilestonesFilters,
  ): Promise<IPaginatedResponse<MilestoneResponse>> {
    // Ranges are checked before access, as the activity filters are.
    const submitted = toInstantRange(
      query.submittedFrom,
      query.submittedTo,
      'submission date range',
    );
    if (query.dueFrom && query.dueTo && query.dueFrom > query.dueTo) {
      throw new BadRequestException(
        'The due date range start must not be after its end.',
      );
    }
    const scope = await this.authorize(caller);
    const today = await this.contractToday(scope);
    const statuses = query.pendingReview
      ? [EMilestoneStatus.PENDING_APPROVAL]
      : query.status
        ? [query.status]
        : undefined;
    // Both filters given and different: nothing can match.
    if (
      query.pendingReview &&
      query.status &&
      query.status !== EMilestoneStatus.PENDING_APPROVAL
    ) {
      return toPaginatedResponse({ items: [], total: 0 }, query);
    }
    const page = await this.reader.listMilestones(
      scope,
      {
        contractStageId: query.contractStageId,
        statuses,
        overdue: query.overdue,
        dueFrom: query.dueFrom,
        dueTo: query.dueTo,
        submittedFrom: submitted.from,
        submittedTo: submitted.to,
        today,
      },
      { skip: pageOffset(query), take: query.limit },
    );
    return toPaginatedResponse(
      {
        items: page.items.map((milestone) =>
          toMilestoneResponse(milestone, today),
        ),
        total: page.total,
      },
      query,
    );
  }

  async getMilestone(
    caller: Caller,
    milestoneId: string,
  ): Promise<MilestoneResponse> {
    const scope = await this.authorize(caller);
    const milestone = await this.reader.findMilestone(scope, milestoneId);
    if (!milestone) throw new NotFoundException('Milestone was not found.');
    return toMilestoneResponse(milestone, await this.contractToday(scope));
  }

  async listDecisions(
    caller: Caller,
    milestoneId: string,
  ): Promise<MilestoneDecisionResponse[]> {
    const scope = await this.authorize(caller);
    await this.requireMilestone(scope, milestoneId);
    const decisions = await this.reader.decisions(scope, milestoneId);
    const items = await this.reader.decisionItems(
      scope,
      decisions.map(({ id }) => id),
    );
    return decisions.map((decision) =>
      toMilestoneDecisionResponse(decision, items),
    );
  }

  async listOutstandingItems(
    caller: Caller,
    milestoneId: string,
  ): Promise<MilestoneOutstandingItemResponse[]> {
    const scope = await this.authorize(caller);
    await this.requireMilestone(scope, milestoneId);
    const rows = await this.reader.outstandingItems(scope, milestoneId);
    return rows.map(({ item, addressedBySubmissionIds }) =>
      toMilestoneOutstandingItemResponse(item, addressedBySubmissionIds),
    );
  }

  /** Project workspace access; the scope it returns is used for every query. */
  private async authorize(caller: Caller): Promise<IContractCompanyScope> {
    const scope = await this.access.authorize(
      caller.userId,
      caller.companyId,
      caller.contractId,
      'project',
    );
    return { contractId: scope.contractId, companyId: scope.companyId };
  }

  /** Today in the contract's own time zone (approved 22 November 2026). */
  private async contractToday(scope: IContractCompanyScope): Promise<string> {
    return dayInTimeZone(new Date(), await this.reader.contractTimezone(scope));
  }

  private async requireMilestone(
    scope: IContractCompanyScope,
    milestoneId: string,
  ) {
    if (!(await this.reader.findMilestone(scope, milestoneId))) {
      throw new NotFoundException('Milestone was not found.');
    }
  }
}
