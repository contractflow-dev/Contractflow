import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseIncident } from '../entities/hse-incident.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { sumBigint } from '../../../common/database/utils/sum-bigint';

@Injectable()
export class HseIncidentRepository extends ContractScopedRepository<HseIncident> {
  constructor(
    @InjectRepository(HseIncident) repository: Repository<HseIncident>,
  ) {
    super(repository);
  }

  findByReference(scope: IContractScope, referenceNumber: string) {
    return this.findOne(scope, {
      where: { referenceNumber } as FindOptionsWhere<HseIncident>,
    });
  }

  findByStatus(scope: IContractScope, status: HseIncident['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<HseIncident>,
    });
  }

  findBySeverity(scope: IContractScope, severity: HseIncident['severity']) {
    return this.findAll(scope, {
      where: { severity } as FindOptionsWhere<HseIncident>,
    });
  }

  findBySite(scope: IContractScope, contractSiteId: string) {
    return this.findAll(scope, {
      where: { contractSiteId } as FindOptionsWhere<HseIncident>,
      order: { occurredAt: 'DESC' } as any,
    });
  }

  /** Regulator-notifiable incidents not yet reported to the authority. */
  findNotifiableUnreported(scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.isNotifiable = true')
      .andWhere('e.authorityNotifiedAt IS NULL')
      .getMany();
  }

  findOccurredBetween(scope: IContractScope, from: Date, to: Date) {
    return this.scopedQuery(scope)
      .andWhere('e.occurredAt >= :from AND e.occurredAt <= :to', { from, to })
      .orderBy('e.occurredAt', 'ASC')
      .getMany();
  }

  /** For lost-time-injury rates (pair with SiteDailyLogLabour minutes_worked). */
  async totalLostTimeDays(scope: IContractScope): Promise<number> {
    return Number(await sumBigint(this.scopedQuery(scope), 'e.lostTimeDays'));
  }
}
