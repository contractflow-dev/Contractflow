import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractStatus,
  EPartyType,
  EClientContractRole,
  EContractorContractRole,
  type ContractRole,
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
    companyRole: ECompanyRole.MEMBER,
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
    role: EContractorContractRole.FINANCE_OFFICER,
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
    role: EContractorContractRole.FINANCE_OFFICER,
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
        // The caller's own roles on the party (contract visibility).
        listActiveForMember: vi.fn(
          async (): Promise<
            Array<{ role: ContractRole; isWorkspaceAdmin: boolean }>
          > => [],
        ),
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
      [
        EContractorContractRole.FINANCE_OFFICER,
        EContractorContractRole.FINANCE_DIRECTOR,
      ],
    );
    expect(result[0]).toMatchObject({
      id: assignment.id,
      companyUserId: target.id,
      role: EContractorContractRole.FINANCE_OFFICER,
      email: 'casey@example.test',
    });
  });

  describe('listForCompany', () => {
    const row = {
      id: assignment.id,
      contractId: 'contract-1',
      contractReference: 'CTR-001',
      contractTitle: 'Pipeline integrity',
      contractStatus: EContractStatus.ACTIVE,
      companyUserId: target.id,
      firstName: 'Casey',
      lastName: 'Member',
      email: 'casey@example.test',
      role: EContractorContractRole.HSE_OFFICER,
      isWorkspaceAdmin: true,
      assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    beforeEach(() => {
      persistence.assignments.listActiveForCompany = vi
        .fn()
        .mockResolvedValue({ items: [row], total: 1 });
    });

    it('lists the header company only, narrowed to the workspace roles', async () => {
      const result = await service.listForCompany('actor-user', 'company-1', {
        page: 1,
        limit: 20,
        workspace: 'hse',
        companyUserId: target.id,
      });

      expect(persistence.assignments.listActiveForCompany).toHaveBeenCalledWith(
        'company-1',
        {
          companyUserId: target.id,
          roles: [
            EContractorContractRole.HSE_OFFICER,
            EContractorContractRole.HSE_MANAGER,
          ],
        },
        { skip: 0, take: 20 },
      );
      expect(result.data[0]).toMatchObject({
        id: assignment.id,
        workspace: 'hse',
        assignedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(result.meta.totalItems).toBe(1);
    });

    it('is refused to members who are not Company Administrators', async () => {
      await expect(
        service.listForCompany('target-user', 'company-1', {
          page: 1,
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.listForCompany('stranger', 'company-1', { page: 1, limit: 20 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        persistence.assignments.listActiveForCompany,
      ).not.toHaveBeenCalled();
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
        EContractorContractRole.FINANCE_OFFICER,
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
        EClientContractRole.CLIENT_PROJECT_MANAGER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
  });

  describe('client and contractor role sides', () => {
    it.each([
      [
        EPartyType.CLIENT,
        'project',
        'client',
        [
          EClientContractRole.CLIENT_PROJECT_MANAGER,
          EClientContractRole.CLIENT_SITE_ENGINEER,
        ],
      ],
      [
        EPartyType.CONTRACTOR,
        'project',
        'contractor',
        [
          EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
          EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
        ],
      ],
      [
        EPartyType.VENDOR,
        'hse',
        'contractor',
        [
          EContractorContractRole.HSE_OFFICER,
          EContractorContractRole.HSE_MANAGER,
        ],
      ],
      [
        EPartyType.CLIENT,
        'finance',
        'client',
        [
          EClientContractRole.FINANCE_OFFICER,
          EClientContractRole.FINANCE_DIRECTOR,
        ],
      ],
    ] as const)(
      'offers a %s party in %s only its %s roles',
      async (partyType, workspace, roleSide, roles) => {
        persistence.parties.findByContractAndCompany = vi.fn(async () => ({
          ...party,
          partyType,
        }));

        await expect(
          service.managementPermissions(
            'actor-user',
            'company-1',
            'contract-1',
            workspace,
          ),
        ).resolves.toEqual({
          canManage: true,
          canGrantWorkspaceAdmin: true,
          roleSide,
          roles: [...roles],
        });
      },
    );

    it.each([
      [
        EPartyType.CLIENT,
        'project',
        EClientContractRole.CLIENT_PROJECT_MANAGER,
      ],
      [EPartyType.CLIENT, 'project', EClientContractRole.CLIENT_SITE_ENGINEER],
      [EPartyType.CLIENT, 'hse', EClientContractRole.HSE_OFFICER],
      [EPartyType.CLIENT, 'finance', EClientContractRole.FINANCE_DIRECTOR],
      [
        EPartyType.CONTRACTOR,
        'project',
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      ],
      [EPartyType.CONTRACTOR, 'hse', EContractorContractRole.HSE_MANAGER],
      [
        EPartyType.CONTRACTOR,
        'finance',
        EContractorContractRole.FINANCE_OFFICER,
      ],
      [
        EPartyType.SUBCONTRACTOR,
        'project',
        EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
      ],
      [EPartyType.VENDOR, 'finance', EContractorContractRole.FINANCE_DIRECTOR],
      [EPartyType.OTHER, 'hse', EContractorContractRole.HSE_OFFICER],
    ] as const)(
      'assigns a %s party its own side’s role (%s: %s)',
      async (partyType, workspace, role) => {
        transactionContext.parties.findForUpdate = vi.fn(async () => ({
          ...party,
          partyType,
        }));

        await service.assign(
          'actor-user',
          'company-1',
          'contract-1',
          workspace,
          target.id,
          role,
        );

        expect(transactionContext.assignments.create).toHaveBeenCalledWith(
          'company-1',
          expect.objectContaining({ role }),
        );
      },
    );

    it.each([
      [EPartyType.CLIENT, EContractorContractRole.CONTRACTOR_PROJECT_LEAD],
      [EPartyType.CLIENT, EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR],
      [EPartyType.CONTRACTOR, EClientContractRole.CLIENT_PROJECT_MANAGER],
      [EPartyType.SUBCONTRACTOR, EClientContractRole.CLIENT_SITE_ENGINEER],
      [EPartyType.VENDOR, EClientContractRole.CLIENT_PROJECT_MANAGER],
      [EPartyType.OTHER, EClientContractRole.CLIENT_SITE_ENGINEER],
    ] as const)(
      'refuses a %s party the other side’s role %s, for assignments and invitations',
      async (partyType, role) => {
        transactionContext.parties.findForUpdate = vi.fn(async () => ({
          ...party,
          partyType,
        }));

        await expect(
          service.assign(
            'actor-user',
            'company-1',
            'contract-1',
            'project',
            target.id,
            role,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.invite(
            'actor-user',
            'company-1',
            'contract-1',
            'project',
            'someone@example.com',
            role,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(transactionContext.assignments.create).not.toHaveBeenCalled();
        expect(transactionContext.invitations.create).not.toHaveBeenCalled();
      },
    );

    it.each([
      'Owner',
      'Company Administrator',
      'Member',
      'Workspace Admin',
      '',
    ])(
      'rejects the unknown role %j without opening a unit of work',
      async (role) => {
        await expect(
          service.assign(
            'actor-user',
            'company-1',
            'contract-1',
            'project',
            target.id,
            role as ContractRole,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.invite(
            'actor-user',
            'company-1',
            'contract-1',
            'project',
            'someone@example.com',
            role as ContractRole,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(execute).not.toHaveBeenCalled();
      },
    );
  });

  it('allows workspace admins only within their workspace and not to grant admin privileges', async () => {
    transactionContext.memberships.findActiveMember = vi.fn(
      async (_companyId, userId) =>
        userId === 'target-user'
          ? { ...target, companyRole: ECompanyRole.MEMBER }
          : null,
    );
    transactionContext.memberships.findActiveById = vi.fn(async () => ({
      ...target,
      companyRole: ECompanyRole.MEMBER,
    }));
    transactionContext.assignments.hasWorkspaceAdmin = vi.fn(async () => true);
    // A Workspace Admin holds the role their admin rights are attached to.
    transactionContext.assignments.listActiveForMember = vi.fn(async () => [
      { role: EContractorContractRole.FINANCE_OFFICER, isWorkspaceAdmin: true },
    ]);

    await expect(
      service.assign(
        'target-user',
        'company-1',
        'contract-1',
        'finance',
        target.id,
        EContractorContractRole.FINANCE_OFFICER,
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
        EContractorContractRole.FINANCE_OFFICER,
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
      EContractorContractRole.FINANCE_OFFICER,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(transactionContext.assignments.create).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({
        contractPartyId: party.id,
        companyUserId: target.id,
        role: EContractorContractRole.FINANCE_OFFICER,
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
      role: EContractorContractRole.FINANCE_OFFICER,
    });
  });

  it('emails a role invitation naming the inviting company, without accepting it', async () => {
    await service.invite(
      'actor-user',
      'company-1',
      'contract-1',
      'finance',
      'Someone@Example.com',
      EContractorContractRole.FINANCE_OFFICER,
    );

    expect(mail.sendContractRoleInvitationEmail).toHaveBeenCalledWith(
      'someone@example.com',
      'Sample contract',
      EContractorContractRole.FINANCE_OFFICER,
      'finance',
      expect.any(String),
      'Sample company',
    );
    expect(transactionContext.invitations.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', respondedAt: null }),
    );
    expect(transactionContext.assignments.create).not.toHaveBeenCalled();
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
        EContractorContractRole.FINANCE_OFFICER,
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
