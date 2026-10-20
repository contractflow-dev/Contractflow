import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseIncident } from '../entities/hse-incident.entity';

@Injectable()
export class HseIncidentRepository extends ContractScopedRepository<HseIncident> {
  constructor(
    @InjectRepository(HseIncident) repository: Repository<HseIncident>,
  ) {
    super(repository);
  }
}
