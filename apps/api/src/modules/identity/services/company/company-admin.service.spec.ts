import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ICompanyAdminReadRepository,
  ICompanyAdminTransactionContext,
  ICompanyAdminUnitOfWork,
} from '../../interface/company-admin-persistence.interface';
import { CompanyScopeService } from './company-scope.service';
import { CompanyAdminService } from './company-admin.service';
import type { CompanyVerificationService } from './company-verification.service';
import { MailService } from '../../../mail/mail.service';

const companyId = '01JCOMPANY00000000000000000';
const actorId = '01JADMIN00000000000000000000';
const actorMembership = {
  id: '01JADMINMEMBERSHIP0000000000',
  companyId,
  userId: actorId,
  companyRole: ECompanyRole.COMPANY_ADMIN,
  status: ECompanyUserStatus.ACTIVE,
  leftAt: null,
};
const company = {
  id: companyId,
  name: 'Test Company',
  status: ECompanyStatus.ACTIVE,
};
const scopeArg = { companyId };

type Mocked<T> = { [K in keyof T]: ReturnType<typeof vi.fn> };

describe('CompanyAdminService', () => {
  let service: CompanyAdminService;
  let scope: { forUser: ReturnType<typeof vi.fn> };
  let reads: Mocked<ICompanyAdminReadRepository>;
  let mail: Record<string, ReturnType<typeof vi.fn>>;
  let companies: Mocked<ICompanyAdminTransactionContext['companies']>;
  let members: Mocked<ICompanyAdminTransactionContext['members']>;
  let users: Mocked<ICompanyAdminTransactionContext['users']>;
  let invitations: Mocked<ICompanyAdminTransactionContext['invitations']>;
  let auditLogs: Mocked<ICompanyAdminTransactionContext['auditLogs']>;
  let execute: ReturnType<typeof vi.fn>;
  let companyVerification: { sendAfterEmailChange: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    scope = { forUser: vi.fn().mockResolvedValue({ companyId }) };
    reads = {
      findActiveRole: vi.fn().mockResolvedValue(ECompanyRole.COMPANY_ADMIN),
      listMembers: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'membership-1',
            userId: 'user-1',
            companyRole: ECompanyRole.MEMBER,
            status: ECompanyUserStatus.ACTIVE,
            joinedAt: new Date('2026-01-01T00:00:00Z'),
            leftAt: null,
            user: {
              firstName: 'Ari',
              lastName: 'User',
              email: 'ari@example.com',
              passwordHash: 'never expose',
              isPlatformAdmin: true,
            },
          },
        ],
        total: 1,
      }),
      listInvitations: vi.fn(),
      findInvitationByTokenHash: vi.fn(),
      expireInvitation: vi.fn(),
      findCompanyName: vi.fn(),
      findMemberName: vi.fn().mockResolvedValue('Ada Admin'),
      listPendingInvitationsForEmail: vi.fn().mockResolvedValue([]),
    };
    mail = {
      sendCompanyInvitationEmail: vi.fn(),
      sendCompanyInvitationResponseEmail: vi.fn(),
    };
    companies = {
      lockById: vi.fn().mockResolvedValue({ ...company }),
      save: vi.fn(async (value) => value),
    };
    members = {
      lockActiveByUser: vi.fn().mockResolvedValue(actorMembership),
      lockActiveById: vi.fn().mockResolvedValue(null),
      lockAnyByUser: vi.fn().mockResolvedValue(null),
      findActiveByUser: vi.fn().mockResolvedValue(null),
      countActiveAdmins: vi.fn().mockResolvedValue(1),
      create: vi.fn(async (value) => value),
      save: vi.fn(async (value) => value),
    };
    users = {
      findIdByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue({
        firstName: 'New',
        lastName: 'Admin',
        email: 'new@example.com',
      }),
      findActiveMemberPerson: vi.fn().mockResolvedValue({
        email: 'inviter@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
      }),
    };
    invitations = {
      findActivePendingByEmail: vi.fn().mockResolvedValue(null),
      expirePendingByEmail: vi.fn(),
      lockById: vi.fn(),
      lockByTokenHash: vi.fn().mockResolvedValue(null),
      lockByIdForEmail: vi.fn().mockResolvedValue(null),
      findOtherActivePendingByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (entity) => ({
        id: 'invitation-1',
        createdAt: new Date(),
        ...entity,
      })),
      save: vi.fn(async (entity) => entity),
      revokePending: vi.fn().mockResolvedValue(true),
    };
    auditLogs = { append: vi.fn() };
    const context = {
      companies,
      members,
      users,
      invitations,
      auditLogs,
    } as unknown as ICompanyAdminTransactionContext;
    execute = vi.fn(async (operation) => operation(context));
    companyVerification = { sendAfterEmailChange: vi.fn() };
    service = new CompanyAdminService(
      scope as unknown as CompanyScopeService,
      mail as unknown as MailService,
      reads as unknown as ICompanyAdminReadRepository,
      { execute } as unknown as ICompanyAdminUnitOfWork,
      companyVerification as unknown as CompanyVerificationService,
    );
  });

  it('lists safe member fields only within the authorized company', async () => {
    const result = await service.listMembers(actorId, companyId, {
      search: 'ari',
      page: 1,
      limit: 20,
    });

    expect(scope.forUser).toHaveBeenCalledWith(actorId, companyId);
    expect(reads.findActiveRole).toHaveBeenCalledWith(scopeArg, actorId);
    expect(reads.listMembers).toHaveBeenCalledWith(scopeArg, {
      status: undefined,
      search: 'ari',
      page: 1,
      limit: 20,
    });
    expect(result).toMatchObject({
      meta: { totalItems: 1, itemCount: 1, currentPage: 1, itemsPerPage: 20 },
      data: [{ id: 'membership-1', email: 'ari@example.com' }],
    });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
    expect(result.data[0]).not.toHaveProperty('isPlatformAdmin');
  });

  it('denies an ordinary company member before querying member records', async () => {
    reads.findActiveRole.mockResolvedValueOnce(ECompanyRole.MEMBER);

    await expect(
      service.listMembers(actorId, companyId, { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reads.listMembers).not.toHaveBeenCalled();
  });

  it('does not let platform-wide identity bypass absent company membership', async () => {
    scope.forUser.mockRejectedValueOnce(
      new ForbiddenException('Active company membership is required.'),
    );

    await expect(
      service.listMembers('platform-admin-without-membership', companyId, {
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reads.listMembers).not.toHaveBeenCalled();
  });

  it('prevents a sole Company Admin from demoting their membership', async () => {
    members.lockActiveById.mockResolvedValueOnce({ ...actorMembership });

    await expect(
      service.updateMemberRole(actorId, companyId, actorMembership.id, {
        companyRole: ECompanyRole.MEMBER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(members.countActiveAdmins).toHaveBeenCalledWith(scopeArg);
    expect(members.save).not.toHaveBeenCalled();
  });

  it('prevents removal of the last active Company Administrator', async () => {
    members.lockActiveById.mockResolvedValueOnce({ ...actorMembership });

    await expect(
      service.removeMember(actorId, companyId, actorMembership.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(members.save).not.toHaveBeenCalled();
  });

  it('allows an administrator to appoint a replacement administrator first', async () => {
    members.lockActiveById.mockResolvedValueOnce({
      ...actorMembership,
      id: 'replacement-membership',
      userId: 'replacement-user',
      companyRole: ECompanyRole.MEMBER,
    });
    members.countActiveAdmins.mockResolvedValue(2);

    const result = await service.updateMemberRole(
      actorId,
      companyId,
      'replacement-membership',
      { companyRole: ECompanyRole.COMPANY_ADMIN },
    );

    expect(result.companyRole).toBe(ECompanyRole.COMPANY_ADMIN);
    expect(users.findById).toHaveBeenCalledWith('replacement-user');
    expect(members.save).toHaveBeenCalledWith(
      expect.objectContaining({ companyRole: ECompanyRole.COMPANY_ADMIN }),
    );
  });

  it('constrains member mutation lookups to the route company', async () => {
    await expect(
      service.removeMember(
        actorId,
        companyId,
        'membership-from-another-company',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(members.lockActiveById).toHaveBeenCalledWith(
      scopeArg,
      'membership-from-another-company',
    );
    expect(members.save).not.toHaveBeenCalled();
  });

  it('stores only an invitation-token hash and surfaces email delivery failures', async () => {
    mail.sendCompanyInvitationEmail.mockRejectedValueOnce(
      new Error('SMTP unavailable'),
    );

    await expect(
      service.inviteMember(actorId, companyId, {
        email: 'new.user@example.com',
        companyRole: ECompanyRole.MEMBER,
      }),
    ).rejects.toThrow('SMTP unavailable');

    expect(invitations.create).toHaveBeenCalledOnce();
    const invitation = invitations.create.mock.calls[0][0];
    const sentToken = mail.sendCompanyInvitationEmail.mock.calls[0][3];
    expect(invitation.tokenHash).toHaveLength(64);
    expect(invitation.tokenHash).not.toBe(sentToken);
    expect(invitation).not.toHaveProperty('token', sentToken);
    expect(invitation.companyId).toBe(companyId);
    expect(invitation.firstName).toBeNull();
    expect(invitation.lastName).toBeNull();
    expect(invitations.create.mock.invocationCallOrder[0]).toBeLessThan(
      mail.sendCompanyInvitationEmail.mock.invocationCallOrder[0],
    );
  });

  it('rejects duplicate active invitations before attempting delivery', async () => {
    invitations.findActivePendingByEmail.mockResolvedValueOnce({
      id: 'existing-invite',
    });

    await expect(
      service.inviteMember(actorId, companyId, {
        email: 'new.user@example.com',
        companyRole: ECompanyRole.MEMBER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(invitations.create).not.toHaveBeenCalled();
    expect(mail.sendCompanyInvitationEmail).not.toHaveBeenCalled();
  });

  it('accepts a verified invitation and creates the matching company membership atomically', async () => {
    invitations.lockByTokenHash.mockResolvedValueOnce({
      id: 'invitation-1',
      companyId,
      email: 'new.user@example.com',
      companyRole: ECompanyRole.MEMBER,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    });

    await expect(
      service.respondToInvitation(
        'new-user-id',
        'new.user@example.com',
        true,
        'A'.repeat(43),
        'accept',
      ),
    ).resolves.toEqual({ status: 'accepted', companyId });

    expect(execute).toHaveBeenCalledOnce();
    expect(members.lockAnyByUser).toHaveBeenCalledWith(scopeArg, 'new-user-id');
    expect(members.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        userId: 'new-user-id',
        companyRole: ECompanyRole.MEMBER,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: null,
      }),
    );
    expect(invitations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        acceptedAt: expect.any(Date),
      }),
    );
  });

  it('invites a Company Administrator with optional names and no contract role', async () => {
    await service.inviteMember(actorId, companyId, {
      email: 'new.admin@example.com',
      firstName: 'Ada',
      lastName: 'Obi',
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });

    const invitation = invitations.create.mock.calls[0][0];
    expect(invitation).toMatchObject({
      companyId,
      email: 'new.admin@example.com',
      firstName: 'Ada',
      lastName: 'Obi',
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    for (const key of ['role', 'contractRole', 'workspace', 'contractId']) {
      expect(invitation).not.toHaveProperty(key);
    }
    expect(mail.sendCompanyInvitationEmail).toHaveBeenCalledWith(
      'new.admin@example.com',
      expect.any(String),
      ECompanyRole.COMPANY_ADMIN,
      expect.any(String),
      'New Admin',
    );
  });

  it.each([ECompanyRole.COMPANY_ADMIN, ECompanyRole.MEMBER])(
    'accepting a %s invitation creates that membership and nothing else',
    async (companyRole) => {
      invitations.lockByTokenHash.mockResolvedValueOnce({
        id: 'invitation-1',
        companyId,
        email: 'new.user@example.com',
        companyRole,
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
      });

      await service.respondToInvitation(
        'new-user-id',
        'new.user@example.com',
        true,
        'A'.repeat(43),
        'accept',
      );

      expect(members.create).toHaveBeenCalledOnce();
      expect(members.create.mock.calls[0][0]).toMatchObject({
        companyId,
        userId: 'new-user-id',
        companyRole,
      });
      // The transaction only reaches company-level records (the company,
      // its members and users, the invitation and the company audit log):
      // there is no contract role, party or workspace repository to write to.
      const [operation] = execute.mock.calls[0];
      const touched: string[] = [];
      const spy = new Proxy(
        { companies, members, users, invitations, auditLogs },
        {
          get(target, key: string) {
            touched.push(key);
            return target[key as keyof typeof target];
          },
        },
      );
      invitations.lockByTokenHash.mockResolvedValueOnce({
        id: 'invitation-2',
        companyId,
        email: 'new.user@example.com',
        companyRole,
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
      });
      await operation(spy);
      expect(new Set(touched)).toEqual(
        new Set(['invitations', 'companies', 'members', 'users', 'auditLogs']),
      );
    },
  );

  it('keeps a returning member’s job title when they accept again', async () => {
    invitations.lockByTokenHash.mockResolvedValueOnce({
      id: 'invitation-1',
      companyId,
      email: 'back@example.com',
      companyRole: ECompanyRole.MEMBER,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    });
    members.lockAnyByUser.mockResolvedValueOnce({
      id: 'old-membership',
      companyId,
      userId: 'returning-user',
      companyRole: ECompanyRole.MEMBER,
      jobTitle: 'Quantity Surveyor',
      status: ECompanyUserStatus.INACTIVE,
      leftAt: new Date('2026-01-01'),
    });

    await service.respondToInvitation(
      'returning-user',
      'back@example.com',
      true,
      'A'.repeat(43),
      'accept',
    );

    expect(members.create).not.toHaveBeenCalled();
    expect(members.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'old-membership',
        jobTitle: 'Quantity Surveyor',
        status: ECompanyUserStatus.ACTIVE,
        leftAt: null,
      }),
    );
  });

  it('rejects invitation acceptance from a different account email', async () => {
    invitations.lockByTokenHash.mockResolvedValueOnce({
      id: 'invitation-1',
      companyId,
      email: 'intended@example.com',
      companyRole: ECompanyRole.MEMBER,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    await expect(
      service.respondToInvitation(
        'other-user-id',
        'other@example.com',
        true,
        'A'.repeat(43),
        'accept',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.create).not.toHaveBeenCalled();
    expect(members.save).not.toHaveBeenCalled();
  });

  it('requires verified email before accepting or declining', async () => {
    await expect(
      service.respondToInvitation(
        'user-id',
        'person@example.com',
        false,
        'A'.repeat(43),
        'accept',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('updates only the selected company profile inside an authorized transaction', async () => {
    const response = await service.updateCompanyProfile(actorId, companyId, {
      name: 'Updated name',
    });

    expect(response.name).toBe('Updated name');
    expect(companies.lockById).toHaveBeenNthCalledWith(2, scopeArg);
    expect(companies.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: companyId, name: 'Updated name' }),
    );
  });

  it('clears verification and sends a new link when the company email changes', async () => {
    companies.lockById.mockResolvedValue({
      ...company,
      email: 'old@example.com',
      verifiedAt: new Date('2026-01-01T00:00:00Z'),
    } as never);

    await service.updateCompanyProfile(actorId, companyId, {
      email: 'new@example.com',
    });

    expect(companies.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', verifiedAt: null }),
    );
    expect(companyVerification.sendAfterEmailChange).toHaveBeenCalledWith(
      companyId,
    );
  });

  it('keeps verification when the email only changes case or is unchanged', async () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    companies.lockById.mockResolvedValue({
      ...company,
      email: 'office@example.com',
      verifiedAt,
    } as never);

    await service.updateCompanyProfile(actorId, companyId, {
      email: 'Office@Example.com',
      name: 'Renamed',
    });

    expect(companies.save).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedAt }),
    );
    expect(companyVerification.sendAfterEmailChange).not.toHaveBeenCalled();
  });

  it('rejects empty company profile updates without opening a transaction', async () => {
    await expect(
      service.updateCompanyProfile(actorId, companyId, {}),
    ).rejects.toThrow('At least one company field is required.');
    expect(execute).not.toHaveBeenCalled();
  });

  describe('invitation onboarding', () => {
    const token = 'A'.repeat(43);
    const pendingInvitation = (overrides: Record<string, unknown> = {}) => ({
      id: 'invitation-1',
      companyId,
      invitedByCompanyUserId: actorMembership.id,
      email: 'new.user@example.com',
      companyRole: ECompanyRole.MEMBER,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      ...overrides,
    });

    describe('previewing an invitation link', () => {
      it('shows a pending invitation with its company, inviter, email and role', async () => {
        reads.findInvitationByTokenHash.mockResolvedValueOnce(
          pendingInvitation(),
        );
        reads.findCompanyName.mockResolvedValueOnce({ ...company });

        const preview = await service.getInvitationByToken(token);

        expect(preview).toEqual({
          status: 'pending',
          companyName: 'Test Company',
          inviterName: 'Ada Admin',
          email: 'new.user@example.com',
          companyRole: ECompanyRole.MEMBER,
          expiresAt: expect.any(Date),
        });
        expect(reads.findMemberName).toHaveBeenCalledWith(actorMembership.id);
        // Looked up by the token's hash, never the token itself.
        expect(reads.findInvitationByTokenHash.mock.calls[0][0]).toHaveLength(
          64,
        );
        expect(reads.findInvitationByTokenHash).not.toHaveBeenCalledWith(token);
      });

      it.each([
        ['accepted', { status: 'accepted' }],
        ['declined', { status: 'declined' }],
        ['revoked', { status: 'revoked', revokedAt: new Date() }],
        ['expired', { status: 'expired' }],
      ])(
        'reports a %s invitation by status only, without its details',
        async (status, overrides) => {
          reads.findInvitationByTokenHash.mockResolvedValueOnce(
            pendingInvitation(overrides),
          );

          await expect(service.getInvitationByToken(token)).resolves.toEqual({
            status,
          });
          expect(reads.findCompanyName).not.toHaveBeenCalled();
        },
      );

      it('records a pending invitation past its expiry as expired', async () => {
        reads.findInvitationByTokenHash.mockResolvedValueOnce(
          pendingInvitation({ expiresAt: new Date(Date.now() - 1) }),
        );

        await expect(service.getInvitationByToken(token)).resolves.toEqual({
          status: 'expired',
        });
        expect(reads.expireInvitation).toHaveBeenCalledWith(
          scopeArg,
          'invitation-1',
        );
      });

      it('rejects an unknown token', async () => {
        reads.findInvitationByTokenHash.mockResolvedValueOnce(null);

        await expect(
          service.getInvitationByToken(token),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('does not offer an invitation from an inactive company', async () => {
        reads.findInvitationByTokenHash.mockResolvedValueOnce(
          pendingInvitation(),
        );
        reads.findCompanyName.mockResolvedValueOnce({
          ...company,
          status: ECompanyStatus.INACTIVE,
        });

        await expect(
          service.getInvitationByToken(token),
        ).rejects.toBeInstanceOf(ConflictException);
      });
    });

    describe("listing the signed-in user's invitations", () => {
      it('lists pending invitations to a verified email, without tokens', async () => {
        reads.listPendingInvitationsForEmail.mockResolvedValueOnce([
          {
            invitation: { ...pendingInvitation(), tokenHash: 'secret-hash' },
            companyName: 'Test Company',
            inviterName: 'Ada Admin',
          },
        ]);

        const result = await service.listMyInvitations(
          'new.user@example.com',
          true,
        );

        expect(result).toEqual([
          {
            id: 'invitation-1',
            companyName: 'Test Company',
            inviterName: 'Ada Admin',
            email: 'new.user@example.com',
            companyRole: ECompanyRole.MEMBER,
            expiresAt: expect.any(Date),
          },
        ]);
        expect(JSON.stringify(result)).not.toContain('secret-hash');
      });

      it('lists nothing for an unverified email', async () => {
        await expect(
          service.listMyInvitations('new.user@example.com', false),
        ).resolves.toEqual([]);
        expect(reads.listPendingInvitationsForEmail).not.toHaveBeenCalled();
      });
    });

    describe('accepting', () => {
      it('records the acceptance in the audit log and tells the inviter after the commit', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());
        members.create.mockImplementationOnce(async (value) => ({
          id: 'new-membership',
          ...value,
        }));

        await service.respondToInvitation(
          'new-user-id',
          'new.user@example.com',
          true,
          token,
          'accept',
        );

        expect(auditLogs.append).toHaveBeenCalledWith(
          expect.objectContaining({
            companyId,
            actorUserId: 'new-user-id',
            actorCompanyUserId: 'new-membership',
            action: 'company.invitation_accepted',
            entityId: 'invitation-1',
            changes: expect.objectContaining({
              companyUserId: 'new-membership',
              companyRole: ECompanyRole.MEMBER,
            }),
          }),
        );
        expect(JSON.stringify(auditLogs.append.mock.calls)).not.toContain(
          token,
        );
        expect(mail.sendCompanyInvitationResponseEmail).toHaveBeenCalledWith(
          'inviter@example.com',
          'Test Company',
          'new.user@example.com',
          ECompanyRole.MEMBER,
          'accepted',
        );
        expect(
          mail.sendCompanyInvitationResponseEmail.mock.invocationCallOrder[0],
        ).toBeGreaterThan(auditLogs.append.mock.invocationCallOrder[0]);
      });

      it('keeps the acceptance when the inviter cannot be notified', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());
        mail.sendCompanyInvitationResponseEmail.mockRejectedValueOnce(
          new Error('SMTP down'),
        );

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).resolves.toEqual({ status: 'accepted', companyId });
      });

      it('rolls back and sends no notice when part of the acceptance fails', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());
        auditLogs.append.mockRejectedValueOnce(new Error('insert failed'));

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).rejects.toThrow('insert failed');
        // Everything ran in the one unit of work, which rejects as a whole.
        expect(execute).toHaveBeenCalledOnce();
        expect(mail.sendCompanyInvitationResponseEmail).not.toHaveBeenCalled();
      });

      it('takes the company and role from the invitation, never the request', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(
          pendingInvitation({ companyRole: ECompanyRole.COMPANY_ADMIN }),
        );

        await service.respondToInvitation(
          'new-user-id',
          'new.user@example.com',
          true,
          token,
          'accept',
        );

        expect(companies.lockById).toHaveBeenCalledWith(scopeArg);
        expect(members.create).toHaveBeenCalledWith(
          expect.objectContaining({
            companyId,
            companyRole: ECompanyRole.COMPANY_ADMIN,
          }),
        );
      });

      it.each([
        ['already accepted', { status: 'accepted' }, 'already been used'],
        ['declined', { status: 'declined' }, 'already been used'],
        ['revoked', { status: 'revoked', revokedAt: new Date() }, 'revoked'],
        ['expired', { status: 'expired' }, 'expired'],
      ])(
        'refuses an invitation that was %s',
        async (_label, overrides, message) => {
          invitations.lockByTokenHash.mockResolvedValueOnce(
            pendingInvitation(overrides),
          );

          await expect(
            service.respondToInvitation(
              'new-user-id',
              'new.user@example.com',
              true,
              token,
              'accept',
            ),
          ).rejects.toThrow(message);
          expect(members.create).not.toHaveBeenCalled();
          expect(members.save).not.toHaveBeenCalled();
          expect(auditLogs.append).not.toHaveBeenCalled();
        },
      );

      it('marks a pending invitation past its expiry as expired and refuses it', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(
          pendingInvitation({ expiresAt: new Date(Date.now() - 1) }),
        );

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).rejects.toThrow('This invitation has expired.');
        expect(invitations.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'expired' }),
        );
        expect(members.create).not.toHaveBeenCalled();
      });

      it('refuses to join a company that is no longer active', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());
        companies.lockById.mockResolvedValueOnce({
          ...company,
          status: ECompanyStatus.INACTIVE,
        });

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).rejects.toThrow('not accepting new members');
        expect(members.create).not.toHaveBeenCalled();
        expect(invitations.save).not.toHaveBeenCalled();
      });

      it('refuses an invitation whose stored role is not a company role', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(
          pendingInvitation({ companyRole: 'Platform Administrator' }),
        );

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).rejects.toThrow('invalid role');
        expect(members.create).not.toHaveBeenCalled();
      });

      it('leaves an existing active member and their role unchanged', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(
          pendingInvitation({ companyRole: ECompanyRole.COMPANY_ADMIN }),
        );
        const existing = {
          id: 'existing-membership',
          companyId,
          userId: 'member-id',
          companyRole: ECompanyRole.MEMBER,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: null,
        };
        members.lockAnyByUser.mockResolvedValueOnce(existing);

        await expect(
          service.respondToInvitation(
            'member-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          ),
        ).rejects.toThrow('already an active member');
        expect(existing.companyRole).toBe(ECompanyRole.MEMBER);
        expect(members.save).not.toHaveBeenCalled();
        expect(members.create).not.toHaveBeenCalled();
        expect(invitations.save).not.toHaveBeenCalled();
      });

      it('lets only one of two concurrent acceptances create a membership', async () => {
        // The invitation's row lock (FOR UPDATE) serializes the two
        // transactions, so the second reads the invitation as the first left
        // it. Model that by running the unit-of-work operations one at a time.
        const runOperation = execute.getMockImplementation()!;
        let previous: Promise<unknown> = Promise.resolve();
        execute.mockImplementation((operation) => {
          const run = previous.then(() => runOperation(operation));
          previous = run.catch(() => undefined);
          return run;
        });
        const row = pendingInvitation();
        invitations.lockByTokenHash.mockResolvedValue(row);
        invitations.save.mockImplementation(async (entity) =>
          Object.assign(row, entity),
        );

        const attempt = () =>
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'accept',
          );
        const [first, second] = await Promise.allSettled([
          attempt(),
          attempt(),
        ]);

        expect([first.status, second.status].sort()).toEqual([
          'fulfilled',
          'rejected',
        ]);
        expect(members.create).toHaveBeenCalledOnce();
      });
    });

    describe('declining', () => {
      it('declines without a membership, records it and tells the inviter', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());

        await expect(
          service.respondToInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            token,
            'decline',
          ),
        ).resolves.toEqual({ status: 'declined' });

        expect(members.create).not.toHaveBeenCalled();
        expect(members.save).not.toHaveBeenCalled();
        expect(invitations.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'declined' }),
        );
        expect(auditLogs.append).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'company.invitation_declined',
            actorUserId: 'new-user-id',
            actorCompanyUserId: null,
          }),
        );
        expect(mail.sendCompanyInvitationResponseEmail).toHaveBeenCalledWith(
          'inviter@example.com',
          'Test Company',
          'new.user@example.com',
          ECompanyRole.MEMBER,
          'declined',
        );
      });

      it('skips the notice when the inviter is no longer an active member', async () => {
        invitations.lockByTokenHash.mockResolvedValueOnce(pendingInvitation());
        users.findActiveMemberPerson.mockResolvedValueOnce(null);

        await service.respondToInvitation(
          'new-user-id',
          'new.user@example.com',
          true,
          token,
          'decline',
        );

        expect(mail.sendCompanyInvitationResponseEmail).not.toHaveBeenCalled();
      });
    });

    describe("answering one of the user's own invitations by ID", () => {
      it('finds the invitation only through the signed-in email address', async () => {
        invitations.lockByIdForEmail.mockResolvedValueOnce(pendingInvitation());

        await expect(
          service.respondToMyInvitation(
            'new-user-id',
            'new.user@example.com',
            true,
            'invitation-1',
            'accept',
          ),
        ).resolves.toEqual({ status: 'accepted', companyId });
        expect(invitations.lockByIdForEmail).toHaveBeenCalledWith(
          'invitation-1',
          'new.user@example.com',
        );
      });

      it("treats another person's invitation ID as not found", async () => {
        invitations.lockByIdForEmail.mockResolvedValueOnce(null);

        await expect(
          service.respondToMyInvitation(
            'other-user-id',
            'other@example.com',
            true,
            'invitation-1',
            'accept',
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(members.create).not.toHaveBeenCalled();
      });

      it('requires a verified email before opening a transaction', async () => {
        await expect(
          service.respondToMyInvitation(
            'new-user-id',
            'new.user@example.com',
            false,
            'invitation-1',
            'accept',
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(execute).not.toHaveBeenCalled();
      });
    });

    describe('resending', () => {
      it('replaces the token, extends the expiry and sends the new link', async () => {
        const old = pendingInvitation({
          status: 'expired',
          tokenHash: 'old-hash',
          expiresAt: new Date(Date.now() - 1000),
        });
        invitations.lockById.mockResolvedValueOnce(old);

        const result = await service.resendInvitation(
          actorId,
          companyId,
          'invitation-1',
        );

        const saved = invitations.save.mock.calls[0][0];
        const sentToken = mail.sendCompanyInvitationEmail.mock.calls[0][3];
        expect(saved.tokenHash).toHaveLength(64);
        expect(saved.tokenHash).not.toBe('old-hash');
        expect(saved.tokenHash).not.toBe(sentToken);
        expect(saved.status).toBe('pending');
        expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
        expect(result.status).toBe('pending');
        expect(auditLogs.append).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'company.invitation_resent' }),
        );
      });

      it.each([
        ['accepted', { status: 'accepted' }],
        ['declined', { status: 'declined' }],
        ['revoked', { status: 'revoked', revokedAt: new Date() }],
      ])(
        'refuses to resend an invitation that was %s',
        async (_label, overrides) => {
          invitations.lockById.mockResolvedValueOnce(
            pendingInvitation(overrides),
          );

          await expect(
            service.resendInvitation(actorId, companyId, 'invitation-1'),
          ).rejects.toBeInstanceOf(ConflictException);
          expect(invitations.save).not.toHaveBeenCalled();
          expect(mail.sendCompanyInvitationEmail).not.toHaveBeenCalled();
        },
      );

      it('refuses when another active invitation exists for the address', async () => {
        invitations.lockById.mockResolvedValueOnce(
          pendingInvitation({ status: 'expired' }),
        );
        invitations.findOtherActivePendingByEmail.mockResolvedValueOnce({
          id: 'newer-invitation',
        });

        await expect(
          service.resendInvitation(actorId, companyId, 'invitation-1'),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(mail.sendCompanyInvitationEmail).not.toHaveBeenCalled();
      });

      it('is limited to Company Administrators of the header company', async () => {
        members.lockActiveByUser.mockResolvedValueOnce({
          ...actorMembership,
          companyRole: ECompanyRole.MEMBER,
        });

        await expect(
          service.resendInvitation(actorId, companyId, 'invitation-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(invitations.lockById).not.toHaveBeenCalled();
      });
    });
  });
});
