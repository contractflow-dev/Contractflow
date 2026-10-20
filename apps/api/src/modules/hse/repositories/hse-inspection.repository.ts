import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseInspection } from '../entities/hse-inspection.entity';

@Injectable()
export class HseInspectionRepository extends ContractScopedRepository<HseInspection> {
  constructor(
    @InjectRepository(HseInspection) repository: Repository<HseInspection>,
  ) {
    super(repository);
  }
}
