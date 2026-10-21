import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';

/**
 * contract_role_assignment has company_id but no contract_id: a contract is
 * reached through contract_party_id. "Active" means revoked_at IS NULL.
 */
@Injectable()
export class ContractRoleAssignmentRepository extends CompanyScopedRepository<ContractRoleAssignment> {
  constructor(
    @InjectRepository(ContractRoleAssignment)
    repository: Repository<ContractRoleAssignment>,
  ) {
    super(repository);
  }

  findActiveByCompanyUser(companyUserId: string, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.companyUserId = :companyUserId AND e.revokedAt IS NULL', {
        companyUserId,
      })
      .getMany();
  }

  findActiveByParty(contractPartyId: string, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere(
        'e.contractPartyId = :contractPartyId AND e.revokedAt IS NULL',
        { contractPartyId },
      )
      .getMany();
  }

  findActiveByRole(role: ContractRoleAssignment['role'], scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.role = :role AND e.revokedAt IS NULL', { role })
      .getMany();
  }

  /** For authorisation guards: does this user hold this role on this party right now? */
  async hasActiveRole(
    companyUserId: string,
    contractPartyId: string,
    role: ContractRoleAssignment['role'],
    scope: ICompanyScope,
  ): Promise<boolean> {
    const count = await this.scopedQuery(scope)
      .andWhere(
        'e.companyUserId = :companyUserId AND e.contractPartyId = :contractPartyId ' +
          'AND e.role = :role AND e.revokedAt IS NULL',
        { companyUserId, contractPartyId, role },
      )
      .getCount();
    return count > 0;
  }

  /** Full assignment history for one user (revoked rows included). */
  findHistoryByCompanyUser(companyUserId: string, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.companyUserId = :companyUserId', { companyUserId })
      .orderBy('e.assignedAt', 'DESC')
      .getMany();
  }
}
