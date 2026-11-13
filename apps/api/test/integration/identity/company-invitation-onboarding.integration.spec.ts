import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationStatus,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import { CompanyAuditLog } from '../../../src/modules/identity/entities/company-audit-log.entity';
import { CompanyInvitation } from '../../../src/modules/identity/entities/company-invitation.entity';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { Company } from '../../../src/modules/identity/entities/company.entity';
import { EmailVerificationToken } from '../../../src/modules/identity/entities/email-verification-token.entity';
import { UserSession } from '../../../src/modules/identity/entities/user-session.entity';
import type { AuthenticatedUser } from '../../../src/modules/identity/interface/auth-context.interface';
import { AppUserRepository } from '../../../src/modules/identity/repositories/app-user.repository';
import { AuthTransactionContextFactory } from '../../../src/modules/identity/repositories/auth-transaction-context.factory';
import { CompanyAdminReadRepository } from '../../../src/modules/identity/repositories/company-admin-read.repository';
import { CompanyAdminTransactionContextFactory } from '../../../src/modules/identity/repositories/company-admin-transaction-context.factory';
import { CompanyInvitationRepository } from '../../../src/modules/identity/repositories/company-invitation.repository';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { UserSessionRepository } from '../../../src/modules/identity/repositories/user-session.repository';
import { AuthService } from '../../../src/modules/identity/services/auth/auth.service';
import { PasswordService } from '../../../src/modules/identity/services/auth/password.service';
import { SessionService } from '../../../src/modules/identity/services/auth/session.service';
import { CompanyAdminService } from '../../../src/modules/identity/services/company/company-admin.service';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import type { CompanyVerificationService } from '../../../src/modules/identity/services/company/company-verification.service';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const PASSWORD = 'Integration-Passw0rd!';
const METADATA = { ipAddress: '127.0.0.1', userAgent: 'integration-test' };

/**
 * The invitee's journey through real registration, email verification,
 * sign-in and invitation acceptance against PostgreSQL: a company invitation
 * grants that company's membership, once, and nothing else.
 */
