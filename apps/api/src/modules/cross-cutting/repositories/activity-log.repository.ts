import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ActivityLog } from '../entities/activity-log.entity';

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
