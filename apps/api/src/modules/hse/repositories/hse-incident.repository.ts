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

  findByReference(referenceNumber: string, scope: IContractScope) {
    return this.findOne(
      { where: { referenceNumber } as FindOptionsWhere<HseIncident> },
      scope,
    );
  }

  findByStatus(status: HseIncident['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<HseIncident>,
    });
  }

  findBySeverity(severity: HseIncident['severity'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { severity } as FindOptionsWhere<HseIncident>,
    });
  }

  findBySite(contractSiteId: string, scope: IContractScope) {
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

  findOccurredBetween(from: Date, to: Date, scope: IContractScope) {
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
