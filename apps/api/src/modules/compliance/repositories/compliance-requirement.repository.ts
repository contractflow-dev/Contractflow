import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ComplianceRequirement } from '../entities/compliance-requirement.entity';

@Injectable()
export class ComplianceRequirementRepository extends ContractScopedRepository<ComplianceRequirement> {
  constructor(
    @InjectRepository(ComplianceRequirement)
    repository: Repository<ComplianceRequirement>,
  ) {
    super(repository);
  }
}
