import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractStage } from '../entities/contract-stage.entity';

@Injectable()
export class ContractStageRepository extends ContractScopedRepository<ContractStage> {
  constructor(
    @InjectRepository(ContractStage) repository: Repository<ContractStage>,
  ) {
    super(repository);
  }
}
