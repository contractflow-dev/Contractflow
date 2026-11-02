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
import type {
  IContractRoleAssignmentRepositories,
  IContractRoleAssignmentTransactionContext,
  IRoleAssignmentRecord,
  IRoleInvitationRecord,
} from '../interfaces/contract-role-assignment-persistence.interface';
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
  const assignment: IRoleAssignmentRecord = {
    id: 'assignment-1',
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
  const invitation: IRoleInvitationRecord = {
    id: 'invitation-1',
    contractPartyId: party.id,
    companyId: party.companyId,
    invitedById: actor.id,
    email: 'casey@example.test',
    tokenHash: 'token-hash',
    status: 'pending',
    workspace: 'finance',
    role: EContractRole.FINANCE_OFFICER,
    isWorkspaceAdmin: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    respondedAt: null,
    revokedAt: null,
  };

  let persistence: IContractRoleAssignmentRepositories;
  let transactionContext: IContractRoleAssignmentTransactionContext;
  let execute: ReturnType<typeof vi.fn>;
  let mail: { sendContractRoleInvitationEmail: ReturnType<typeof vi.fn> };
  let service: ContractRoleAssignmentService;

  function createPorts(): IContractRoleAssignmentRepositories {
    return {
      memberships: {
        findActiveMember: vi.fn(async (_companyId, userId) =>
          userId === actor.userId
            ? actor
            : userId === target.userId
              ? target
              : null,
        ),
        findActiveById: vi.fn(async (_companyId, id) =>
          id === actor.id ? actor : id === target.id ? target : null,
        ),
        findActiveByEmail: vi.fn(async () => null),
        listEligible: vi.fn(async () => []),
      },
      parties: {
        findByContractAndCompany: vi.fn(async () => party),
        findByIdAndCompany: vi.fn(async () => party),
        findByIdAndCompanyForUpdate: vi.fn(async () => party),
        findForUpdate: vi.fn(async () => party),
      },
      contracts: {
        findActive: vi.fn(async () => ({ id: 'contract-1' })),
        findActiveForUpdate: vi.fn(async () => ({ id: 'contract-1' })),
        findInvitationDetails: vi.fn(async () => ({
          id: 'contract-1',
          title: 'Sample contract',
        })),
      },
      companies: { findName: vi.fn(async () => 'Sample company') },
      workspaces: { exists: vi.fn(async () => true) },
      assignments: {
        findActiveForParty: vi.fn(async () => []),
        hasWorkspaceAdmin: vi.fn(async () => false),
        countActiveWorkspaceAdmins: vi.fn(async () => 2),
        findActiveDuplicate: vi.fn(async () => null),
        create: vi.fn(async () => assignment),
        findByIdInPartyForUpdate: vi.fn(async () => assignment),
        revoke: vi.fn(async (record, at, actorId) => ({
          ...record,
          revokedAt: at,
          revokedById: actorId,
        })),
        save: vi.fn(async (record) => record),
        load: vi.fn(async () => assignment),
      },
      invitations: {
        expireForParty: vi.fn(async () => undefined),
        listForParty: vi.fn(async () => []),
        findByTokenHash: vi.fn(async () => invitation),
        expirePending: vi.fn(async () => undefined),
        findPending: vi.fn(async () => null),
        create: vi.fn(async () => invitation),
        findByIdForUpdate: vi.fn(async () => invitation),
        expireById: vi.fn(async () => undefined),
        save: vi.fn(async (record) => record),
      },
      activities: { write: vi.fn(async () => undefined) },
    };
  }

  beforeEach(() => {
    persistence = createPorts();
    transactionContext = createPorts();
    execute = vi.fn(
      (
        operation: (
          context: IContractRoleAssignmentTransactionContext,
        ) => Promise<unknown>,
      ) => operation(transactionContext),
    );
    mail = { sendContractRoleInvitationEmail: vi.fn(async () => undefined) };
    service = new ContractRoleAssignmentService(
      persistence,
      { execute } as never,
      mail as never,
    );
  });

  it('lists only scoped assignments after active membership and workspace checks', async () => {
    persistence.assignments.findActiveForParty = vi
      .fn()
      .mockResolvedValue([assignment]);

    const result = await service.list(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
    );

    expect(persistence.memberships.findActiveMember).toHaveBeenCalledWith(
      'company-1',
      'actor-user',
    );
    expect(persistence.assignments.findActiveForParty).toHaveBeenCalledWith(
      'company-1',
      party.id,
      'contract-1',
      [EContractRole.FINANCE_OFFICER, EContractRole.FINANCE_DIRECTOR],
    );
    expect(result[0]).toMatchObject({
      id: assignment.id,
      companyUserId: target.id,
      role: EContractRole.FINANCE_OFFICER,
      email: 'casey@example.test',
    });
  });

  it('rejects inactive company membership before listing assignments', async () => {
    persistence.memberships.findActiveMember = vi.fn(async () => null);

    await expect(
      service.list('actor-user', 'company-1', 'contract-1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(persistence.assignments.findActiveForParty).not.toHaveBeenCalled();
  });

  it('rejects roles outside the selected workspace without opening a unit of work', async () => {
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
    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves party-type validation before creating an assignment', async () => {
    transactionContext.parties.findForUpdate = vi.fn(async () => ({
      ...party,
      partyType: EPartyType.CONTRACTOR,
    }));

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
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  it('allows workspace admins only within their workspace and not to grant admin privileges', async () => {
    transactionContext.memberships.findActiveMember = vi.fn(
      async (_companyId, userId) =>
        userId === 'target-user'
          ? { ...target, companyRole: ECompanyRole.FINANCE_OFFICER }
          : null,
    );
    transactionContext.memberships.findActiveById = vi.fn(async () => ({
      ...target,
      companyRole: ECompanyRole.FINANCE_OFFICER,
    }));
    transactionContext.assignments.hasWorkspaceAdmin = vi.fn(async () => true);

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
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive target membership in the requesting company', async () => {
    transactionContext.memberships.findActiveById = vi.fn(
      async (_companyId, id) => (id === actor.id ? actor : null),
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
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  it('commits assignment and activity through the same unit-of-work context', async () => {
    const result = await service.assign(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
      target.id,
      EContractRole.FINANCE_OFFICER,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(transactionContext.assignments.create).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({
        contractPartyId: party.id,
        companyUserId: target.id,
        role: EContractRole.FINANCE_OFFICER,
        assignedById: actor.id,
        revokedAt: null,
      }),
    );
    expect(transactionContext.activities.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.role_assigned',
        contractId: 'contract-1',
        companyId: 'company-1',
      }),
    );
    expect(persistence.assignments.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: assignment.id,
      revokedAt: null,
      role: EContractRole.FINANCE_OFFICER,
    });
  });

  it('rejects duplicate active assignments', async () => {
    transactionContext.assignments.findActiveDuplicate = vi
      .fn()
      .mockResolvedValue(assignment);

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
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  it('revokes only an assignment scoped to the company contract party', async () => {
    transactionContext.assignments.findByIdInPartyForUpdate = vi
      .fn()
      .mockResolvedValue(null);

    await expect(
      service.revoke(
        'actor-user',
        'company-1',
        'contract-1',
        'foreign-assignment',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      transactionContext.assignments.findByIdInPartyForUpdate,
    ).toHaveBeenCalledWith('company-1', 'foreign-assignment', party.id);
    expect(transactionContext.assignments.revoke).not.toHaveBeenCalled();
  });

  it('prevents revoking the sole active workspace administrator', async () => {
    transactionContext.assignments.findByIdInPartyForUpdate = vi.fn(
      async () => ({
        ...assignment,
        isWorkspaceAdmin: true,
      }),
    );
    transactionContext.assignments.countActiveWorkspaceAdmins = vi
      .fn()
      .mockResolvedValue(1);

    await expect(
      service.revoke('actor-user', 'company-1', 'contract-1', assignment.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transactionContext.assignments.revoke).not.toHaveBeenCalled();
  });

  it('accepts an invitation with membership, invitation, assignment and activity in one unit of work', async () => {
    transactionContext.memberships.findActiveMember = vi.fn(
      async (_companyId, userId) => (userId === target.userId ? target : null),
    );
    transactionContext.memberships.findActiveById = vi.fn(async () => target);
    transactionContext.assignments.load = vi.fn(async () => assignment);

    const result = await service.respondToInvitation(
      target.userId,
      invitation.email,
      true,
      'raw-token',
      'accept',
    );

    expect(
      transactionContext.parties.findByIdAndCompanyForUpdate,
    ).toHaveBeenCalledWith(invitation.contractPartyId, invitation.companyId);
    expect(transactionContext.memberships.findActiveById).toHaveBeenCalledWith(
      invitation.companyId,
      target.id,
    );
    expect(transactionContext.assignments.create).toHaveBeenCalledWith(
      invitation.companyId,
      expect.objectContaining({
        companyUserId: target.id,
        assignedById: invitation.invitedById,
      }),
    );
    expect(transactionContext.invitations.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted' }),
    );
    expect(transactionContext.activities.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'contract.role_assigned' }),
    );
    expect(result).toMatchObject({
      status: 'accepted',
      assignment: { id: assignment.id },
    });
  });

  it('rejects expired or reused invitation tokens without accepting them', async () => {
    transactionContext.invitations.findByTokenHash = vi.fn(async () => ({
      ...invitation,
      status: 'accepted',
    }));

    await expect(
      service.respondToInvitation(
        target.userId,
        invitation.email,
        true,
        'used-token',
        'accept',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(execute).toHaveBeenCalledOnce();
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  it('does not disclose a token preview when the invitation is invalid', async () => {
    persistence.invitations.findByTokenHash = vi.fn(async () => null);

    await expect(
      service.previewInvitation('invalid-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(persistence.invitations.expireById).not.toHaveBeenCalled();
  });
});
