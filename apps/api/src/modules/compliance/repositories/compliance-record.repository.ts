import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ComplianceRecord } from '../entities/compliance-record.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class ComplianceRecordRepository extends ContractScopedRepository<ComplianceRecord> {
  constructor(
    @InjectRepository(ComplianceRecord)
    repository: Repository<ComplianceRecord>,
  ) {
    super(repository);
  }

  findByRequirement(complianceRequirementId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { complianceRequirementId } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  findByParty(contractPartyId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { contractPartyId } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  findByStatus(status: ComplianceRecord['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  /** Verified records expiring in [today, cutoff]; drives reminder notifications. */
  findExpiringBetween(today: string, cutoff: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'VERIFIED' })
      .andWhere('e.expiryDate >= :today AND e.expiryDate <= :cutoff', {
        today,
        cutoff,
      })
      .orderBy('e.expiryDate', 'ASC')
      .getMany();
  }

  findExpired(today: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.expiryDate < :today', { today })
      .orderBy('e.expiryDate', 'ASC')
      .getMany();
  }
}
