import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import { ComplianceRecord } from '../entities/compliance-record.entity';
import { ComplianceRequirement } from '../entities/compliance-requirement.entity';
import { ComplianceRecordRepository } from '../repositories/compliance-record.repository';
import { ComplianceRequirementRepository } from '../repositories/compliance-requirement.repository';

@Injectable()
export class ComplianceService {
  readonly requirements: ContractResourceReader<ComplianceRequirement>;
  readonly records: ContractResourceReader<ComplianceRecord>;

  constructor(
    access: ContractAccessService,
    requirements: ComplianceRequirementRepository,
    records: ComplianceRecordRepository,
  ) {
    this.requirements = new ContractResourceReader(access, requirements, 'general', 'Compliance requirement');
    this.records = new ContractResourceReader(access, records, 'general', 'Compliance record');
  }
}
