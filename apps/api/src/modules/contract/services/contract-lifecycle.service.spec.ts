import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractType,
  EContractStatus,
  ECurrencyCode,
  EFromStatus,
  EPartyType,
  EToStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IContractLifecycleContext,
  IContractLifecycleUnitOfWork,
} from '../interfaces/contract-lifecycle-persistence.interface';
import { ContractLifecycleService } from './contract-lifecycle.service';

function createContext() {
  return {
    companies: {
      findActiveForShare: vi.fn(),
      findActiveVerifiedByEmail: vi.fn(),
    },
    memberships: { findActive: vi.fn(), findActiveForUpdate: vi.fn() },
    contracts: {
      findPermissionSnapshot: vi.fn(),
      findForUpdate: vi.fn(),
      findActiveForUpdate: vi.fn(),
      findActiveById: vi.fn(),
      create: vi.fn(),
      save: vi.fn(async (value) => value),
      parentWouldCreateCycle: vi.fn(),
    },
    parties: {
      find: vi.fn(),
      findForShare: vi.fn(),
      findByIdWithContractAndCompany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    },
    workspaces: {
      listWorkspaces: vi.fn(),
      addMany: vi.fn(),
      remove: vi.fn(),
    },
    roleAssignments: {
      hasActiveAssignment: vi.fn(),
      hasActiveAssignmentForShare: vi.fn(),
      revokeForWorkspaceRoles: vi.fn(),
      revokeAllForContract: vi.fn(),
    },
    roleInvitations: {
      revokePendingForWorkspace: vi.fn(),
      revokeAllPendingForContract: vi.fn(),
    },
    partyInvitations: {
      expirePendingBySource: vi.fn(),
      expireDuplicatePending: vi.fn(),
      findPendingDuplicate: vi.fn(),
      listBySource: vi.fn(),
      findBySourceAndIdForUpdate: vi.fn(),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      expireIfPending: vi.fn(),
      revokePendingBySource: vi.fn(),
      create: vi.fn(),
      save: vi.fn(async (value) => value),
    },
    statusHistory: { record: vi.fn() },
    activity: { record: vi.fn() },
  };
}

