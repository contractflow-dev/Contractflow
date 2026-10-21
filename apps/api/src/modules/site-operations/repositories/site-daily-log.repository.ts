import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { SiteDailyLog } from '../entities/site-daily-log.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { sumBigint } from '../../../common/database/utils/sum-bigint';

@Injectable()
export class SiteDailyLogRepository extends ContractScopedRepository<SiteDailyLog> {
  constructor(
    @InjectRepository(SiteDailyLog) repository: Repository<SiteDailyLog>,
  ) {
    super(repository);
  }

  /** One party's log for one site on one day (duplicate check before create). */
  findForDay(
    contractSiteId: string,
    contractPartyId: string,
    logDate: Date,
    scope: IContractScope,
  ) {
    return this.findOne(
      { where: { contractSiteId, contractPartyId, logDate } },
      scope,
    );
  }

  findBySite(contractSiteId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { contractSiteId } as FindOptionsWhere<SiteDailyLog>,
      order: { logDate: 'DESC' } as any,
    });
  }

  findBetween(from: string, to: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.logDate >= :from AND e.logDate <= :to', { from, to })
      .orderBy('e.logDate', 'ASC')
      .getMany();
  }

  findByStatus(status: SiteDailyLog['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<SiteDailyLog>,
    });
  }

  findAwaitingApproval(scope: IContractScope) {
    return this.findAll(scope, {
      where: {
        status: 'SUBMITTED',
      } as unknown as FindOptionsWhere<SiteDailyLog>,
    });
  }

  /** Working minutes lost to weather over a period (delay claims). */
  async weatherDelayMinutes(
    from: string,
    to: string,
    scope: IContractScope,
  ): Promise<number> {
    return Number(
      await sumBigint(
        this.scopedQuery(scope).andWhere(
          'e.logDate >= :from AND e.logDate <= :to',
          { from, to },
        ),
        'e.weatherDelayMinutes',
      ),
    );
  }
}
