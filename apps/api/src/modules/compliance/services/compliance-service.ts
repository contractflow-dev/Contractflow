import { Injectable } from '@nestjs/common';
import type {
  ComplianceRecord as ComplianceRecordResponse,
  ComplianceRequirement as ComplianceRequirementResponse,
} from '@contractflow/contracts-schema';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import {
  toComplianceRecordResponse,
  toComplianceRequirementResponse,
} from '../dto/compliance-response.dto';
import type { ComplianceRecord } from '../entities/compliance-record.entity';
import type { ComplianceRequirement } from '../entities/compliance-requirement.entity';
import { ComplianceRecordRepository } from '../repositories/compliance-record.repository';
import { ComplianceRequirementRepository } from '../repositories/compliance-requirement.repository';

@Injectable()
export class ComplianceService {
  readonly requirements: ContractResourceReader<
    ComplianceRequirement,
    ComplianceRequirementResponse
  >;
  readonly records: ContractResourceReader<
    ComplianceRecord,
    ComplianceRecordResponse
  >;

  constructor(
    access: ContractAccessService,
    requirements: ComplianceRequirementRepository,
    records: ComplianceRecordRepository,
  ) {
    this.requirements = new ContractResourceReader(
      access,
      requirements,
      'general',
      'Compliance requirement',
      toComplianceRequirementResponse,
    );
    this.records = new ContractResourceReader(
      access,
      records,
      'general',
      'Compliance record',
      toComplianceRecordResponse,
    );
  }
}
