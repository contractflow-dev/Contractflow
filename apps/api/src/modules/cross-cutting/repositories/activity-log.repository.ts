import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ActivityLog } from '../entities/activity-log.entity';
import type {
  ActivityActorRecord,
  ActivityLogFilter,
} from '../interfaces/activity-feed-item.interface';

/** Append-only; each entry belongs to a contract and the company that acted. */
@Injectable()
export class ActivityLogRepository extends ContractScopedRepository<
  ActivityLog,
  IContractCompanyScope
> {
  protected override readonly requireCompany = true;
  protected override readonly companyProperty = 'companyId';

  constructor(
    @InjectRepository(ActivityLog) repository: Repository<ActivityLog>,
  ) {
    super(repository);
  }

  override async update(): Promise<never> {
    throw new ForbiddenException('Activity log is append-only');
  }

  override async delete(): Promise<never> {
    throw new ForbiddenException('Activity log is append-only');
  }

  /**
   * One page of the scoped company's entries, newest first, with each actor's
   * first and last name loaded in the same query. The actor is joined only
   * when their membership belongs to the entry's company, which the scope
   * already fixes to the caller's company, so another company's member is
   * never resolved. Only the name columns of the user are selected.
   */
  async findPageWithActorNames(
    scope: IContractCompanyScope,
    options: ActivityLogFilter & { skip: number; take: number },
  ): Promise<{ items: ActivityLog[]; total: number }> {
    // The filters only add conditions to the scoped query, so they can
    // narrow the company's entries but never reach another company's; the
    // count comes from the same filtered query as the page.
    const query = await this.createScopedQueryBuilder(scope, 'e');
    if (options.fromDate) {
      query.andWhere('e.occurredAt >= :fromDate', {
        fromDate: options.fromDate,
      });
    }
    if (options.toDate) {
      query.andWhere('e.occurredAt <= :toDate', { toDate: options.toDate });
    }
    if (options.actorUserId) {
      query.andWhere('e.actorUserId = :actorUserId', {
        actorUserId: options.actorUserId,
      });
    }
    if (options.action) {
      query.andWhere('e.action = :action', { action: options.action });
    }
    const [items, total] = await query
      .leftJoin('e.actorUser', 'actor', 'actor.companyId = e.companyId')
      .leftJoin('actor.user', 'actorPerson')
      .addSelect([
        'actor.id',
        'actorPerson.id',
        'actorPerson.firstName',
        'actorPerson.lastName',
      ])
      .orderBy('e.occurredAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip(options.skip)
      .take(options.take)
      .getManyAndCount();
    return { items, total };
  }

  /**
   * The distinct actors of the scoped company's entries, with their names,
   * in one grouped query. Only memberships of the entry's own company (the
   * scope's) are joined, so no other company's member is ever listed.
   */
  async findActors(
    scope: IContractCompanyScope,
  ): Promise<ActivityActorRecord[]> {
    const query = await this.createScopedQueryBuilder(scope, 'e');
    return query
      .innerJoin('e.actorUser', 'actor', 'actor.companyId = e.companyId')
      .innerJoin('actor.user', 'actorPerson')
      .select('e.actorUserId', 'actorUserId')
      .addSelect('actorPerson.firstName', 'firstName')
      .addSelect('actorPerson.lastName', 'lastName')
      .groupBy('e.actorUserId')
      .addGroupBy('actorPerson.firstName')
      .addGroupBy('actorPerson.lastName')
      .orderBy('actorPerson.firstName', 'ASC')
      .addOrderBy('actorPerson.lastName', 'ASC')
      .addOrderBy('e.actorUserId', 'ASC')
      .limit(500)
      .getRawMany<ActivityActorRecord>();
  }

  findByEntity(
    scope: IContractCompanyScope,
    entityType: string,
    entityId: string,
    limit = 100,
  ) {
    return this.scopedQuery(scope)
      .andWhere('e.entityType = :entityType AND e.entityId = :entityId', {
        entityType,
        entityId,
      })
      .orderBy('e.occurredAt', 'DESC')
      .take(limit)
      .getMany();
  }

  findByActor(scope: IContractCompanyScope, actorUserId: string, limit = 100) {
    return this.scopedQuery(scope)
      .andWhere('e.actorUserId = :actorUserId', { actorUserId })
      .orderBy('e.occurredAt', 'DESC')
      .take(limit)
      .getMany();
  }

  findByContract(
    scope: IContractCompanyScope,
    contractId: string,
    limit = 100,
  ) {
    return this.scopedQuery(scope)
      .andWhere('e.contractId = :contractId', { contractId })
      .orderBy('e.occurredAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /** e.g. 'invoice.certified' */
  findByAction(scope: IContractCompanyScope, action: string, limit = 100) {
    return this.scopedQuery(scope)
      .andWhere('e.action = :action', { action })
      .orderBy('e.occurredAt', 'DESC')
      .take(limit)
      .getMany();
  }

  findBetween(scope: IContractCompanyScope, from: Date, to: Date, limit = 100) {
    return this.scopedQuery(scope)
      .andWhere('e.occurredAt >= :from AND e.occurredAt <= :to', { from, to })
      .orderBy('e.occurredAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
