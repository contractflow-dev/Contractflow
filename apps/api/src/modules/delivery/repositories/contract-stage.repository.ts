import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
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
    return this.findAll(scope, { order: { sequence: 'ASC' } as any });
  }

  findByStatus(status: ContractStage['status'], scope: Scope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ContractStage>,
    });
  }

  /** Next free sequence number when adding a stage. */
  async nextSequence(scope: Scope): Promise<number> {
    const row = await this.scopedQuery(scope)
      .select('COALESCE(MAX(e.sequence), 0)', 'max')
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }
}
