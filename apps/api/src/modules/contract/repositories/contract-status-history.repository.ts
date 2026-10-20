import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial } from 'typeorm';
import { Repository } from 'typeorm';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';

/** Status history is an audit trail: records are appended, never changed. */
@Injectable()
export class ContractStatusHistoryRepository extends ContractScopedRepository<
  ContractStatusHistory,
  IContractScope
> {
  constructor(
    @InjectRepository(ContractStatusHistory)
    repository: Repository<ContractStatusHistory>,
  ) {
    super(repository);
  }

  async findForContract(
    scope: IContractScope,
    page: { skip?: number; take?: number } = {},
  ): Promise<{ items: ContractStatusHistory[]; total: number }> {
    return this.findPage(scope, {
      order: { changedAt: 'DESC' },
      ...page,
    });
  }

  async append(
    data: DeepPartial<ContractStatusHistory>,
    scope: IContractScope,
  ): Promise<ContractStatusHistory> {
    return this.save(this.create(data, scope), scope);
  }

  override async update(): Promise<ContractStatusHistory> {
    throw new ForbiddenException('Contract status history is immutable');
  }

  override async delete(): Promise<void> {
    throw new ForbiddenException('Contract status history is immutable');
  }
}
