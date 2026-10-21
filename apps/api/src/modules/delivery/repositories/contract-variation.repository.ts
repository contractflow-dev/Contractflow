import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractVariation } from '../entities/contract-variation.entity';

import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { sumBigint } from '../../../common/database/utils/sum-bigint';
type Scope = IContractScope;

@Injectable()
export class ContractVariationRepository extends ContractScopedRepository<ContractVariation> {
  constructor(
    @InjectRepository(ContractVariation)
    repository: Repository<ContractVariation>,
  ) {
    super(repository);
  }

  findByStatus(scope: Scope, status: ContractVariation['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ContractVariation>,
    });
  }

  findByReference(scope: Scope, referenceNumber: string) {
    return this.findOne(
      { where: { referenceNumber } as FindOptionsWhere<ContractVariation> },
      scope,
    );
  }

  /** Feeds contract.current_value_minor (original + approved variations). */
  approvedDeltaMinor(scope: Scope): Promise<bigint> {
    return sumBigint(
      this.scopedQuery(scope).andWhere('e.status = :s', { s: 'APPROVED' }),
      'e.amountDeltaMinor',
    );
  }

  /** Feeds contract.revised_end_date. */
  async approvedTimeExtensionDays(scope: Scope): Promise<number> {
    return Number(
      await sumBigint(
        this.scopedQuery(scope).andWhere('e.status = :s', { s: 'APPROVED' }),
        'e.timeExtensionDays',
      ),
    );
  }
}
