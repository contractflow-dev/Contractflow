import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EStatus } from '@contractflow/contracts-schema';
import type { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractStage } from '../entities/contract-stage.entity';

type Scope = IContractScope;

@Injectable()
export class ContractStageRepository extends ContractScopedRepository<ContractStage> {
  constructor(
    @InjectRepository(ContractStage) repository: Repository<ContractStage>,
  ) {
    super(repository);
  }

  findOrdered(scope: Scope) {
    return this.findAll(scope, {
      order: { sequence: 'ASC' } satisfies FindOptionsOrder<ContractStage>,
    });
  }

  findOrderedPage(scope: Scope, page: { skip: number; take: number }) {
    return this.findPage(scope, {
      order: { sequence: 'ASC', id: 'ASC' },
      skip: page.skip,
      take: page.take,
    });
  }

  findByStatus(scope: Scope, status: ContractStage['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ContractStage>,
    });
  }

  /** The stage, locked for update. */
  findForUpdate(scope: Scope, stageId: string) {
    return this.findOne(scope, {
      where: { id: stageId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** The stage, share-locked: its status can't change meanwhile. */
  findForShare(scope: Scope, stageId: string) {
    return this.findOne(scope, {
      where: { id: stageId },
      lock: { mode: 'pessimistic_read' },
    });
  }

  /** Total weight of the contract's stages that aren't cancelled. */
  async totalWeight(scope: Scope, excludeStageId?: string): Promise<number> {
    const query = (await this.createScopedQueryBuilder(scope, 'stage'))
      .select('COALESCE(SUM(stage.weightBps), 0)', 'total')
      .andWhere('stage.status <> :cancelled', { cancelled: EStatus.CANCELLED });
    if (excludeStageId) {
      query.andWhere('stage.id <> :excludeStageId', { excludeStageId });
    }
    return Number((await query.getRawOne<{ total: string }>())?.total ?? 0);
  }

  /** Next free sequence number when adding a stage. */
  async nextSequence(scope: Scope): Promise<number> {
    const row = await this.scopedQuery(scope)
      .select('COALESCE(MAX(e.sequence), 0)', 'max')
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  append(scope: Scope, data: Partial<ContractStage>) {
    return this.save(scope, this.create(scope, data));
  }
}
