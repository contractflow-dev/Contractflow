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

  findByRequirement(scope: IContractScope, complianceRequirementId: string) {
    return this.findAll(scope, {
      where: { complianceRequirementId } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  findByParty(scope: IContractScope, contractPartyId: string) {
    return this.findAll(scope, {
      where: { contractPartyId } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  findByStatus(scope: IContractScope, status: ComplianceRecord['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ComplianceRecord>,
    });
  }

  /** Verified records expiring in [today, cutoff]; drives reminder notifications. */
  findExpiringBetween(scope: IContractScope, today: string, cutoff: string) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'VERIFIED' })
      .andWhere('e.expiryDate >= :today AND e.expiryDate <= :cutoff', {
        today,
        cutoff,
      })
      .orderBy('e.expiryDate', 'ASC')
      .getMany();
  }

  findExpired(scope: IContractScope, today: string) {
    return this.scopedQuery(scope)
      .andWhere('e.expiryDate < :today', { today })
      .orderBy('e.expiryDate', 'ASC')
      .getMany();
  }
}
