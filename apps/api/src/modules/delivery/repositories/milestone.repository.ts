import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EMilestoneStatus } from '@contractflow/contracts-schema';
import type { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { MilestoneSubmission } from '../entities/milestone-submission.entity';
import { Milestone } from '../entities/milestone.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

type Scope = IContractScope;

/** The effective due date: revised if set, else original. */
const EFFECTIVE_DUE = 'COALESCE(milestone.revisedDueDate, milestone.dueDate)';
/** Approved and cancelled milestones are never overdue. */
const DONE = [EMilestoneStatus.APPROVED, EMilestoneStatus.CANCELLED];

export interface IMilestoneListFilters {
  contractStageId?: string;
  statuses?: EMilestoneStatus[];
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  /** Inclusive bounds on a submission's time, from the submission history. */
  submittedFrom?: Date;
  submittedTo?: Date;
  /** Today, the day overdue is judged by. */
  today: string;
}

@Injectable()
export class MilestoneRepository extends ContractScopedRepository<Milestone> {
  constructor(@InjectRepository(Milestone) repository: Repository<Milestone>) {
    super(repository);
  }

  findByStage(scope: Scope, contractStageId: string) {
    return this.findAll(scope, {
      where: { contractStageId } as FindOptionsWhere<Milestone>,
      order: { sequence: 'ASC' } satisfies FindOptionsOrder<Milestone>,
    });
  }

  findByStatus(scope: Scope, status: Milestone['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Milestone>,
    });
  }

  findPaymentMilestones(scope: Scope) {
    return this.findAll(scope, {
      where: { isPaymentMilestone: true } as FindOptionsWhere<Milestone>,
      order: { sequence: 'ASC' } satisfies FindOptionsOrder<Milestone>,
    });
  }

  /** Submitted and waiting for the client's decision. */
  findAwaitingApproval(scope: Scope) {
    return this.findAll(scope, {
      where: {
        status: EMilestoneStatus.PENDING_APPROVAL,
      } as FindOptionsWhere<Milestone>,
    });
  }

  /** Not completed and past its (revised) due date. */
  findOverdue(scope: Scope, today: string) {
    return this.scopedQuery(scope)
      .andWhere('e.completedDate IS NULL')
      .andWhere('COALESCE(e.revisedDueDate, e.dueDate) < :today', { today })
      .orderBy('COALESCE(e.revisedDueDate, e.dueDate)', 'ASC')
      .getMany();
  }

  /** The milestone, locked for update: serializes its submissions and decisions. */
  findForUpdate(scope: Scope, milestoneId: string) {
    return this.findOne(scope, {
      where: { id: milestoneId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** One page of the contract's milestones, soonest due first. */
  async findFilteredPage(
    scope: Scope,
    filters: IMilestoneListFilters,
    page: { skip: number; take: number },
  ): Promise<{ items: Milestone[]; total: number }> {
    const query = await this.createScopedQueryBuilder(scope, 'milestone');
    if (filters.contractStageId) {
      query.andWhere('milestone.contractStageId = :stageId', {
        stageId: filters.contractStageId,
      });
    }
    if (filters.statuses?.length) {
      query.andWhere('milestone.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }
    if (filters.overdue !== undefined) {
      const overdue = `(milestone.status NOT IN (:...done) AND ${EFFECTIVE_DUE} < :today)`;
      query.andWhere(filters.overdue ? overdue : `NOT ${overdue}`, {
        done: DONE,
        today: filters.today,
      });
    }
    if (filters.dueFrom) {
      query.andWhere(`${EFFECTIVE_DUE} >= :dueFrom`, {
        dueFrom: filters.dueFrom,
      });
    }
    if (filters.dueTo) {
      query.andWhere(`${EFFECTIVE_DUE} <= :dueTo`, { dueTo: filters.dueTo });
    }
    if (filters.submittedFrom || filters.submittedTo) {
      // One correlated EXISTS, so a milestone with several matching
      // submissions is listed and counted once. The submission must belong
      // to this milestone and this contract.
      const submissions = query
        .subQuery()
        .select('1')
        .from(MilestoneSubmission, 'submission')
        .where('submission.milestoneId = milestone.id')
        .andWhere('submission.contractId = milestone.contractId');
      if (filters.submittedFrom) {
        submissions.andWhere('submission.submittedAt >= :submittedFrom');
      }
      if (filters.submittedTo) {
        submissions.andWhere('submission.submittedAt <= :submittedTo');
      }
      query.andWhere(`EXISTS ${submissions.getQuery()}`, {
        ...(filters.submittedFrom
          ? { submittedFrom: filters.submittedFrom }
          : {}),
        ...(filters.submittedTo ? { submittedTo: filters.submittedTo } : {}),
      });
    }
    const [items, total] = await query
      .orderBy(EFFECTIVE_DUE, 'ASC')
      .addOrderBy('milestone.sequence', 'ASC')
      .addOrderBy('milestone.id', 'ASC')
      .skip(page.skip)
      .take(page.take)
      .getManyAndCount();
    return { items, total };
  }

  /** Total weight of a stage's milestones that aren't cancelled. */
  async totalWeightInStage(
    scope: Scope,
    stageId: string,
    excludeMilestoneId?: string,
  ): Promise<number> {
    const query = (await this.createScopedQueryBuilder(scope, 'milestone'))
      .select('COALESCE(SUM(milestone.weightBps), 0)', 'total')
      .andWhere('milestone.contractStageId = :stageId', { stageId })
      .andWhere('milestone.status <> :cancelled', {
        cancelled: EMilestoneStatus.CANCELLED,
      });
    if (excludeMilestoneId) {
      query.andWhere('milestone.id <> :excludeMilestoneId', {
        excludeMilestoneId,
      });
    }
    return Number((await query.getRawOne<{ total: string }>())?.total ?? 0);
  }

  async nextSequenceInStage(scope: Scope, stageId: string): Promise<number> {
    const row = await (
      await this.createScopedQueryBuilder(scope, 'milestone')
    )
      .select('COALESCE(MAX(milestone.sequence), 0)', 'max')
      .andWhere('milestone.contractStageId = :stageId', { stageId })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  /** How many of the stage's milestones aren't approved (or cancelled). */
  /** The stage's milestones that aren't cancelled. */
  async countActiveInStage(scope: Scope, stageId: string): Promise<number> {
    return (await this.createScopedQueryBuilder(scope, 'milestone'))
      .andWhere('milestone.contractStageId = :stageId', { stageId })
      .andWhere('milestone.status <> :cancelled', {
        cancelled: EMilestoneStatus.CANCELLED,
      })
      .getCount();
  }

  async countNotApprovedInStage(
    scope: Scope,
    stageId: string,
  ): Promise<number> {
    return (await this.createScopedQueryBuilder(scope, 'milestone'))
      .andWhere('milestone.contractStageId = :stageId', { stageId })
      .andWhere('milestone.status NOT IN (:...done)', { done: DONE })
      .getCount();
  }

  /**
   * How many of the stage's milestones that aren't cancelled have a planned
   * start or due date outside `start`..`end` (days, inclusive).
   */
  async countOutsideDates(
    scope: Scope,
    stageId: string,
    start: string,
    end: string,
  ): Promise<number> {
    return (await this.createScopedQueryBuilder(scope, 'milestone'))
      .andWhere('milestone.contractStageId = :stageId', { stageId })
      .andWhere('milestone.status <> :cancelled', {
        cancelled: EMilestoneStatus.CANCELLED,
      })
      .andWhere(
        '(milestone.dueDate < :start OR milestone.dueDate > :end' +
          ' OR milestone.plannedStartDate < :start OR milestone.plannedStartDate > :end)',
        { start, end },
      )
      .getCount();
  }

  /**
   * Each stage's client-approved progress in bps of the stage: the sum of
   * its milestones' weight × approved share, over 10,000.
   */
  async approvedProgressByStage(
    scope: Scope,
    stageIds: string[],
  ): Promise<Map<string, number>> {
    const progress = new Map<string, number>();
    if (!stageIds.length) return progress;
    const rows = await (
      await this.createScopedQueryBuilder(scope, 'milestone')
    )
      .select('milestone.contractStageId', 'stageId')
      .addSelect(
        'COALESCE(SUM("milestone"."weight_bps"::bigint * "milestone"."approved_bps"), 0)',
        'weighted',
      )
      .andWhere('milestone.contractStageId IN (:...stageIds)', { stageIds })
      .andWhere('milestone.status <> :cancelled', {
        cancelled: EMilestoneStatus.CANCELLED,
      })
      .groupBy('milestone.contractStageId')
      .getRawMany<{ stageId: string; weighted: string }>();
    for (const row of rows) {
      progress.set(row.stageId, Math.floor(Number(row.weighted) / 10_000));
    }
    return progress;
  }

  append(scope: Scope, data: Partial<Milestone>) {
    return this.save(scope, this.create(scope, data));
  }
}
