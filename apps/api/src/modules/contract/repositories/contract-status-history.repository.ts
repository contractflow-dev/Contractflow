import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';

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
}
