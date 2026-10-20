import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ComplianceRecord } from '../entities/compliance-record.entity';

@Injectable()
export class ComplianceRecordRepository extends ContractScopedRepository<ComplianceRecord> {
  constructor(
    @InjectRepository(ComplianceRecord)
    repository: Repository<ComplianceRecord>,
  ) {
    super(repository);
  }
}
