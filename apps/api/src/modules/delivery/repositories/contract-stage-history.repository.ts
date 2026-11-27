import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractStageHistory } from '../entities/contract-stage-history.entity';

/** Stage history is an audit trail: rows are appended, never changed. */
@Injectable()
export class ContractStageHistoryRepository extends AppendOnlyContractScopedRepository<ContractStageHistory> {
  constructor(
    @InjectRepository(ContractStageHistory)
    repository: Repository<ContractStageHistory>,
  ) {
    super(repository);
  }

  /** Appends one history row in the contract scope. */
  append(
    scope: IContractScope,
    data: DeepPartial<ContractStageHistory>,
  ): Promise<ContractStageHistory> {
    return this.save(scope, this.create(scope, data));
  }
}
