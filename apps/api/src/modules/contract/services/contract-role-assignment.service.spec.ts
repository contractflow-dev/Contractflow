import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractRole,
  EPartyType,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractRoleAssignmentService } from './contract-role-assignment.service';

describe('ContractRoleAssignmentService', () => {
  const actor = {
    id: 'actor-membership',
    userId: 'actor-user',
    companyId: 'company-1',
    companyRole: ECompanyRole.COMPANY_ADMIN,
    status: ECompanyUserStatus.ACTIVE,
  };
  const target = {
    id: 'target-membership',
    userId: 'target-user',
    companyId: 'company-1',
    companyRole: ECompanyRole.FINANCE_OFFICER,
    status: ECompanyUserStatus.ACTIVE,
  };
  const party = {
    id: 'party-1',
    contractId: 'contract-1',
    companyId: 'company-1',
    partyType: EPartyType.CONTRACTOR,
  };
  const assignment = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    companyId: 'company-1',
    contractPartyId: party.id,
    companyUserId: target.id,
    role: EContractRole.FINANCE_OFFICER,
    isWorkspaceAdmin: false,
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    assignedById: actor.id,
    revokedAt: null,
    revokedById: null,
    companyUser: {
      user: {
        firstName: 'Casey',
        lastName: 'Member',
        email: 'casey@example.test',
      },
    },
  };

  const companyUsers = { findActiveMember: vi.fn() };
  const parties = { findOne: vi.fn() };
  const assignments = {
    findActiveForParty: vi.fn(),
    hasWorkspaceAdmin: vi.fn(),
    countActiveWorkspaceAdmins: vi.fn(),
    findActiveDuplicate: vi.fn(),
    createInScope: vi.fn(),
    findByIdInPartyForUpdate: vi.fn(),
    revokeInScope: vi.fn(),
  };
  const repositories = new Map<
    unknown,
    Record<string, ReturnType<typeof vi.fn>>
  >();
  const manager = {
    getRepository: vi.fn((entity: unknown) => repositories.get(entity)),
  };
  const dataSource = {
    manager,
    getRepository: vi.fn((entity: unknown) => repositories.get(entity)),
    transaction: vi.fn(
      (callback: (transactionManager: typeof manager) => Promise<unknown>) =>
        callback(manager),
    ),
  };
  const mail = { sendContractRoleInvitationEmail: vi.fn() };
  let service: ContractRoleAssignmentService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositories.clear();
    manager.getRepository.mockImplementation((entity: unknown) =>
      repositories.get(entity),
    );
    dataSource.getRepository.mockImplementation((entity: unknown) =>
      repositories.get(entity),
    );
    dataSource.transaction.mockImplementation(
      (callback: (transactionManager: typeof manager) => Promise<unknown>) =>
        callback(manager),
    );
    companyUsers.findActiveMember.mockResolvedValue(actor);
    parties.findOne.mockResolvedValue(party);
    assignments.findActiveForParty.mockResolvedValue([]);
    assignments.hasWorkspaceAdmin.mockResolvedValue(false);
    assignments.findActiveDuplicate.mockResolvedValue(null);
    assignments.createInScope.mockImplementation(async (data) => ({
      ...assignment,
      ...data,
    }));
    assignments.findByIdInPartyForUpdate.mockResolvedValue(assignment);
    assignments.revokeInScope.mockImplementation(
      async (record, revokedAt, revokedById) => {
        record.revokedAt = revokedAt;
        record.revokedById = revokedById;
        return record;
      },
    );

    const companyUserRepository = {
      findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === 'actor-user') return actor;
        if (where.id === actor.id) return actor;
        if (where.id === target.id) return target;
        return null;
      }),
    };
    const partyRepository = {
      findOne: vi.fn().mockResolvedValue(party),
      manager,
    };
    const contractRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'contract-1' }),
    };
    const workspaceRepository = {
      findOne: vi.fn().mockResolvedValue({ contractId: 'contract-1' }),
    };
    const assignmentRepository = {
      findOne: vi.fn().mockResolvedValue(assignment),
    };
    const activityRepository = {
      create: vi.fn((data) => data),
      save: vi.fn(async (record) => record),
    };
    repositories.set(CompanyUser, companyUserRepository);
    repositories.set(Contract, contractRepository);
    repositories.set(ContractParty, partyRepository);
    repositories.set(ContractRoleAssignment, assignmentRepository);
    repositories.set(ContractWorkspaceEntity, workspaceRepository);
    repositories.set(ActivityLog, activityRepository);

    service = new ContractRoleAssignmentService(
      dataSource as never,
      assignments as never,
      companyUsers as never,
      mail as never,
      parties as never,
    );
  });

  it('lists assignments only for an active Company Admin and the selected workspace', async () => {
    assignments.findActiveForParty.mockResolvedValue([assignment]);

    const result = await service.list(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
    );

    expect(companyUsers.findActiveMember).toHaveBeenCalledWith('actor-user', {
      companyId: 'company-1',
    });
    expect(assignments.findActiveForParty).toHaveBeenCalledWith(
      party.id,
      'contract-1',
      [EContractRole.FINANCE_OFFICER, EContractRole.FINANCE_DIRECTOR],
      { companyId: 'company-1' },
    );
    expect(result[0]).toMatchObject({
      id: assignment.id,
      companyUserId: target.id,
      role: EContractRole.FINANCE_OFFICER,
      email: 'casey@example.test',
    });
  });

  it('does not expose assignments to non-admin company members', async () => {
    companyUsers.findActiveMember.mockResolvedValue({
      ...target,
      companyRole: ECompanyRole.FINANCE_OFFICER,
    });

    await expect(
      service.list('target-user', 'company-1', 'contract-1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assignments.findActiveForParty).not.toHaveBeenCalled();
  });

  it('rejects roles that do not belong to the selected workspace', async () => {
    await expect(
      service.assign(
        'actor-user',
        'company-1',
        'contract-1',
        'project',
        target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a role that is incompatible with the contract party type', async () => {
    await expect(
      service.assign(
        'actor-user',
        'company-1',
        'contract-1',
        'project',
        target.id,
        EContractRole.CLIENT_PROJECT_MANAGER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(assignments.createInScope).not.toHaveBeenCalled();
  });

  it('allows a workspace admin to manage assignments only within that workspace', async () => {
    const companyUserRepository = repositories.get(CompanyUser)!;
    companyUserRepository.findOne.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === 'actor-user' || where.id === actor.id) {
          return { ...actor, companyRole: ECompanyRole.FINANCE_OFFICER };
        }
        if (where.id === target.id) return target;
        return null;
      },
    );
    assignments.hasWorkspaceAdmin.mockResolvedValue(true);

    await service.assign(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
      target.id,
      EContractRole.FINANCE_OFFICER,
    );

    expect(assignments.hasWorkspaceAdmin).toHaveBeenCalledWith(
      actor.id,
      party.id,
      [EContractRole.FINANCE_OFFICER, EContractRole.FINANCE_DIRECTOR],
      { companyId: 'company-1' },
      manager,
    );
    expect(assignments.createInScope).toHaveBeenCalledWith(
      expect.objectContaining({ isWorkspaceAdmin: false }),
      { companyId: 'company-1' },
      manager,
    );
  });

  it('does not allow a workspace admin to grant workspace-admin privileges', async () => {
    const companyUserRepository = repositories.get(CompanyUser)!;
    companyUserRepository.findOne.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === 'target-user' || where.id === target.id) {
          return target;
        }
        return null;
      },
    );
    assignments.hasWorkspaceAdmin.mockResolvedValue(true);

    await expect(
      service.assign(
        'target-user',
        'company-1',
        'contract-1',
        'finance',
        target.id,
        EContractRole.FINANCE_OFFICER,
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assignments.createInScope).not.toHaveBeenCalled();
  });

  it('requires a Company Admin and an active company member to assign a role', async () => {
    const companyUserRepository = repositories.get(CompanyUser)!;
    companyUserRepository.findOne.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === 'actor-user') {
          return { ...actor, companyRole: ECompanyRole.FINANCE_OFFICER };
        }
        if (where.id === actor.id) {
          return { ...actor, companyRole: ECompanyRole.FINANCE_OFFICER };
        }
        if (where.id === target.id) return target;
        return null;
      },
    );

    await expect(
      service.assign(
        'actor-user',
        'company-1',
        'contract-1',
        'finance',
        target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assignments.createInScope).not.toHaveBeenCalled();
  });

  it('rejects targets who are no longer active company members', async () => {
    const companyUserRepository = repositories.get(CompanyUser)!;
    companyUserRepository.findOne.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.userId === 'actor-user' || where.id === actor.id)
          return actor;
        return null;
      },
    );

    await expect(
      service.assign(
        'actor-user',
        'company-1',
        'contract-1',
        'finance',
        target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(assignments.createInScope).not.toHaveBeenCalled();
  });

  it('rejects duplicate active assignments', async () => {
    assignments.findActiveDuplicate.mockResolvedValue(assignment);

    await expect(
      service.assign(
        'actor-user',
        'company-1',
        'contract-1',
        'finance',
        target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignments.createInScope).not.toHaveBeenCalled();
  });

  it('assigns an active company member and writes an audit event in the transaction', async () => {
    const result = await service.assign(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
      target.id,
      EContractRole.FINANCE_OFFICER,
    );
    const activityRepository = repositories.get(ActivityLog)!;

    expect(assignments.createInScope).toHaveBeenCalledWith(
      expect.objectContaining({
        contractPartyId: party.id,
        companyUserId: target.id,
        role: EContractRole.FINANCE_OFFICER,
        assignedById: actor.id,
        revokedAt: null,
      }),
      { companyId: 'company-1' },
      manager,
    );
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.role_assigned',
        contractId: 'contract-1',
        companyId: 'company-1',
      }),
    );
    expect(result).toMatchObject({
      id: assignment.id,
      revokedAt: null,
      role: EContractRole.FINANCE_OFFICER,
    });
  });

  it('revokes a scoped assignment and records the change', async () => {
    const result = await service.revoke(
      'actor-user',
      'company-1',
      'contract-1',
      assignment.id,
    );
    const activityRepository = repositories.get(ActivityLog)!;

    expect(assignments.findByIdInPartyForUpdate).toHaveBeenCalledWith(
      assignment.id,
      party.id,
      { companyId: 'company-1' },
      manager,
    );
    expect(assignments.revokeInScope).toHaveBeenCalledWith(
      assignment,
      expect.any(Date),
      actor.id,
      manager,
    );
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'contract.role_revoked' }),
    );
    expect(result.revokedById).toBe(actor.id);
  });

  it('prevents revoking the sole active workspace administrator', async () => {
    assignments.findByIdInPartyForUpdate.mockResolvedValue({
      ...assignment,
      isWorkspaceAdmin: true,
    });
    assignments.countActiveWorkspaceAdmins.mockResolvedValue(1);

    await expect(
      service.revoke('actor-user', 'company-1', 'contract-1', assignment.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignments.revokeInScope).not.toHaveBeenCalled();
  });

  it('returns not found when an assignment is outside the company party', async () => {
    assignments.findByIdInPartyForUpdate.mockResolvedValue(null);

    await expect(
      service.revoke(
        'actor-user',
        'company-1',
        'contract-1',
        'foreign-assignment',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(assignments.revokeInScope).not.toHaveBeenCalled();
  });

  it('rejects a repeated revocation', async () => {
    assignments.findByIdInPartyForUpdate.mockResolvedValue({
      ...assignment,
      revokedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    await expect(
      service.revoke('actor-user', 'company-1', 'contract-1', assignment.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignments.revokeInScope).not.toHaveBeenCalled();
  });
});
