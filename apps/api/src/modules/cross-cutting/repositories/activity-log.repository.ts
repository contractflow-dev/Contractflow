import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { ActivityLog } from '../entities/activity-log.entity';

@Injectable()
export class ActivityLogRepository extends CompanyScopedRepository<
  ActivityLog,
  ICompanyScope
> {
  constructor(
    @InjectRepository(ActivityLog)
    repository: Repository<ActivityLog>,
  ) {
    super(repository);
  }

  async findForContract(
    contractId: string,
    scope: ICompanyScope,
  ): Promise<ActivityLog[]> {
    return this.scopedQuery(scope, 'activity')
      .andWhere('activity.contractId = :contractId', { contractId })
      .orderBy('activity.occurredAt', 'DESC')
      .getMany();
  }

  async append(
    data: DeepPartial<ActivityLog>,
    scope: ICompanyScope,
  ): Promise<ActivityLog> {
    const entity = this.create(data, scope);
    return this.save(entity, scope);
  }

  override async update(
    _id: string,
    _data: Omit<DeepPartial<ActivityLog>, 'id'>,
    _scope: ICompanyScope,
  ): Promise<ActivityLog> {
    throw new ForbiddenException('Activity logs are immutable');
  }

  override async delete(_id: string, _scope: ICompanyScope): Promise<void> {
    throw new ForbiddenException('Activity logs are immutable');
  }
}
