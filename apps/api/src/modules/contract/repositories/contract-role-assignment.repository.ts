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

  /**
   * A member's active roles on each of the given contracts of the scoped
   * company, for the contract list. Only the member's own assignments.
   */
  async findActiveRolesForContracts(
    scope: ICompanyScope,
    companyUserId: string,
    contractIds: string[],
  ): Promise<
    Array<{ contractId: string; role: EContractRole; isWorkspaceAdmin: boolean }>
  > {
    if (!companyUserId || contractIds.length === 0) return [];
    const rows = await this.scopedQuery(scope)
      .innerJoin('e.contractParty', 'party')
      .andWhere('e.companyUserId = :companyUserId AND e.revokedAt IS NULL', {
        companyUserId,
      })
      .andWhere('party.contractId IN (:...contractIds)', { contractIds })
      .select('party.contractId', 'contractId')
      .addSelect('e.role', 'role')
      .addSelect('e.isWorkspaceAdmin', 'isWorkspaceAdmin')
      .orderBy('e.role', 'ASC')
      .getRawMany<{
        contractId: string;
        role: EContractRole;
        isWorkspaceAdmin: boolean;
      }>();
    return rows.map((row) => ({
      ...row,
      isWorkspaceAdmin: Boolean(row.isWorkspaceAdmin),
    }));
  }

  findActiveByCompanyUser(companyUserId: string, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.companyUserId = :companyUserId AND e.revokedAt IS NULL', {
        companyUserId,
      })
      .getMany();
  }

  findActiveForParty(
    scope: ICompanyScope,
    contractPartyId: string,
    contractId: string,
    roles: EContractRole[],
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
    scope: ICompanyScope,
    contractPartyId: string,
    companyUserId: string,
    role: EContractRole,
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
    scope: ICompanyScope,
    companyUserId: string,
    contractPartyId: string,
    roles: EContractRole[],
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
    scope: ICompanyScope,
    contractPartyId: string,
    roles: EContractRole[],
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
    scope: ICompanyScope,
    id: string,
    contractPartyId: string,
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
    scope: ICompanyScope,
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
    manager: EntityManager,
  ): Promise<ContractRoleAssignment> {
    const repository = manager.getRepository(ContractRoleAssignment);
    const assignment = repository.create({
      companyId: scope.companyId,
      ...data,
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

  /** For authoriation guards: does this user hold this role on this party right now? */
  async hasActiveRole(
    scope: ICompanyScope,
    companyUserId: string,
    contractPartyId: string,
    role: ContractRoleAssignment['role'],
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
  findHistoryByCompanyUser(scope: ICompanyScope, companyUserId: string) {
    return this.scopedQuery(scope)
      .andWhere('e.companyUserId = :companyUserId', { companyUserId })
      .orderBy('e.assignedAt', 'DESC')
      .getMany();
  }
}
