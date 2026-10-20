import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { SiteDailyLog } from '../entities/site-daily-log.entity';

@Injectable()
export class SiteDailyLogRepository extends ContractScopedRepository<SiteDailyLog> {
  constructor(
    @InjectRepository(SiteDailyLog) repository: Repository<SiteDailyLog>,
  ) {
    super(repository);
  }
}
