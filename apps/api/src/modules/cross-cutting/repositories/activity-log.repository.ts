import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ActivityLog } from '../entities/activity-log.entity';

/** Append-only; each entry belongs to a contract and the company that acted. */
@Injectable()
export class ActivityLogRepository extends ContractScopedRepository<
  ActivityLog,
  IContractCompanyScope
> {
  protected override readonly requireCompany = true;
  protected override readonly companyProperty = 'companyId';

  constructor(
    @InjectRepository(ActivityLog)
    repository: Repository<ActivityLog>,
  ) {
    super(repository);
  }

  async append(
    data: DeepPartial<ActivityLog>,
    scope: IContractCompanyScope,
  ): Promise<ActivityLog> {
    return this.save(this.create(data, scope), scope);
  }

  override async update(): Promise<ActivityLog> {
    throw new ForbiddenException('Activity logs are immutable');
  }

  override async delete(): Promise<void> {
    throw new ForbiddenException('Activity logs are immutable');
  }
}