describe('Company invitation onboarding (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let auth: AuthService;
  let invitations: CompanyAdminService;
  let invitationRepository: CompanyInvitationRepository;
  const registeredUserIds = new Set<string>();
  // Tokens the stub mail service would have emailed, by recipient.
  const invitationTokens = new Map<string, string>();
  const verificationTokens = new Map<string, string>();
  const inviterNotices: Array<{ to: string; decision: string }> = [];

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const mail = {
      sendCompanyInvitationEmail: async (
        email: string,
        _company: string,
        _role: string,
        token: string,
      ) => {
        invitationTokens.set(email, token);
      },
      sendVerificationEmail: async (email: string, token: string) => {
        verificationTokens.set(email, token);
      },
      sendCompanyInvitationResponseEmail: async (
        to: string,
        _company: string,
        _invitee: string,
        _role: string,
        decision: string,
      ) => {
        inviterNotices.push({ to, decision });
      },
    } as unknown as MailService;
    auth = new AuthService(
      new TypeOrmUnitOfWork(dataSource, new AuthTransactionContextFactory()),
      {
        get: (key: string) => (key === 'SESSION_TTL_DAYS' ? 7 : undefined),
      } as unknown as ConfigService,
      mail,
      new AppUserRepository(dataSource.getRepository(AppUser)),
      new PasswordService(),
      new SessionService(
        new UserSessionRepository(dataSource.getRepository(UserSession)),
      ),
    );
    invitationRepository = new CompanyInvitationRepository(
      dataSource.getRepository(CompanyInvitation),
    );
    invitations = new CompanyAdminService(
      new CompanyScopeService(
        new CompanyUserRepository(dataSource.getRepository(CompanyUser)),
      ),
      mail,
      new CompanyAdminReadRepository(
        dataSource.getRepository(CompanyUser),
        dataSource.getRepository(Company),
        invitationRepository,
      ),
      new TypeOrmUnitOfWork(
        dataSource,
        new CompanyAdminTransactionContextFactory(),
      ),
      {} as unknown as CompanyVerificationService,
    );
  }, 60_000);

  afterEach(async () => {
    invitationTokens.clear();
    verificationTokens.clear();
    inviterNotices.length = 0;
    // Companies first: that removes their invitations, memberships and audit
    // entries, which the registered users are referenced by.
    await factory.cleanup();
    for (const id of registeredUserIds) {
      await dataSource
        .getRepository(EmailVerificationToken)
        .delete({ userId: id });
      await dataSource.getRepository(AppUser).delete({ id });
    }
    registeredUserIds.clear();
  });

  afterAll(async () => {
    try {
      await factory.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  let sequence = 0;
  function uniqueEmail(label: string): string {
    sequence += 1;
    return `${label}-${Date.now()}-${sequence}@integration.contractflow.test`;
  }

  /** Registers, verifies and signs in, returning the session's user. */
  async function registerVerifyAndSignIn(
    email: string,
  ): Promise<AuthenticatedUser> {
    await auth.register({
      email,
      password: PASSWORD,
      firstName: 'Invited',
      middleName: '',
      lastName: 'Person',
      phoneNumber: '',
      timezone: 'UTC',
    });
    const user = await dataSource
      .getRepository(AppUser)
      .findOneByOrFail({ email });
    registeredUserIds.add(user.id);

    // Signing in is refused until the email is verified.
    await expect(
      auth.login({ email, password: PASSWORD }, METADATA),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await auth.verifyEmail(verificationTokens.get(email)!);
    const { sessionToken } = await auth.login(
      { email, password: PASSWORD },
      METADATA,
    );
    const session = await auth.authenticate(sessionToken);
    return session.user;
  }

  async function inviteFromNewCompany(
    email: string,
    companyRole = ECompanyRole.MEMBER,
  ) {
    const { company, actor } = await factory.createRoleAssignmentFixture();
    const invitation = await invitations.inviteMember(
      actor.userId,
      company.id,
      {
        email,
        companyRole,
      },
    );
    return { company, actor, invitation, token: invitationTokens.get(email)! };
  }

  async function membershipsOf(userId: string): Promise<CompanyUser[]> {
    return dataSource.getRepository(CompanyUser).findBy({ userId });
  }

  it('takes a new person from invitation to registration, verification and membership', async () => {
    const email = uniqueEmail('new-invitee');
    const { company, actor, invitation, token } =
      await inviteFromNewCompany(email);

    // The link shows who invited them, before they have an account.
    await expect(
      invitations.getInvitationByToken(token),
    ).resolves.toMatchObject({
      status: EInvitationStatus.PENDING,
      companyName: company.name,
      inviterName: expect.stringContaining('Integration'),
      email,
      companyRole: ECompanyRole.MEMBER,
    });

    const user = await registerVerifyAndSignIn(email);
    // Registering created the account only: no company and no membership.
    expect(await membershipsOf(user.id)).toHaveLength(0);
    expect(
      await invitationRepository.countPendingForEmailUnscoped(
        email,
        new Date(),
      ),
    ).toBe(1);

    // After signing in, the invitation is found by the verified email alone.
    const mine = await invitations.listMyInvitations(
      user.email,
      Boolean(user.emailVerifiedAt),
    );
    expect(mine).toEqual([
      expect.objectContaining({ id: invitation.id, companyName: company.name }),
    ]);

    await expect(
      invitations.respondToMyInvitation(
        user.id,
        user.email,
        true,
        invitation.id,
        'accept',
      ),
    ).resolves.toEqual({
      status: EInvitationStatus.ACCEPTED,
      companyId: company.id,
    });

    const memberships = await membershipsOf(user.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      companyId: company.id,
      companyRole: ECompanyRole.MEMBER,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
    });
    expect(
      await dataSource
        .getRepository(CompanyInvitation)
        .findOneByOrFail({ id: invitation.id }),
    ).toMatchObject({
      status: EInvitationStatus.ACCEPTED,
      acceptedAt: expect.any(Date),
    });
    // No contract access comes with company membership.
    expect(
      await dataSource
        .getRepository(ContractRoleAssignment)
        .countBy({ companyUserId: memberships[0].id }),
    ).toBe(0);
    // The acceptance is in the company's audit trail, without the token.
    const audit = await dataSource.getRepository(CompanyAuditLog).findBy({
      companyId: company.id,
      action: 'company.invitation_accepted',
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: user.id,
      actorCompanyUserId: memberships[0].id,
      entityId: invitation.id,
    });
    expect(JSON.stringify(audit)).not.toContain(token);
    expect(inviterNotices).toEqual([
      { to: expect.stringContaining('@'), decision: 'accepted' },
    ]);
    expect(actor.userId).not.toBe(user.id);

    // Answering again changes nothing.
    await expect(
      invitations.respondToInvitation(
        user.id,
        user.email,
        true,
        token,
        'accept',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await membershipsOf(user.id)).toHaveLength(1);
    expect(await invitations.listMyInvitations(user.email, true)).toHaveLength(
      0,
    );
  });

  it('lets an existing account accept from the link, but not a different account', async () => {
    const email = uniqueEmail('existing-invitee');
    const user = await registerVerifyAndSignIn(email);
    const someoneElse = await registerVerifyAndSignIn(uniqueEmail('other'));
    const { company, token } = await inviteFromNewCompany(
      email,
      ECompanyRole.COMPANY_ADMIN,
    );

    await expect(
      invitations.respondToInvitation(
        someoneElse.id,
        someoneElse.email,
        true,
        token,
        'accept',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await membershipsOf(someoneElse.id)).toHaveLength(0);

    await expect(
      invitations.respondToInvitation(
        user.id,
        user.email,
        true,
        token,
        'accept',
      ),
    ).resolves.toEqual({
      status: EInvitationStatus.ACCEPTED,
      companyId: company.id,
    });
    expect(await membershipsOf(user.id)).toEqual([
      expect.objectContaining({
        companyId: company.id,
        companyRole: ECompanyRole.COMPANY_ADMIN,
      }),
    ]);
  });

  it('refuses revoked and expired invitations', async () => {
    const revokedEmail = uniqueEmail('revoked');
    const revokedUser = await registerVerifyAndSignIn(revokedEmail);
    const revoked = await inviteFromNewCompany(revokedEmail);
    await invitations.revokeInvitation(
      revoked.actor.userId,
      revoked.company.id,
      revoked.invitation.id,
    );

    await expect(
      invitations.respondToInvitation(
        revokedUser.id,
        revokedEmail,
        true,
        revoked.token,
        'accept',
      ),
    ).rejects.toThrow('revoked');
    await expect(
      invitations.getInvitationByToken(revoked.token),
    ).resolves.toEqual({ status: EInvitationStatus.REVOKED });

    const expiredEmail = uniqueEmail('expired');
    const expiredUser = await registerVerifyAndSignIn(expiredEmail);
    const expired = await inviteFromNewCompany(expiredEmail);
    await dataSource
      .getRepository(CompanyInvitation)
      .update(
        { id: expired.invitation.id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

    await expect(
      invitations.respondToInvitation(
        expiredUser.id,
        expiredEmail,
        true,
        expired.token,
        'accept',
      ),
    ).rejects.toThrow('expired');
    expect(
      await dataSource
        .getRepository(CompanyInvitation)
        .findOneByOrFail({ id: expired.invitation.id }),
    ).toMatchObject({ status: EInvitationStatus.EXPIRED });
    expect(await membershipsOf(revokedUser.id)).toHaveLength(0);
    expect(await membershipsOf(expiredUser.id)).toHaveLength(0);
  });

  it('creates one membership when the same invitation is accepted twice at once', async () => {
    const email = uniqueEmail('concurrent');
    const user = await registerVerifyAndSignIn(email);
    const { company, token } = await inviteFromNewCompany(email);

    const results = await Promise.allSettled([
      invitations.respondToInvitation(user.id, email, true, token, 'accept'),
      invitations.respondToInvitation(user.id, email, true, token, 'accept'),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      await dataSource
        .getRepository(CompanyUser)
        .countBy({ companyId: company.id, userId: user.id }),
    ).toBe(1);
  });

  it('records a decline without a membership and tells the inviter', async () => {
    const email = uniqueEmail('decliner');
    const user = await registerVerifyAndSignIn(email);
    const { company, invitation } = await inviteFromNewCompany(email);

    await expect(
      invitations.respondToMyInvitation(
        user.id,
        email,
        true,
        invitation.id,
        'decline',
      ),
    ).resolves.toEqual({ status: EInvitationStatus.DECLINED });

    expect(await membershipsOf(user.id)).toHaveLength(0);
    expect(
      await dataSource.getRepository(CompanyAuditLog).countBy({
        companyId: company.id,
        action: 'company.invitation_declined',
        actorUserId: user.id,
      }),
    ).toBe(1);
    expect(inviterNotices).toEqual([
      { to: expect.stringContaining('@'), decision: 'declined' },
    ]);
  });

  it('replaces the link when an invitation is sent again', async () => {
    const email = uniqueEmail('resent');
    const user = await registerVerifyAndSignIn(email);
    const {
      company,
      actor,
      invitation,
      token: firstToken,
    } = await inviteFromNewCompany(email);

    await invitations.resendInvitation(actor.userId, company.id, invitation.id);
    const secondToken = invitationTokens.get(email)!;
    expect(secondToken).not.toBe(firstToken);

    await expect(
      invitations.respondToInvitation(
        user.id,
        email,
        true,
        firstToken,
        'accept',
      ),
    ).rejects.toThrow('not found');
    await expect(
      invitations.respondToInvitation(
        user.id,
        email,
        true,
        secondToken,
        'accept',
      ),
    ).resolves.toMatchObject({ status: EInvitationStatus.ACCEPTED });
  });
});
