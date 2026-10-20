import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseCorrectiveAction } from '../entities/hse-corrective-action.entity';

@Injectable()
export class HseCorrectiveActionRepository extends ContractScopedRepository<HseCorrectiveAction> {
  constructor(
    @InjectRepository(HseCorrectiveAction)
    repository: Repository<HseCorrectiveAction>,
  ) {
    super(repository);
  }
}
