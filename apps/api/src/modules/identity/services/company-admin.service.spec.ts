import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyInvitation } from '../entities/company-invitation.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyInvitationRepository } from '../repositories/company-invitation.repository';
import { CompanyScopeService } from './company-scope.service';
import { CompanyAdminService } from './company-admin.service';
import { MailService } from '../../mail/mail.service';

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

describe('CompanyAdminService', () => {
  let service: CompanyAdminService;
  let scope: { forUser: ReturnType<typeof vi.fn> };
  let companyUsers: Record<string, ReturnType<typeof vi.fn>>;
  let invitations: Record<string, ReturnType<typeof vi.fn>>;
  let mail: Record<string, ReturnType<typeof vi.fn>>;
  let companyRepository: Record<string, ReturnType<typeof vi.fn>>;
  let managerMembers: Record<string, ReturnType<typeof vi.fn>>;
  let userRepository: Record<string, ReturnType<typeof vi.fn>>;
  let managerInvitations: Record<string, ReturnType<typeof vi.fn>>;
  let inviteQuery: Record<string, ReturnType<typeof vi.fn>>;
  let transaction: ReturnType<typeof vi.fn>;
  let memberQuery: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    scope = {
      forUser: vi.fn().mockResolvedValue({ companyId }),
    };
    companyUsers = {
      findOne: vi.fn().mockResolvedValue(actorMembership),
      createQueryBuilder: vi.fn(),
    };
    memberQuery = {
      innerJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi.fn().mockResolvedValue([
        [
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
        1,
      ]),
    };
    for (const method of [
      'innerJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'skip',
      'take',
    ]) {
      memberQuery[method].mockReturnValue(memberQuery);
    }
    companyUsers.createQueryBuilder.mockReturnValue(memberQuery);
    invitations = {
      findPage: vi.fn(),
    };
    mail = {
      sendCompanyInvitationEmail: vi.fn(),
    };
    companyRepository = {
      findOne: vi.fn().mockResolvedValue(company),
      save: vi.fn(async (value) => value),
    };
    managerMembers = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(actorMembership)
        .mockResolvedValueOnce(null),
      count: vi.fn().mockResolvedValue(1),
      save: vi.fn(),
      create: vi.fn((value) => value),
    };
    userRepository = {
      findOneBy: vi.fn().mockResolvedValue({
        firstName: 'New',
        lastName: 'Admin',
        email: 'new@example.com',
      }),
      findOne: vi.fn().mockResolvedValue(null),
    };
    inviteQuery = {
      addSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      setLock: vi.fn(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    inviteQuery.addSelect.mockReturnValue(inviteQuery);
    inviteQuery.where.mockReturnValue(inviteQuery);
    inviteQuery.andWhere.mockReturnValue(inviteQuery);
    inviteQuery.setLock.mockReturnValue(inviteQuery);
    managerInvitations = {
      createQueryBuilder: vi.fn().mockReturnValue(inviteQuery),
      update: vi.fn(),
      create: vi.fn((value) => value),
      save: vi.fn(async (entity) => ({
        id: 'invitation-1',
        createdAt: new Date(),
        ...entity,
      })),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Company) return companyRepository;
        if (entity === AppUser) return userRepository;
        if (entity === CompanyInvitation) return managerInvitations;
        return managerMembers;
      },
    };
    transaction = vi.fn(
      async <T>(callback: (manager: EntityManager) => Promise<T>) =>
        callback(manager as unknown as EntityManager),
    );
    service = new CompanyAdminService(
      { transaction } as unknown as DataSource,
      scope as unknown as CompanyScopeService,
      invitations as unknown as CompanyInvitationRepository,
      mail as unknown as MailService,
      companyUsers as unknown as Repository<CompanyUser>,
    );
  });

  it('lists safe member fields only within the authorized company', async () => {
    const result = await service.listMembers(actorId, companyId, {
      search: 'ari',
      page: 1,
      limit: 20,
    });

    expect(scope.forUser).toHaveBeenCalledWith(actorId, companyId);
    expect(memberQuery.where).toHaveBeenCalledWith(
      'membership.companyId = :companyId',
      { companyId },
    );
    expect(memberQuery.andWhere).toHaveBeenCalledWith(
      '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
      { search: '%ari%' },
    );
    expect(result).toMatchObject({
      total: 1,
      items: [{ id: 'membership-1', email: 'ari@example.com' }],
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.items[0]).not.toHaveProperty('isPlatformAdmin');
  });

  it('denies an ordinary company member before querying member records', async () => {
    companyUsers.findOne.mockResolvedValueOnce({
      ...actorMembership,
      companyRole: ECompanyRole.CLIENT_PROJECT_MANAGER,
    });

    await expect(
      service.listMembers(actorId, companyId, { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(companyUsers.createQueryBuilder).not.toHaveBeenCalled();
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
    expect(companyUsers.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('prevents a sole Company Admin from demoting their membership', async () => {
    managerMembers.findOne
      .mockReset()
      .mockResolvedValueOnce(actorMembership)
      .mockResolvedValueOnce({
        ...actorMembership,
        user: {
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
        },
      });

    await expect(
      service.updateMemberRole(actorId, companyId, actorMembership.id, {
        companyRole: ECompanyRole.FINANCE_OFFICER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(managerMembers.count).toHaveBeenCalledWith({
      where: {
        companyId,
        companyRole: ECompanyRole.COMPANY_ADMIN,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: expect.anything(),
      },
    });
    expect(managerMembers.save).not.toHaveBeenCalled();
  });

  it('prevents removal of the last active Company Administrator', async () => {
    managerMembers.findOne
      .mockReset()
      .mockResolvedValueOnce(actorMembership)
      .mockResolvedValueOnce(actorMembership);

    await expect(
      service.removeMember(actorId, companyId, actorMembership.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(managerMembers.save).not.toHaveBeenCalled();
  });

  it('allows an administrator to appoint a replacement administrator first', async () => {
    const replacement = {
      ...actorMembership,
      id: 'replacement-membership',
      userId: 'replacement-user',
      companyRole: ECompanyRole.FINANCE_OFFICER,
      user: { firstName: 'New', lastName: 'Admin', email: 'new@example.com' },
    };
    managerMembers.findOne
      .mockReset()
      .mockResolvedValueOnce(actorMembership)
      .mockResolvedValueOnce(replacement);
    managerMembers.count.mockResolvedValue(2);
    managerMembers.save.mockImplementation(async (entity) => entity);

    const result = await service.updateMemberRole(
      actorId,
      companyId,
      replacement.id,
      { companyRole: ECompanyRole.COMPANY_ADMIN },
    );

    expect(result.companyRole).toBe(ECompanyRole.COMPANY_ADMIN);
    expect(managerMembers.save).toHaveBeenCalledWith(
      expect.objectContaining({ companyRole: ECompanyRole.COMPANY_ADMIN }),
    );
  });

  it('constrains member mutation lookups to the route company', async () => {
    managerMembers.findOne
      .mockReset()
      .mockResolvedValueOnce(actorMembership)
      .mockResolvedValueOnce(null);

    await expect(
      service.removeMember(
        actorId,
        companyId,
        'membership-from-another-company',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(managerMembers.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'membership-from-another-company',
          companyId,
        }),
      }),
    );
    expect(managerMembers.save).not.toHaveBeenCalled();
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

    expect(managerInvitations.save).toHaveBeenCalledOnce();
    const invitation = managerInvitations.save.mock.calls[0][0];
    const sentToken = mail.sendCompanyInvitationEmail.mock.calls[0][3];
    expect(invitation.tokenHash).toHaveLength(64);
    expect(invitation.tokenHash).not.toBe(sentToken);
    expect(invitation).not.toHaveProperty('token', sentToken);
    expect(invitation.firstName).toBeNull();
    expect(invitation.lastName).toBeNull();
    expect(managerInvitations.save.mock.invocationCallOrder[0]).toBeLessThan(
      mail.sendCompanyInvitationEmail.mock.invocationCallOrder[0],
    );
  });

  it('rejects duplicate active invitations before attempting delivery', async () => {
    inviteQuery.getOne.mockResolvedValueOnce({ id: 'existing-invite' });

    await expect(
      service.inviteMember(actorId, companyId, {
        email: 'new.user@example.com',
        companyRole: EInvitationRole.FINANCE_OFFICER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(managerInvitations.save).not.toHaveBeenCalled();
    expect(mail.sendCompanyInvitationEmail).not.toHaveBeenCalled();
  });

  it('accepts a verified invitation and creates the matching company membership atomically', async () => {
    const invitation = {
      id: 'invitation-1',
      companyId,
      email: 'new.user@example.com',
      companyRole: EInvitationRole.FINANCE_OFFICER,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    };
    inviteQuery.getOne.mockResolvedValueOnce(invitation);
    managerMembers.findOne.mockReset().mockResolvedValueOnce(null);
    managerMembers.save.mockResolvedValue({});
    managerInvitations.save.mockImplementation(async (entity) => entity);

    await expect(
      service.respondToInvitation(
        'new-user-id',
        'new.user@example.com',
        true,
        'A'.repeat(43),
        'accept',
      ),
    ).resolves.toEqual({ status: 'accepted' });

    expect(managerMembers.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        userId: 'new-user-id',
        companyRole: ECompanyRole.FINANCE_OFFICER,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: null,
      }),
    );
    expect(managerInvitations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        acceptedAt: expect.any(Date),
      }),
    );
  });

  it('rejects invitation acceptance from a different account email', async () => {
    inviteQuery.getOne.mockResolvedValueOnce({
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
    expect(managerMembers.save).not.toHaveBeenCalled();
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
    expect(transaction).not.toHaveBeenCalled();
  });

  it('updates only the selected company profile inside an authorized transaction', async () => {
    const response = await service.updateCompanyProfile(actorId, companyId, {
      name: 'Updated name',
    });

    expect(response.name).toBe('Updated name');
    expect(companyRepository.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: companyId } }),
    );
    expect(companyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: companyId,
        name: 'Updated name',
      }),
    );
  });

  it('rejects empty company profile updates without opening a transaction', async () => {
    await expect(
      service.updateCompanyProfile(actorId, companyId, {}),
    ).rejects.toThrow('At least one company field is required.');
    expect(transaction).not.toHaveBeenCalled();
  });
});
