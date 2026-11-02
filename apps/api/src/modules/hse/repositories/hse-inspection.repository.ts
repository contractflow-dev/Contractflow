import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseInspection } from '../entities/hse-inspection.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class HseInspectionRepository extends ContractScopedRepository<HseInspection> {
  constructor(
    @InjectRepository(HseInspection) repository: Repository<HseInspection>,
  ) {
    super(repository);
  }

  findByReference(scope: IContractScope, referenceNumber: string) {
    return this.findOne(scope, {
      where: { referenceNumber } as FindOptionsWhere<HseInspection>,
    });
  }

  findBySite(scope: IContractScope, contractSiteId: string) {
    return this.findAll(scope, {
      where: { contractSiteId } as FindOptionsWhere<HseInspection>,
      order: { scheduledDate: 'DESC' } satisfies FindOptionsOrder<HseInspection>,
    });
  }

  findByStatus(scope: IContractScope, status: HseInspection['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<HseInspection>,
    });
  }

  /** Still SCHEDULED after the scheduled date. */
  findOverdue(scope: IContractScope, today: string) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'SCHEDULED' })
      .andWhere('e.scheduledDate < :today', { today })
      .getMany();
  }

  findScheduledBetween(scope: IContractScope, from: string, to: string) {
    return this.scopedQuery(scope)
      .andWhere('e.scheduledDate >= :from AND e.scheduledDate <= :to', {
        from,
        to,
      })
      .orderBy('e.scheduledDate', 'ASC')
      .getMany();
  }
}
