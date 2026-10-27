import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';
import type { EContractStatus } from '@contractflow/contracts-schema';

export interface ContractStatusHistoryFilter {
  fromDate?: string;
  toDate?: string;
  status?: EContractStatus;
  userId?: string;
  skip?: number;
  take?: number;
}

/** Status history is an audit trail: records are appended, never changed. */

@Injectable()
export class ContractStatusHistoryRepository extends AppendOnlyContractScopedRepository<ContractStatusHistory> {
  constructor(
    @InjectRepository(ContractStatusHistory)
    repository: Repository<ContractStatusHistory>,
  ) {
    super(repository);
  }

  findTimeline(scope: IContractScope) {
    return this.findAll(scope, { order: { changedAt: 'ASC' } as any });
  }

  findLatest(scope: IContractScope) {
    return this.findOne({ order: { changedAt: 'DESC' } as any }, scope);
  }

  async searchPage(
    scope: IContractScope,
    filter: ContractStatusHistoryFilter,
  ): Promise<{ items: ContractStatusHistory[]; total: number }> {
    const query = await this.createScopedQueryBuilder(scope, 'history');
    query
      .leftJoinAndSelect('history.changedBy', 'changedBy')
      .leftJoinAndSelect('changedBy.user', 'actorUser');

    if (filter.fromDate) {
      query.andWhere('history.changedAt >= :fromDate', {
        fromDate: filter.fromDate,
      });
    }
    if (filter.toDate) {
      query.andWhere('history.changedAt <= :toDate', {
        toDate: filter.toDate,
      });
    }
    if (filter.status) {
      query.andWhere(
        '(history.fromStatus = :status OR history.toStatus = :status)',
        { status: filter.status },
      );
    }
    if (filter.userId) {
      query.andWhere('changedBy.userId = :userId', {
        userId: filter.userId,
      });
    }

    const [items, total] = await query
      .orderBy('history.changedAt', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .skip(filter.skip)
      .take(filter.take)
      .getManyAndCount();
    return { items, total };
  }
}
