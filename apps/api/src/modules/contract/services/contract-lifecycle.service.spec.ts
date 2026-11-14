import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EClientContractRole,
  ECompanyRole,
  ECompanyUserStatus,
  EContractorContractRole,
  EContractType,
  EContractStatus,
  EContractSiteStatus,
  ECountryCode,
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
      countActiveChildren: vi.fn(),
    },
    parties: {
      find: vi.fn(),
      countOtherParties: vi.fn(),
      findForShare: vi.fn(),
      findByIdWithContractAndCompany: vi.fn(),
      findById: vi.fn(),
      findForUpdate: vi.fn(),
      save: vi.fn(async (value) => value),
      create: vi.fn(),
    },
    workspaces: {
      listWorkspaces: vi.fn(),
      addMany: vi.fn(),
      remove: vi.fn(),
    },
    roleAssignments: {
      hasActiveAssignment: vi.fn(),
      hasAnyActiveAssignment: vi.fn(),
      hasActiveAssignmentForShare: vi.fn(),
      revokeForWorkspaceRoles: vi.fn(),
      countActiveForWorkspaceRoles: vi.fn(),
      revokeAllForContract: vi.fn(),
      countActiveForContract: vi.fn(),
    },
    roleInvitations: {
      revokePendingForWorkspace: vi.fn(),
      countPendingForWorkspace: vi.fn(),
      revokeAllPendingForContract: vi.fn(),
      countPendingForContract: vi.fn(),
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
      countPendingBySource: vi.fn(),
      create: vi.fn(),
      save: vi.fn(async (value) => value),
    },
    sites: {
      listByContract: vi.fn(),
      findForUpdate: vi.fn(),
      findByCode: vi.fn(),
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
    companyRole: ECompanyRole.MEMBER,
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
    context.roleAssignments.hasAnyActiveAssignment.mockResolvedValue(true);
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

  it('hides lifecycle permissions (404) from a member with no role on the contract', async () => {
    context.roleAssignments.hasAnyActiveAssignment.mockResolvedValue(false);
    await expect(
      service.managementPermissions(actor.userId, actor.companyId, contract.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    // A Company Administrator still sees them through oversight.
    context.memberships.findActive.mockResolvedValue({
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    await expect(
      service.managementPermissions(actor.userId, actor.companyId, contract.id),
    ).resolves.toMatchObject({ canTransition: true });
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
  describe('recordSignatory', () => {
    const adminActor = { ...actor, companyRole: ECompanyRole.COMPANY_ADMIN };
    const signatory = {
      signatoryFirstName: '  Ada ',
      signatoryLastName: 'Lovelace',
      signatoryTitle: 'Managing Director',
      signedAt: '2026-01-15',
    };

    beforeEach(() => {
      context.companies.findActiveForShare.mockResolvedValue({ id: 'company-1' });
      context.memberships.findActiveForUpdate.mockResolvedValue(adminActor);
      context.parties.findForUpdate.mockResolvedValue({
        ...party,
        signatoryFirstName: null,
        signatoryLastName: null,
        signatoryTitle: null,
        signedAt: null,
      });
      context.parties.save.mockImplementation(async (value) => value);
    });

    it("records the acting company's own signatory and audits it atomically", async () => {
      const result = await service.recordSignatory(
        actor.userId,
        actor.companyId,
        contract.id,
        signatory,
      );

      expect(context.parties.findForUpdate).toHaveBeenCalledWith(
        contract.id,
        actor.companyId,
      );
      expect(result).toMatchObject({
        id: party.id,
        companyId: actor.companyId,
        signatoryFirstName: 'Ada',
        signatoryLastName: 'Lovelace',
        signatoryTitle: 'Managing Director',
      });
      expect(result.signedAt?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contract.signatory_recorded',
          companyId: actor.companyId,
        }),
      );
      expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
    });

    it('requires a Company Administrator', async () => {
      context.memberships.findActiveForUpdate.mockResolvedValue(actor);

      await expect(
        service.recordSignatory(
          actor.userId,
          actor.companyId,
          contract.id,
          signatory,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(context.parties.save).not.toHaveBeenCalled();
    });

    it('does not let a company sign a contract it is not a party to', async () => {
      context.parties.findForUpdate.mockResolvedValue(null);

      await expect(
        service.recordSignatory(
          actor.userId,
          'other-company',
          contract.id,
          signatory,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(context.parties.save).not.toHaveBeenCalled();
    });

    it('rejects archived contracts', async () => {
      context.contracts.findActiveForUpdate.mockResolvedValue(null);

      await expect(
        service.recordSignatory(
          actor.userId,
          actor.companyId,
          contract.id,
          signatory,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(context.parties.save).not.toHaveBeenCalled();
    });

    it('rejects a signing date in the future', async () => {
      await expect(
        service.recordSignatory(actor.userId, actor.companyId, contract.id, {
          ...signatory,
          signedAt: '2999-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(unitOfWork.execute).not.toHaveBeenCalled();
    });
    it("reads only the acting company's signatory, and only for a Company Administrator", async () => {
      context.parties.find.mockResolvedValue({
        ...party,
        signatoryFirstName: 'Ada',
        signatoryLastName: 'Lovelace',
        signatoryTitle: 'Director',
        signedAt: new Date('2026-01-15T00:00:00.000Z'),
      });

      await expect(
        service.getSignatory(actor.userId, actor.companyId, contract.id),
      ).resolves.toMatchObject({ id: party.id, signatoryFirstName: 'Ada' });
      expect(context.parties.find).toHaveBeenCalledWith(
        contract.id,
        actor.companyId,
      );

      context.memberships.findActiveForUpdate.mockResolvedValue(actor);
      await expect(
        service.getSignatory(actor.userId, actor.companyId, contract.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
  describe('contract sites', () => {
    const adminActor = { ...actor, companyRole: ECompanyRole.COMPANY_ADMIN };
    const timestamp = new Date('2026-02-01T00:00:00.000Z');
    const siteInput = {
      name: 'North yard',
      siteCode: 'NY-01',
      addressLine1: '1 Quay Road',
      city: 'Lagos',
      stateRegion: 'Lagos',
      countryCode: ECountryCode.NG,
      latitudeE6: 6_524_379,
      longitudeE6: 3_379_206,
      status: EContractSiteStatus.PLANNED,
    };
    const storedSite = {
      ...siteInput,
      id: 'site-1',
      contractId: contract.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    beforeEach(() => {
      context.companies.findActiveForShare.mockResolvedValue({ id: 'company-1' });
      context.memberships.findActiveForUpdate.mockResolvedValue(adminActor);
      context.contracts.findForUpdate.mockResolvedValue({
        ...contract,
        createdByCompanyId: actor.companyId,
      });
      context.sites.findByCode.mockResolvedValue(null);
      context.sites.create.mockResolvedValue(storedSite);
      context.sites.save.mockImplementation(async (value) => value);
    });

    it("lets the creating company's administrator add a site and audits it", async () => {
      const result = await service.createSite(
        actor.userId,
        actor.companyId,
        contract.id,
        siteInput,
      );

      expect(context.sites.findByCode).toHaveBeenCalledWith(
        contract.id,
        'NY-01',
      );
      expect(context.sites.create).toHaveBeenCalledWith({
        ...siteInput,
        contractId: contract.id,
      });
      expect(result).toMatchObject({
        id: 'site-1',
        latitudeE6: 6_524_379,
        createdAt: '2026-02-01T00:00:00.000Z',
      });
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'contract.site_created' }),
      );
      expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
    });

    it('hides site management from companies that did not create the contract', async () => {
      context.contracts.findForUpdate.mockResolvedValue({
        ...contract,
        createdByCompanyId: 'another-company',
      });

      await expect(
        service.listSites(actor.userId, actor.companyId, contract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.createSite(actor.userId, actor.companyId, contract.id, siteInput),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(context.sites.listByContract).not.toHaveBeenCalled();
      expect(context.sites.create).not.toHaveBeenCalled();
    });

    it('requires a Company Administrator', async () => {
      context.memberships.findActiveForUpdate.mockResolvedValue(actor);

      await expect(
        service.createSite(actor.userId, actor.companyId, contract.id, siteInput),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(context.sites.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate site code on the same contract', async () => {
      context.sites.findByCode.mockResolvedValue(storedSite);

      await expect(
        service.createSite(actor.userId, actor.companyId, contract.id, siteInput),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(context.sites.create).not.toHaveBeenCalled();
    });

    it('updates only a site that belongs to the contract', async () => {
      context.sites.findForUpdate.mockResolvedValue({ ...storedSite });

      const result = await service.updateSite(
        actor.userId,
        actor.companyId,
        contract.id,
        'site-1',
        { name: ' Main yard ', status: EContractSiteStatus.ACTIVE },
      );

      expect(context.sites.findForUpdate).toHaveBeenCalledWith(
        contract.id,
        'site-1',
      );
      expect(result).toMatchObject({
        name: 'Main yard',
        status: EContractSiteStatus.ACTIVE,
        siteCode: 'NY-01',
      });
      expect(context.sites.findByCode).not.toHaveBeenCalled();

      context.sites.findForUpdate.mockResolvedValue(null);
      await expect(
        service.updateSite(actor.userId, actor.companyId, contract.id, 'other', {
          name: 'X',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty site update', async () => {
      await expect(
        service.updateSite(actor.userId, actor.companyId, contract.id, 'site-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(unitOfWork.execute).not.toHaveBeenCalled();
    });
  });

  describe('workspace management', () => {
    const admin = { ...actor, companyRole: ECompanyRole.COMPANY_ADMIN };
    const owned = { ...contract, createdByCompanyId: actor.companyId };

    beforeEach(() => {
      context.companies.findActiveForShare.mockResolvedValue({
        id: actor.companyId,
      });
      context.memberships.findActiveForUpdate.mockResolvedValue(admin);
      context.contracts.findForUpdate.mockResolvedValue(owned);
      context.workspaces.listWorkspaces.mockResolvedValue(['project']);
      context.roleAssignments.revokeForWorkspaceRoles.mockResolvedValue(3);
      context.roleInvitations.revokePendingForWorkspace.mockResolvedValue(1);
    });

    it('adds a workspace for the owning Company Administrator, with an audit entry and no access for anyone', async () => {
      await expect(
        service.addWorkspace(admin.userId, admin.companyId, contract.id, 'hse'),
      ).resolves.toEqual(['project', 'hse']);

      expect(context.workspaces.addMany).toHaveBeenCalledWith(
        contract.id,
        ['hse'],
        admin.id,
      );
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: contract.id,
          companyId: admin.companyId,
          actorUserId: admin.id,
          action: 'contract.workspaces_added',
          changes: { added: ['hse'] },
        }),
      );
      // Adding a workspace changes no role: the lifecycle context can only
      // revoke roles, and nothing was revoked either.
      expect(
        context.roleAssignments.revokeForWorkspaceRoles,
      ).not.toHaveBeenCalled();
      expect(
        context.roleInvitations.revokePendingForWorkspace,
      ).not.toHaveBeenCalled();
      expect(outcomes.committed).toBe(1);
    });

    it('refuses a workspace the contract already has', async () => {
      await expect(
        service.addWorkspace(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(context.workspaces.addMany).not.toHaveBeenCalled();
      expect(context.activity.record).not.toHaveBeenCalled();
    });

    it('treats a contract another company created as not found', async () => {
      context.contracts.findForUpdate.mockResolvedValue({
        ...contract,
        createdByCompanyId: 'another-company',
      });

      await expect(
        service.addWorkspace(admin.userId, admin.companyId, contract.id, 'hse'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.removeWorkspace(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.workspaceRemovalImpact(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(context.workspaces.addMany).not.toHaveBeenCalled();
      expect(context.workspaces.remove).not.toHaveBeenCalled();
    });

    it('refuses a member who is not a Company Administrator, including a workspace admin', async () => {
      // A workspace admin is an ordinary company member: their right covers
      // one workspace's roles, not the contract's workspaces.
      context.memberships.findActiveForUpdate.mockResolvedValue(actor);

      await expect(
        service.addWorkspace(actor.userId, actor.companyId, contract.id, 'hse'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.removeWorkspace(
          actor.userId,
          actor.companyId,
          contract.id,
          'project',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(context.workspaces.addMany).not.toHaveBeenCalled();
      expect(context.workspaces.remove).not.toHaveBeenCalled();
    });

    it('refuses an archived contract', async () => {
      context.contracts.findForUpdate.mockResolvedValue({
        ...owned,
        deletedAt: new Date(),
      });

      await expect(
        service.addWorkspace(admin.userId, admin.companyId, contract.id, 'hse'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes a workspace after revoking its roles and pending invitations, keeping their history', async () => {
      await expect(
        service.removeWorkspace(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).resolves.toEqual([]);

      expect(
        context.roleAssignments.revokeForWorkspaceRoles,
      ).toHaveBeenCalledWith(
        contract.id,
        expect.arrayContaining([
          EClientContractRole.CLIENT_PROJECT_MANAGER,
          EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
        ]),
        admin.id,
        expect.any(Date),
      );
      expect(
        context.roleInvitations.revokePendingForWorkspace,
      ).toHaveBeenCalledWith(contract.id, 'project', expect.any(Date));
      expect(context.workspaces.remove).toHaveBeenCalledWith(
        contract.id,
        'project',
      );
      // Revoked before the workspace goes, never left pointing at nothing.
      expect(
        context.roleAssignments.revokeForWorkspaceRoles.mock
          .invocationCallOrder[0],
      ).toBeLessThan(context.workspaces.remove.mock.invocationCallOrder[0]);
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contract.workspaces_removed',
          actorUserId: admin.id,
          changes: {
            removed: ['project'],
            revokedRoleAssignments: 3,
            revokedRoleInvitations: 1,
          },
        }),
      );
    });

    it('refuses to remove a workspace the contract does not have', async () => {
      await expect(
        service.removeWorkspace(
          admin.userId,
          admin.companyId,
          contract.id,
          'finance',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        context.roleAssignments.revokeForWorkspaceRoles,
      ).not.toHaveBeenCalled();
      expect(context.workspaces.remove).not.toHaveBeenCalled();
    });

    it('rolls the whole removal back when its audit entry cannot be written', async () => {
      context.activity.record.mockRejectedValueOnce(new Error('insert failed'));

      await expect(
        service.removeWorkspace(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).rejects.toThrow('insert failed');
      // One unit of work: revocations and the removal fail together.
      expect(unitOfWork.execute).toHaveBeenCalledOnce();
      expect(outcomes).toEqual({ committed: 0, rolledBack: 1 });
    });

    it('reports what removal would revoke, across parties, without changing anything', async () => {
      context.roleAssignments.countActiveForWorkspaceRoles.mockResolvedValue({
        assignments: 4,
        workspaceAdmins: 1,
      });
      context.roleInvitations.countPendingForWorkspace.mockResolvedValue(2);

      await expect(
        service.workspaceRemovalImpact(
          admin.userId,
          admin.companyId,
          contract.id,
          'project',
        ),
      ).resolves.toEqual({
        workspace: 'project',
        activeRoleAssignmentCount: 4,
        workspaceAdminCount: 1,
        pendingRoleInvitationCount: 2,
      });
      expect(
        context.roleAssignments.revokeForWorkspaceRoles,
      ).not.toHaveBeenCalled();
      expect(context.workspaces.remove).not.toHaveBeenCalled();
      expect(context.activity.record).not.toHaveBeenCalled();
    });

    it('records additions and removals when the whole set is replaced', async () => {
      await service.updateWorkspaces(
        admin.userId,
        admin.companyId,
        contract.id,
        {
          workspaces: ['hse', 'finance'],
        },
      );

      const actions = context.activity.record.mock.calls.map(([entry]) => [
        entry.action,
        entry.changes,
      ]);
      expect(actions).toEqual([
        [
          'contract.workspaces_removed',
          {
            removed: ['project'],
            revokedRoleAssignments: 3,
            revokedRoleInvitations: 1,
          },
        ],
        ['contract.workspaces_added', { added: ['hse', 'finance'] }],
      ]);
    });
  });

  describe('archiving (deleting) and restoring', () => {
    const admin = { ...actor, companyRole: ECompanyRole.COMPANY_ADMIN };
    let owned: typeof contract & {
      createdByCompanyId: string;
      deletedByCompanyUserId: string | null;
    };

    beforeEach(() => {
      owned = {
        ...contract,
        status: EContractStatus.ACTIVE,
        createdByCompanyId: actor.companyId,
        deletedByCompanyUserId: null,
      };
      context.companies.findActiveForShare.mockResolvedValue({
        id: actor.companyId,
      });
      context.memberships.findActiveForUpdate.mockResolvedValue(admin);
      context.contracts.findForUpdate.mockResolvedValue(owned);
      context.roleAssignments.revokeAllForContract.mockResolvedValue(4);
      context.roleInvitations.revokeAllPendingForContract.mockResolvedValue(2);
      context.partyInvitations.revokePendingBySource.mockResolvedValue(1);
    });

    it('archives the same contract for its creating Company Administrator, ending all access, in one transaction', async () => {
      await service.archive(admin.userId, admin.companyId, contract.id);

      expect(context.contracts.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: contract.id,
          deletedAt: expect.any(Date),
          deletedByCompanyUserId: admin.id,
          // The business status is kept, so restoring brings it back as it was.
          status: EContractStatus.ACTIVE,
        }),
      );
      expect(context.roleAssignments.revokeAllForContract).toHaveBeenCalledWith(
        contract.id,
        admin.id,
        expect.any(Date),
      );
      expect(
        context.roleInvitations.revokeAllPendingForContract,
      ).toHaveBeenCalledWith(contract.id, expect.any(Date));
      expect(
        context.partyInvitations.revokePendingBySource,
      ).toHaveBeenCalledWith(party.id, expect.any(Date));
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: contract.id,
          companyId: admin.companyId,
          actorUserId: admin.id,
          action: 'contract.deleted',
          changes: {
            deletedAt: expect.any(String),
            status: EContractStatus.ACTIVE,
            revokedRoleAssignments: 4,
            revokedRoleInvitations: 2,
            revokedPartyInvitations: 1,
          },
        }),
      );
      expect(unitOfWork.execute).toHaveBeenCalledOnce();
      expect(outcomes).toEqual({ committed: 1, rolledBack: 0 });
    });

    it('refuses to archive a contract that is already archived', async () => {
      owned.deletedAt = new Date('2026-02-01T00:00:00.000Z');

      await expect(
        service.archive(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(context.contracts.save).not.toHaveBeenCalled();
      expect(
        context.roleAssignments.revokeAllForContract,
      ).not.toHaveBeenCalled();
      expect(context.activity.record).not.toHaveBeenCalled();
    });

    it('treats a contract another company created as not found, for archiving and restoring', async () => {
      context.contracts.findForUpdate.mockResolvedValue({
        ...owned,
        createdByCompanyId: 'other-party-company',
      });

      await expect(
        service.archive(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.restore(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.deletionImpact(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(context.contracts.save).not.toHaveBeenCalled();
    });

    it('treats an unknown contract as not found', async () => {
      context.contracts.findForUpdate.mockResolvedValue(null);

      await expect(
        service.archive(admin.userId, admin.companyId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.restore(admin.userId, admin.companyId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses an ordinary member or workspace administrator of the creating company', async () => {
      // Workspace-admin rights belong to a role on one workspace; the member
      // is still an ordinary company member.
      context.memberships.findActiveForUpdate.mockResolvedValue(actor);

      await expect(
        service.archive(actor.userId, actor.companyId, contract.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.restore(actor.userId, actor.companyId, contract.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(context.contracts.save).not.toHaveBeenCalled();
    });

    it('rolls the archive back when its audit entry cannot be written', async () => {
      context.activity.record.mockRejectedValueOnce(new Error('insert failed'));

      await expect(
        service.archive(admin.userId, admin.companyId, contract.id),
      ).rejects.toThrow('insert failed');
      expect(outcomes).toEqual({ committed: 0, rolledBack: 1 });
    });

    it('restores the same contract and record, without restoring any access', async () => {
      owned.deletedAt = new Date('2026-02-01T00:00:00.000Z');
      owned.deletedByCompanyUserId = 'someone';

      const restored = await service.restore(
        admin.userId,
        admin.companyId,
        contract.id,
      );

      expect(restored).toMatchObject({
        id: contract.id,
        referenceNumber: contract.referenceNumber,
        status: EContractStatus.ACTIVE,
        deletedAt: null,
        deletedByCompanyUserId: null,
      });
      // Nothing is re-created or copied, and no role or invitation is restored.
      expect(context.contracts.create).not.toHaveBeenCalled();
      expect(context.parties.create).not.toHaveBeenCalled();
      expect(context.workspaces.addMany).not.toHaveBeenCalled();
      expect(
        context.roleAssignments.revokeAllForContract,
      ).not.toHaveBeenCalled();
      expect(context.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contract.restored',
          actorUserId: admin.id,
          changes: {
            restoredAt: expect.any(String),
            status: EContractStatus.ACTIVE,
          },
        }),
      );
    });

    it('refuses to restore a contract that is not archived, so a retry changes nothing', async () => {
      await expect(
        service.restore(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(context.contracts.save).not.toHaveBeenCalled();
      expect(context.activity.record).not.toHaveBeenCalled();
    });

    it('reports what archiving would end, without changing anything', async () => {
      context.roleAssignments.countActiveForContract.mockResolvedValue({
        assignments: 5,
        workspaceAdmins: 2,
      });
      context.roleInvitations.countPendingForContract.mockResolvedValue(3);
      context.partyInvitations.countPendingBySource.mockResolvedValue(1);
      context.parties.countOtherParties.mockResolvedValue(2);
      context.contracts.countActiveChildren.mockResolvedValue(1);

      await expect(
        service.deletionImpact(admin.userId, admin.companyId, contract.id),
      ).resolves.toEqual({
        activeRoleAssignmentCount: 5,
        workspaceAdminCount: 2,
        pendingRoleInvitationCount: 3,
        pendingPartyInvitationCount: 1,
        otherPartyCount: 2,
        subcontractCount: 1,
      });
      expect(context.parties.countOtherParties).toHaveBeenCalledWith(
        contract.id,
        admin.companyId,
      );
      expect(context.contracts.save).not.toHaveBeenCalled();
      expect(context.activity.record).not.toHaveBeenCalled();
    });

    it('has no deletion impact for an archived contract', async () => {
      owned.deletedAt = new Date();

      await expect(
        service.deletionImpact(admin.userId, admin.companyId, contract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
