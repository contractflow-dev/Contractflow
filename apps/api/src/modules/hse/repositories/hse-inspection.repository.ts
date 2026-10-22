import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
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

  findByReference(referenceNumber: string, scope: IContractScope) {
    return this.findOne(
      { where: { referenceNumber } as FindOptionsWhere<HseInspection> },
      scope,
    );
  }

  findBySite(contractSiteId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { contractSiteId } as FindOptionsWhere<HseInspection>,
      order: { scheduledDate: 'DESC' } as any,
    });
  }

  findByStatus(status: HseInspection['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<HseInspection>,
    });
  }

  /** Still SCHEDULED after the scheduled date. */
  findOverdue(today: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'SCHEDULED' })
      .andWhere('e.scheduledDate < :today', { today })
      .getMany();
  }

  findScheduledBetween(from: string, to: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.scheduledDate >= :from AND e.scheduledDate <= :to', {
        from,
        to,
      })
      .orderBy('e.scheduledDate', 'ASC')
      .getMany();
  }
}
