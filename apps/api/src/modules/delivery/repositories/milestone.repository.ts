import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Milestone } from '../entities/milestone.entity';

@Injectable()
export class MilestoneRepository extends ContractScopedRepository<Milestone> {
  constructor(
    @InjectRepository(Milestone) repository: Repository<Milestone>,
  ) {
    super(repository);
  }
}
