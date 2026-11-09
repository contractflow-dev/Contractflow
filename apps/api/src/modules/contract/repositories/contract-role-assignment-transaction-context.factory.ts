import type { EntityManager } from 'typeorm';
import { IsNull, LessThanOrEqual } from 'typeorm';
import { ECompanyUserStatus } from '@contractflow/contracts-schema';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../entities/contract-role-invitation.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import type {
  IContractRoleAssignmentTransactionContext,
  IRoleAssignmentRecord,
  IRoleInvitationRecord,
} from '../interfaces/contract-role-assignment-persistence.interface';

export class ContractRoleAssignmentTransactionContextFactory implements ITransactionContextFactory<IContractRoleAssignmentTransactionContext> {
  create(manager: EntityManager): IContractRoleAssignmentTransactionContext {
    return new TypeOrmContractRoleAssignmentContext(manager);
  }
}

export class TypeOrmContractRoleAssignmentContext implements IContractRoleAssignmentTransactionContext {
  constructor(private readonly manager: EntityManager) {}

  memberships = {
    findActiveMember: (companyId: string, userId: string) =>
      this.manager.getRepository(CompanyUser).findOne({
        where: {
          companyId,
          userId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
      }),
    findActiveById: (companyId: string, id: string) =>
      this.manager.getRepository(CompanyUser).findOne({
        where: {
          companyId,
          id,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      }),
    findActiveByEmail: async (companyId: string, email: string) =>
      this.manager
        .getRepository(CompanyUser)
        .createQueryBuilder('membership')
        .innerJoin('membership.user', 'user')
        .where('membership.companyId = :companyId', { companyId })
        .andWhere('membership.status = :active', {
          active: ECompanyUserStatus.ACTIVE,
        })
        .andWhere('membership.leftAt IS NULL')
        .andWhere('LOWER(user.email) = :email', { email })
        .getOne(),
    listEligible: async (companyId: string) => {
      const members = await this.manager
        .getRepository(CompanyUser)
        .createQueryBuilder('membership')
        .innerJoinAndSelect('membership.user', 'user')
        .where('membership.companyId = :companyId', { companyId })
        .andWhere('membership.status = :active', {
          active: ECompanyUserStatus.ACTIVE,
        })
        .andWhere('membership.leftAt IS NULL')
        .orderBy('user.lastName', 'ASC')
        .addOrderBy('user.firstName', 'ASC')
        .addOrderBy('membership.id', 'ASC')
        .getMany();
      return members.map((member) => ({
        id: member.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
      }));
    },
  };

  parties = {
    findByContractAndCompany: (contractId: string, companyId: string) =>
      this.manager.getRepository(ContractParty).findOne({
        where: { contractId, companyId },
      }),
    findByIdAndCompany: (id: string, companyId: string) =>
      this.manager.getRepository(ContractParty).findOne({
        where: { id, companyId },
      }),
    findByIdAndCompanyForUpdate: (id: string, companyId: string) =>
      this.manager.getRepository(ContractParty).findOne({
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      }),
    findForUpdate: async (contractId: string, companyId: string) => {
      const contract = await this.contracts.findActiveForUpdate(contractId);
      if (!contract) return null;
      return this.manager.getRepository(ContractParty).findOne({
        where: { contractId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
    },
  };

  contracts = {
    findActive: (contractId: string) =>
      this.manager.getRepository(Contract).findOne({
        where: { id: contractId, deletedAt: IsNull() },
        select: { id: true },
      }),
    findActiveForUpdate: (contractId: string) =>
      this.manager.getRepository(Contract).findOne({
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
        select: { id: true },
      }),
    findInvitationDetails: (contractId: string) =>
      this.manager.getRepository(Contract).findOne({
        where: { id: contractId, deletedAt: IsNull() },
        select: { id: true, title: true },
      }),
  };

  companies = {
    findName: async (companyId: string) =>
      (
        await this.manager.getRepository(Company).findOne({
          where: { id: companyId },
          select: { id: true, name: true },
        })
      )?.name ?? null,
  };

  workspaces = {
    exists: async (
      contractId: string,
      workspace: 'project' | 'hse' | 'finance',
    ) =>
      Boolean(
        await this.manager.getRepository(ContractWorkspaceEntity).findOne({
          where: { contractId, workspace },
          select: { contractId: true },
        }),
      ),
  };

  assignments = {
    listActiveForCompany: async (
      companyId: string,
      filters: {
        companyUserId?: string;
        roles?: ContractRoleAssignment['role'][];
      },
      page: { skip: number; take: number },
    ) => {
      const query = this.manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .innerJoin('assignment.contractParty', 'party')
        .innerJoin(Contract, 'contract', 'contract.id = party.contractId')
        .innerJoin('assignment.companyUser', 'companyUser')
        .innerJoin('companyUser.user', 'user')
        .where('assignment.companyId = :companyId', { companyId })
        // The role must come through the company's own party.
        .andWhere('party.companyId = :companyId', { companyId })
        .andWhere('assignment.revokedAt IS NULL')
        .andWhere('contract.deletedAt IS NULL');
      if (filters.companyUserId) {
        query.andWhere('assignment.companyUserId = :companyUserId', {
          companyUserId: filters.companyUserId,
        });
      }
      if (filters.roles) {
        query.andWhere('assignment.role IN (:...roles)', {
          roles: filters.roles,
        });
      }
      const total = await query.clone().getCount();
      const rows = await query
        .select('assignment.id', 'id')
        .addSelect('contract.id', 'contractId')
        .addSelect('contract.referenceNumber', 'contractReference')
        .addSelect('contract.title', 'contractTitle')
        .addSelect('contract.status', 'contractStatus')
        .addSelect('assignment.companyUserId', 'companyUserId')
        .addSelect('user.firstName', 'firstName')
        .addSelect('user.lastName', 'lastName')
        .addSelect('user.email', 'email')
        .addSelect('assignment.role', 'role')
        .addSelect('assignment.isWorkspaceAdmin', 'isWorkspaceAdmin')
        .addSelect('assignment.assignedAt', 'assignedAt')
        .orderBy('contract.referenceNumber', 'ASC')
        .addOrderBy('user.lastName', 'ASC')
        .addOrderBy('user.firstName', 'ASC')
        .addOrderBy('assignment.id', 'ASC')
        .offset(page.skip)
        .limit(page.take)
        .getRawMany<{
          id: string;
          contractId: string;
          contractReference: string;
          contractTitle: string;
          contractStatus: Contract['status'];
          companyUserId: string;
          firstName: string;
          lastName: string;
          email: string;
          role: ContractRoleAssignment['role'];
          isWorkspaceAdmin: boolean;
          assignedAt: Date | string;
        }>();
      return {
        total,
        items: rows.map((row) => ({
          ...row,
          assignedAt: new Date(row.assignedAt),
        })),
      };
    },
    findActiveForParty: (
      companyId: string,
      partyId: string,
      contractId: string,
      roles: ContractRoleAssignment['role'][],
    ) =>
      this.manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .innerJoin('assignment.contractParty', 'party')
        .innerJoinAndSelect('assignment.companyUser', 'companyUser')
        .innerJoinAndSelect('companyUser.user', 'user')
        .where('assignment.companyId = :companyId', { companyId })
        .andWhere('assignment.contractPartyId = :partyId', { partyId })
        .andWhere('party.contractId = :contractId', { contractId })
        .andWhere('party.companyId = :companyId', { companyId })
        .andWhere('assignment.role IN (:...roles)', { roles })
        .andWhere('assignment.revokedAt IS NULL')
        .orderBy('assignment.assignedAt', 'ASC')
        .addOrderBy('assignment.id', 'ASC')
        .getMany(),
    hasWorkspaceAdmin: async (
      companyId: string,
      memberId: string,
      partyId: string,
      roles: ContractRoleAssignment['role'][],
    ) =>
      (await this.manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .where('assignment.companyId = :companyId', { companyId })
        .andWhere('assignment.contractPartyId = :partyId', { partyId })
        .andWhere('assignment.companyUserId = :memberId', { memberId })
        .andWhere('assignment.role IN (:...roles)', { roles })
        .andWhere('assignment.revokedAt IS NULL')
        .andWhere('assignment.isWorkspaceAdmin = true')
        .getCount()) > 0,
    countActiveWorkspaceAdmins: (
      companyId: string,
      partyId: string,
      roles: ContractRoleAssignment['role'][],
    ) =>
      this.manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .where('assignment.companyId = :companyId', { companyId })
        .andWhere('assignment.contractPartyId = :partyId', { partyId })
        .andWhere('assignment.role IN (:...roles)', { roles })
        .andWhere('assignment.revokedAt IS NULL')
        .andWhere('assignment.isWorkspaceAdmin = true')
        .getCount(),
    findActiveDuplicate: (
      companyId: string,
      partyId: string,
      memberId: string,
      role: ContractRoleAssignment['role'],
    ) =>
      this.manager.getRepository(ContractRoleAssignment).findOne({
        where: {
          companyId,
          contractPartyId: partyId,
          companyUserId: memberId,
          role,
          revokedAt: IsNull(),
        },
      }),
    create: async (
      companyId: string,
      data: Parameters<
        IContractRoleAssignmentTransactionContext['assignments']['create']
      >[1],
    ) => {
      const repository = this.manager.getRepository(ContractRoleAssignment);
      return repository.save(repository.create({ companyId, ...data }));
    },
    findByIdInPartyForUpdate: (
      companyId: string,
      id: string,
      partyId: string,
    ) =>
      this.manager
        .getRepository(ContractRoleAssignment)
        .createQueryBuilder('assignment')
        .where('assignment.id = :id', { id })
        .andWhere('assignment.companyId = :companyId', { companyId })
        .andWhere('assignment.contractPartyId = :partyId', { partyId })
        .setLock('pessimistic_write')
        .getOne(),
    revoke: async (
      assignment: IRoleAssignmentRecord,
      at: Date,
      actorId: string,
    ) => {
      const repository = this.manager.getRepository(ContractRoleAssignment);
      const entity = await repository.findOneByOrFail({ id: assignment.id });
      entity.revokedAt = at;
      entity.revokedById = actorId;
      return repository.save(entity);
    },
    save: async (assignment: IRoleAssignmentRecord) => {
      const repository = this.manager.getRepository(ContractRoleAssignment);
      const entity = await repository.findOneByOrFail({ id: assignment.id });
      entity.isWorkspaceAdmin = assignment.isWorkspaceAdmin;
      return repository.save(entity);
    },
    load: (companyId: string, partyId: string, id: string) =>
      this.manager.getRepository(ContractRoleAssignment).findOne({
        where: { id, contractPartyId: partyId, companyId },
        relations: { companyUser: { user: true } },
      }),
  };

  invitations = {
    expireForParty: async (
      partyId: string,
      workspace: 'project' | 'hse' | 'finance',
      at: Date,
    ) => {
      await this.manager.getRepository(ContractRoleInvitation).update(
        {
          contractPartyId: partyId,
          workspace,
          status: 'pending',
          expiresAt: LessThanOrEqual(at),
        },
        { status: 'expired' },
      );
    },
    listForParty: (
      companyId: string,
      partyId: string,
      workspace: 'project' | 'hse' | 'finance',
    ) =>
      this.manager.getRepository(ContractRoleInvitation).find({
        where: { contractPartyId: partyId, companyId, workspace },
        order: { createdAt: 'DESC', id: 'ASC' },
      }),
    findByTokenHash: (tokenHash: string) =>
      this.manager.getRepository(ContractRoleInvitation).findOne({
        where: { tokenHash },
      }),
    expirePending: async (
      partyId: string,
      email: string,
      role: ContractRoleInvitation['role'],
      at: Date,
    ) => {
      await this.manager.getRepository(ContractRoleInvitation).update(
        {
          contractPartyId: partyId,
          email,
          role,
          status: 'pending',
          expiresAt: LessThanOrEqual(at),
        },
        { status: 'expired' },
      );
    },
    findPending: (
      partyId: string,
      email: string,
      role: ContractRoleInvitation['role'],
    ) =>
      this.manager.getRepository(ContractRoleInvitation).findOne({
        where: { contractPartyId: partyId, email, role, status: 'pending' },
      }),
    create: async (
      data: Parameters<
        IContractRoleAssignmentTransactionContext['invitations']['create']
      >[0],
    ) => {
      const repository = this.manager.getRepository(ContractRoleInvitation);
      return repository.save(repository.create(data));
    },
    findByIdForUpdate: (
      id: string,
      partyId: string,
      companyId: string,
      tokenHash?: string,
    ) =>
      this.manager.getRepository(ContractRoleInvitation).findOne({
        where: {
          id,
          contractPartyId: partyId,
          companyId,
          ...(tokenHash ? { tokenHash } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      }),
    expireById: async (id: string) => {
      await this.manager
        .getRepository(ContractRoleInvitation)
        .update({ id, status: 'pending' }, { status: 'expired' });
    },
    save: async (invitation: IRoleInvitationRecord) => {
      const repository = this.manager.getRepository(ContractRoleInvitation);
      const entity = await repository.findOneByOrFail({ id: invitation.id });
      entity.status = invitation.status;
      entity.respondedAt = invitation.respondedAt;
      entity.revokedAt = invitation.revokedAt;
      return repository.save(entity);
    },
  };

  activities = {
    write: async (
      data: Parameters<
        IContractRoleAssignmentTransactionContext['activities']['write']
      >[0],
    ) => {
      const repository = this.manager.getRepository(ActivityLog);
      await repository.save(repository.create(data));
    },
  };
}
