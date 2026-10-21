import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

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