describe('ContractLifecycleService', () => {
  const contract = {
    id: 'contract-1',
    referenceNumber: 'CTR-001',
    status: EContractStatus.DRAFT,
    deletedAt: null as Date | null,
  };
  const actor = {
    id: 'membership-1',
    userId: 'user-1',
    companyId: 'company-1',
    companyRole: ECompanyRole.FINANCE_OFFICER,
    status: ECompanyUserStatus.ACTIVE,
  };
  const party = {
    id: 'party-1',
    contractId: contract.id,
    companyId: actor.companyId,
    partyType: EPartyType.CONTRACTOR,
  };
  const mail = { sendContractPartyInvitationEmail: vi.fn() };
  let context: ReturnType<typeof createContext>;
  let outcomes: { committed: number; rolledBack: number };
  let unitOfWork: { execute: ReturnType<typeof vi.fn> };
  let service: ContractLifecycleService;

  beforeEach(() => {
    vi.resetAllMocks();
    contract.status = EContractStatus.DRAFT;
    contract.deletedAt = null;
    context = createContext();
    context.contracts.save.mockImplementation(async (value) => value);
    context.partyInvitations.save.mockImplementation(async (value) => value);
    context.contracts.findActiveForUpdate.mockResolvedValue(contract);
    context.contracts.findForUpdate.mockResolvedValue(contract);
    context.contracts.findPermissionSnapshot.mockResolvedValue(contract);
    context.memberships.findActive.mockResolvedValue(actor);
    context.memberships.findActiveForUpdate.mockResolvedValue(actor);
    context.parties.find.mockResolvedValue(party);
    context.parties.findForShare.mockResolvedValue(party);
    context.roleAssignments.hasActiveAssignment.mockResolvedValue(true);
    context.roleAssignments.hasActiveAssignmentForShare.mockResolvedValue(true);

    outcomes = { committed: 0, rolledBack: 0 };
    unitOfWork = {
      execute: vi.fn(async (operation) => {
        try {
          const result = await operation(
            context as unknown as IContractLifecycleContext,
          );
          outcomes.committed += 1;
          return result;
        } catch (error) {
          outcomes.rolledBack += 1;
          throw error;
        }
      }),
    };
    service = new ContractLifecycleService(
      unitOfWork as unknown as IContractLifecycleUnitOfWork,
      mail as never,
    );
  });

  it('writes the status history and activity audit atomically', async () => {
    const result = await service.transition(
      actor.userId,
      actor.companyId,
      contract.id,
      { transition: 'activate', reason: 'Execution approved.' },
    );

    expect(result.status).toBe(EContractStatus.ACTIVE);
    expect(context.statusHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: EFromStatus.DRAFT,
        toStatus: EToStatus.ACTIVE,
        reason: 'Execution approved.',
        changedById: actor.id,
      }),
    );
    expect(context.activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.status_transitioned',
        changes: expect.objectContaining({
          fromStatus: EContractStatus.DRAFT,
          toStatus: EContractStatus.ACTIVE,
          reason: 'Execution approved.',
        }),
      }),
    );
    expect(unitOfWork.execute).toHaveBeenCalledOnce();
    expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
  });

  it('rolls the transition back when its audit write fails', async () => {
    context.activity.record.mockRejectedValue(new Error('audit write failed'));

    await expect(
      service.transition(actor.userId, actor.companyId, contract.id, {
        transition: 'activate',
        reason: 'Execution approved.',
      }),
    ).rejects.toThrow('audit write failed');
    expect(unitOfWork.execute).toHaveBeenCalledOnce();
    expect(context.contracts.save).toHaveBeenCalledOnce();
    expect(context.statusHistory.record).toHaveBeenCalledOnce();
    expect(outcomes).toEqual({ committed: 0, rolledBack: 1 });
  });

  it('rolls the transition back when the history write fails', async () => {
    context.statusHistory.record.mockRejectedValue(new Error('history failed'));

    await expect(
      service.transition(actor.userId, actor.companyId, contract.id, {
        transition: 'activate',
        reason: 'Execution approved.',
      }),
    ).rejects.toThrow('history failed');
    expect(context.activity.record).not.toHaveBeenCalled();
    expect(outcomes).toEqual({ committed: 0, rolledBack: 1 });
  });

  it('rejects lifecycle changes without an active project-lead assignment', async () => {
    context.roleAssignments.hasActiveAssignmentForShare.mockResolvedValue(
      false,
    );

    await expect(
      service.transition(actor.userId, actor.companyId, contract.id, {
        transition: 'activate',
        reason: 'Execution approved.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(context.statusHistory.record).not.toHaveBeenCalled();
    expect(context.activity.record).not.toHaveBeenCalled();
    expect(outcomes.rolledBack).toBe(1);
  });

  it('records the creating company separately from the acting membership and contract party', async () => {
    const creatorActor = {
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    };
    const newContract = {
      id: 'contract-created',
      createdByCompanyId: actor.companyId,
    };
    context.companies.findActiveForShare.mockResolvedValue({
      id: actor.companyId,
    });
    context.memberships.findActiveForUpdate.mockResolvedValue(creatorActor);
    context.contracts.create.mockResolvedValue(newContract);

    const created = await service.create(actor.userId, actor.companyId, {
      referenceNumber: 'CTR-002',
      title: 'New contract',
      contractType: EContractType.SERVICE,
      partyType: EPartyType.CONTRACTOR,
      workspaces: ['project'],
      originalValueMinor: 1000,
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      paymentTermsDays: 30,
      awardDate: '2026-01-01',
      startDate: '2026-01-02',
      endDate: '2026-12-31',
      defectsLiabilityDays: 365,
      timezone: 'Africa/Lagos',
    });

    expect(created).toBe(newContract);
    expect(context.contracts.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdByCompanyId: actor.companyId }),
    );
    expect(context.parties.create).toHaveBeenCalledWith({
      contractId: newContract.id,
      companyId: actor.companyId,
      partyType: EPartyType.CONTRACTOR,
    });
    expect(context.workspaces.addMany).toHaveBeenCalledWith(
      newContract.id,
      ['project'],
      creatorActor.id,
    );
    expect(context.statusHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: newContract.id,
        toStatus: EToStatus.DRAFT,
        changedById: creatorActor.id,
      }),
    );
    expect(unitOfWork.execute).toHaveBeenCalledOnce();
    expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
  });

  it('keeps creator administration distinct from project-lead transition access', async () => {
    await expect(
      service.managementPermissions(actor.userId, actor.companyId, contract.id),
    ).resolves.toEqual({
      canManage: false,
      canTransition: true,
      canRestore: false,
    });

    context.memberships.findActive.mockResolvedValue({
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    context.contracts.findPermissionSnapshot.mockResolvedValue({
      ...contract,
      createdByCompanyId: actor.companyId,
    });
    context.roleAssignments.hasActiveAssignment.mockResolvedValue(false);

    await expect(
      service.managementPermissions(actor.userId, actor.companyId, contract.id),
    ).resolves.toEqual({
      canManage: true,
      canTransition: false,
      canRestore: false,
    });
  });

  it('does not allow a non-admin party member to modify contract workspaces', async () => {
    context.companies.findActiveForShare.mockResolvedValue({
      id: actor.companyId,
    });
    context.contracts.findForUpdate.mockResolvedValue({
      ...contract,
      createdByCompanyId: actor.companyId,
    });

    await expect(
      service.updateWorkspaces(actor.userId, actor.companyId, contract.id, {
        workspaces: ['project'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(context.workspaces.listWorkspaces).not.toHaveBeenCalled();
    expect(context.workspaces.addMany).not.toHaveBeenCalled();
  });

  it('rejects invalid party-invitation tokens', async () => {
    context.partyInvitations.findByTokenHash.mockResolvedValue(null);

    await expect(
      service.getCompanyInvitationPreview('invalid-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.partyInvitations.expireIfPending).not.toHaveBeenCalled();
  });

  it('expires only a still-pending party invitation and commits before reporting expiry', async () => {
    context.partyInvitations.findByTokenHash.mockResolvedValue({
      id: 'invitation-1',
      status: 'pending',
      revokedAt: null,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    await expect(
      service.getCompanyInvitationPreview('expired-token'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(context.partyInvitations.expireIfPending).toHaveBeenCalledWith(
      'invitation-1',
    );
    expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
  });

  it('rejects reuse of an already accepted party invitation', async () => {
    const invitation = {
      id: 'invitation-1',
      sourceContractPartyId: party.id,
      targetCompanyId: 'target-company',
      status: 'accepted',
      revokedAt: null,
    };
    context.partyInvitations.findByTokenHash.mockResolvedValue(invitation);
    context.partyInvitations.findByTokenHashForUpdate.mockResolvedValue(
      invitation,
    );
    context.parties.findById.mockResolvedValue(party);

    await expect(
      service.respondToCompanyInvitation(
        actor.userId,
        'target-company',
        'used-token',
        'accept',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(context.partyInvitations.save).not.toHaveBeenCalled();
  });

  it('sends the invitation email before commit and rolls back when the later audit write fails', async () => {
    const creatorActor = {
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    };
    const target = { id: 'target', email: 'a@b.co', name: 'Target Co' };
    context.companies.findActiveForShare.mockResolvedValue({ id: 'company-1' });
    context.memberships.findActiveForUpdate.mockResolvedValue(creatorActor);
    context.contracts.findForUpdate.mockResolvedValue({
      ...contract,
      title: 'Contract',
      createdByCompanyId: actor.companyId,
    });
    context.parties.find.mockResolvedValue(null);
    context.parties.findForShare.mockResolvedValue(party);
    context.companies.findActiveVerifiedByEmail.mockResolvedValue([target]);
    context.partyInvitations.findPendingDuplicate.mockResolvedValue(null);
    context.partyInvitations.create.mockResolvedValue({ id: 'invitation-1' });
    context.activity.record.mockRejectedValue(new Error('audit write failed'));

    await expect(
      service.inviteCompany(actor.userId, actor.companyId, contract.id, {
        email: target.email,
        partyType: EPartyType.CONTRACTOR,
      } as never),
    ).rejects.toThrow('audit write failed');
    expect(mail.sendContractPartyInvitationEmail).toHaveBeenCalledOnce();
    expect(outcomes).toEqual({ committed: 0, rolledBack: 1 });
  });
});
