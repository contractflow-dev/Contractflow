import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
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
const company = { id: companyId, name: 'Test Company' };
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
            companyRole: ECompanyRole.FINANCE_OFFICER,
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
    };
    mail = { sendCompanyInvitationEmail: vi.fn() };
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
    };
    invitations = {
      findActivePendingByEmail: vi.fn().mockResolvedValue(null),
      expirePendingByEmail: vi.fn(),
      lockById: vi.fn(),
      lockByTokenHash: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (entity) => ({
        id: 'invitation-1',
        createdAt: new Date(),
        ...entity,
      })),
      save: vi.fn(async (entity) => entity),
      revokePending: vi.fn().mockResolvedValue(true),
    };
    const context = {
      companies,
      members,
      users,
      invitations,
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
    reads.findActiveRole.mockResolvedValueOnce(
      ECompanyRole.CLIENT_PROJECT_MANAGER,
    );

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
        companyRole: ECompanyRole.FINANCE_OFFICER,
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
      companyRole: ECompanyRole.FINANCE_OFFICER,
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
        companyRole: EInvitationRole.FINANCE_OFFICER,
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
        companyRole: EInvitationRole.FINANCE_OFFICER,
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
      companyRole: EInvitationRole.FINANCE_OFFICER,
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
    ).resolves.toEqual({ status: 'accepted' });

    expect(execute).toHaveBeenCalledOnce();
    expect(members.lockAnyByUser).toHaveBeenCalledWith(scopeArg, 'new-user-id');
    expect(members.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        userId: 'new-user-id',
        companyRole: ECompanyRole.FINANCE_OFFICER,
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

  it('rejects invitation acceptance from a different account email', async () => {
    invitations.lockByTokenHash.mockResolvedValueOnce({
      id: 'invitation-1',
      companyId,
      email: 'intended@example.com',
      companyRole: EInvitationRole.FINANCE_OFFICER,
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
});
