import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractVariation } from '../entities/contract-variation.entity';

@Injectable()
export class ContractVariationRepository extends ContractScopedRepository<ContractVariation> {
  constructor(
    @InjectRepository(ContractVariation)
    repository: Repository<ContractVariation>,
  ) {
    super(repository);
  }
}
