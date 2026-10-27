import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import { EContractRole } from '@contractflow/contracts-schema';
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

  findActiveForParty(
    contractPartyId: string,
    contractId: string,
    roles: EContractRole[],
    scope: ICompanyScope,
    manager: EntityManager = this.repository.manager,
  ) {
    return manager
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoin('assignment.contractParty', 'party')
      .innerJoinAndSelect('assignment.companyUser', 'companyUser')
      .innerJoinAndSelect('companyUser.user', 'user')
      .where('assignment.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('assignment.contractPartyId = :contractPartyId', {
        contractPartyId,
      })
      .andWhere('party.contractId = :contractId', { contractId })
      .andWhere('party.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('assignment.role IN (:...roles)', { roles })
      .andWhere('assignment.revokedAt IS NULL')
      .orderBy('assignment.assignedAt', 'ASC')
      .addOrderBy('assignment.id', 'ASC')
      .getMany();
  }

  findActiveDuplicate(
    contractPartyId: string,
    companyUserId: string,
    role: EContractRole,
    scope: ICompanyScope,
    manager: EntityManager,
  ) {
    return manager.getRepository(ContractRoleAssignment).findOne({
      where: {
        companyId: scope.companyId,
        contractPartyId,
        companyUserId,
        role,
        revokedAt: IsNull(),
      },
    });
  }

  async hasWorkspaceAdmin(
    companyUserId: string,
    contractPartyId: string,
    roles: EContractRole[],
    scope: ICompanyScope,
    manager: EntityManager = this.repository.manager,
  ): Promise<boolean> {
    return (
      (await manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .where('assignment.companyId = :companyId', {
          companyId: scope.companyId,
        })
        .andWhere('assignment.contractPartyId = :contractPartyId', {
          contractPartyId,
        })
        .andWhere('assignment.companyUserId = :companyUserId', {
          companyUserId,
        })
        .andWhere('assignment.role IN (:...roles)', { roles })
        .andWhere('assignment.revokedAt IS NULL')
        .andWhere('assignment.isWorkspaceAdmin = true')
        .getCount()) > 0
    );
  }

  countActiveWorkspaceAdmins(
    contractPartyId: string,
    roles: EContractRole[],
    scope: ICompanyScope,
    manager: EntityManager,
  ): Promise<number> {
    return manager
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder('assignment')
      .where('assignment.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('assignment.contractPartyId = :contractPartyId', {
        contractPartyId,
      })
      .andWhere('assignment.role IN (:...roles)', { roles })
      .andWhere('assignment.revokedAt IS NULL')
      .andWhere('assignment.isWorkspaceAdmin = true')
      .getCount();
  }

  findByIdInPartyForUpdate(
    id: string,
    contractPartyId: string,
    scope: ICompanyScope,
    manager: EntityManager,
  ) {
    return manager
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder('assignment')
      .where('assignment.id = :id', { id })
      .andWhere('assignment.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('assignment.contractPartyId = :contractPartyId', {
        contractPartyId,
      })
      .setLock('pessimistic_write')
      .getOne();
  }

  async createInScope(
    data: Pick<
      ContractRoleAssignment,
      | 'contractPartyId'
      | 'companyUserId'
      | 'role'
      | 'isWorkspaceAdmin'
      | 'assignedAt'
      | 'assignedById'
      | 'revokedAt'
      | 'revokedById'
    >,
    scope: ICompanyScope,
    manager: EntityManager,
  ): Promise<ContractRoleAssignment> {
    const repository = manager.getRepository(ContractRoleAssignment);
    const assignment = repository.create({
      ...data,
      companyId: scope.companyId,
    });
    return repository.save(assignment);
  }

  async revokeInScope(
    assignment: ContractRoleAssignment,
    revokedAt: Date,
    revokedById: string,
    manager: EntityManager,
  ): Promise<ContractRoleAssignment> {
    assignment.revokedAt = revokedAt;
    assignment.revokedById = revokedById;
    return manager.getRepository(ContractRoleAssignment).save(assignment);
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
