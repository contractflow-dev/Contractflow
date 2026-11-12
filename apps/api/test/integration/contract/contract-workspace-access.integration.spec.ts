import { type INestApplication, ValidationPipe } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ECompanyRole,
  type ContractWorkspaceAccessResponse,
  EContractorContractRole,
  type ContractRole,
} from '@contractflow/contracts-schema';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { CompanyContextGuard } from '../../../src/common/guards/company-context.guard';
import { ContractContextGuard } from '../../../src/common/guards/contract-context.guard';
import { SessionAuthGuard } from '../../../src/common/guards/session-auth.guard';
import { ContractWorkspaceController } from '../../../src/modules/contract/controllers/contract-workspace.controller';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import {
  ContractRoleAssignmentTransactionContextFactory,
  TypeOrmContractRoleAssignmentContext,
} from '../../../src/modules/contract/repositories/contract-role-assignment-transaction-context.factory';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ContractRoleAssignmentService } from '../../../src/modules/contract/services/contract-role-assignment.service';
import { ContractWorkspaceAccessService } from '../../../src/modules/contract/services/contract-workspace-access.service';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import { UserSession } from '../../../src/modules/identity/entities/user-session.entity';
import {
  APP_USER_REPOSITORY,
  AUTH_UNIT_OF_WORK,
} from '../../../src/modules/identity/interface/auth-persistence.interface';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { UserSessionRepository } from '../../../src/modules/identity/repositories/user-session.repository';
import { AuthService } from '../../../src/modules/identity/services/auth/auth.service';
import { PasswordService } from '../../../src/modules/identity/services/auth/password.service';
import { SessionService } from '../../../src/modules/identity/services/auth/session.service';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Workspace access over real HTTP (session guard, company and contract
 * context guards, ContractAccessService, PostgreSQL), and workspace team
 * management through the real role-assignment service and unit of work.
 */
describe('Contract workspace access (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let sessions: SessionService;
  let roles: ContractRoleAssignmentService;
  let cookieName: string;

  let companyA: Company;
  let companyB: Company;
  let companyO: Company;
  let contract: Contract;
  let partyA: ContractParty;
  let partyB: ContractParty;
  let projectLead: CompanyUser; // A: Contractor Project Lead
  let hseAdmin: CompanyUser; // A: HSE Officer, Workspace Admin
  let financeMember: CompanyUser; // A: Finance Officer
  let adminA: CompanyUser; // A: Company Administrator, no contract role
  let plainA: CompanyUser; // A: member, no contract role
  let hseB: CompanyUser; // B: HSE Manager on the same contract
  let adminO: CompanyUser; // unrelated company

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    sessions = new SessionService(
      new UserSessionRepository(dataSource.getRepository(UserSession)),
    );
    const persistence = new TypeOrmContractRoleAssignmentContext(
      dataSource.manager,
    );
    const access = new ContractAccessService(
      new CompanyUserRepository(dataSource.getRepository(CompanyUser)),
      new ContractPartyRepository(dataSource.getRepository(ContractParty)),
      new ContractRoleAssignmentRepository(
        dataSource.getRepository(ContractRoleAssignment),
      ),
      new ContractRepository(dataSource.getRepository(Contract)),
      new ContractWorkspaceRepository(
        dataSource.getRepository(ContractWorkspaceEntity),
        dataSource.getRepository(ContractParty),
      ),
    );
    roles = new ContractRoleAssignmentService(
      persistence,
      new TypeOrmUnitOfWork(
        dataSource,
        new ContractRoleAssignmentTransactionContextFactory(),
      ),
      {
        sendContractRoleInvitationEmail: async () => undefined,
      } as unknown as MailService,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractWorkspaceController],
      providers: [
        {
          provide: ContractWorkspaceAccessService,
          useValue: new ContractWorkspaceAccessService(access, persistence),
        },
        {
          provide: CompanyScopeService,
          useValue: new CompanyScopeService(
            new CompanyUserRepository(dataSource.getRepository(CompanyUser)),
          ),
        },
        CompanyContextGuard,
        ContractContextGuard,
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        AuthService,
        { provide: SessionService, useValue: sessions },
        { provide: AUTH_UNIT_OF_WORK, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: MailService, useValue: {} },
        { provide: APP_USER_REPOSITORY, useValue: {} },
        { provide: PasswordService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    cookieName = moduleRef.get(AuthService).sessionCookieName();
  }, 60_000);

  beforeEach(async () => {
    const lifecycle = await factory.createLifecycleFixture();
    companyA = lifecycle.company;
    contract = lifecycle.contract;
    partyA = lifecycle.party;
    projectLead = lifecycle.actor; // Contractor Project Lead on project
    await factory.createAdditionalWorkspace(contract, projectLead, 'hse');
    await factory.createAdditionalWorkspace(contract, projectLead, 'finance');

    hseAdmin = await factory.createAdditionalMember(companyA);
    await grant(partyA, hseAdmin, EContractorContractRole.HSE_OFFICER, true);
    financeMember = await factory.createAdditionalMember(companyA);
    await grant(partyA, financeMember, EContractorContractRole.FINANCE_OFFICER);
    adminA = await factory.createAdditionalMember(
      companyA,
      ECompanyRole.COMPANY_ADMIN,
    );
    plainA = await factory.createAdditionalMember(companyA);

    ({ company: companyB } = await factory.createCompanyMember());
    partyB = await factory.createAdditionalParty(contract, companyB);
    hseB = await factory.createAdditionalMember(companyB);
    await grant(partyB, hseB, EContractorContractRole.HSE_MANAGER, true);

    ({ company: companyO, member: adminO } =
      await factory.createCompanyMember());
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function grant(
    party: ContractParty,
    member: CompanyUser,
    role: ContractRole,
    isWorkspaceAdmin = false,
  ): Promise<ContractRoleAssignment> {
    const repository = dataSource.getRepository(ContractRoleAssignment);
    return repository.save(
      repository.create({
        contractPartyId: party.id,
        companyUserId: member.id,
        companyId: member.companyId,
        role,
        isWorkspaceAdmin,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
  }

  async function signIn(member: CompanyUser): Promise<string> {
    const user = await dataSource
      .getRepository(AppUser)
      .findOneByOrFail({ id: member.userId });
    const { sessionToken } = await sessions.createSession(
      user,
      { ipAddress: null, userAgent: 'integration' },
      1,
    );
    return `${cookieName}=${sessionToken}`;
  }

  function get(
    path: string,
    cookie: string | null,
    companyId: string,
    contractId: string,
    query: Record<string, string> = {},
  ) {
    const call = request(app.getHttpServer())
      .get(`/api/contract/${path}`)
      .query(query)
      .set('X-Company-Id', companyId)
      .set('X-Contract-Id', contractId);
    if (cookie) call.set('Cookie', cookie);
    return call;
  }
  const accessOf = async (member: CompanyUser, companyId = member.companyId) =>
    (
      await get(
        'workspace-access',
        await signIn(member),
        companyId,
        contract.id,
      ).expect(200)
    ).body as ContractWorkspaceAccessResponse;
  const byWorkspace = (body: ContractWorkspaceAccessResponse) =>
    Object.fromEntries(
      body.workspaces.map((entry) => [entry.workspace, entry]),
    );

  describe('GET /contract/workspace-access', () => {
    it('lists every enabled workspace with only the caller’s own roles', async () => {
      const body = await accessOf(projectLead);
      expect(body.workspaces.map(({ workspace }) => workspace)).toEqual([
        'project',
        'hse',
        'finance',
      ]);
      expect(byWorkspace(body)).toEqual({
        project: {
          workspace: 'project',
          hasAccess: true,
          roles: [EContractorContractRole.CONTRACTOR_PROJECT_LEAD],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
        hse: {
          workspace: 'hse',
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
        finance: {
          workspace: 'finance',
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
      });
    });

    it('marks a Workspace Admin as able to manage that workspace’s team only', async () => {
      const access = byWorkspace(await accessOf(hseAdmin));
      expect(access.hse).toMatchObject({
        hasAccess: true,
        isWorkspaceAdmin: true,
        canManageTeam: true,
      });
      expect(access.project).toMatchObject({
        hasAccess: false,
        canManageTeam: false,
      });
      expect(access.finance).toMatchObject({
        hasAccess: false,
        canManageTeam: false,
      });
    });

    it('gives a Company Administrator without a contract role no workspace', async () => {
      const access = await accessOf(adminA);
      expect(
        access.workspaces.every(
          (entry) => !entry.hasAccess && !entry.canManageTeam,
        ),
      ).toBe(true);
    });

    it('lets a Company Administrator with a role manage that workspace’s team', async () => {
      await grant(partyA, adminA, EContractorContractRole.FINANCE_DIRECTOR);
      const access = byWorkspace(await accessOf(adminA));
      expect(access.finance).toMatchObject({
        hasAccess: true,
        isWorkspaceAdmin: false,
        canManageTeam: true,
      });
      expect(access.project.hasAccess).toBe(false);
    });

    it('hides the contract (404) from a member without assignments', async () => {
      await get(
        'workspace-access',
        await signIn(plainA),
        companyA.id,
        contract.id,
      ).expect(404);
    });

    it('answers a Company Administrator without a role (oversight) with no access anywhere', async () => {
      const access = await accessOf(adminA);
      expect(access.workspaces).toHaveLength(3);
      expect(
        access.workspaces.every(
          (entry) =>
            !entry.hasAccess &&
            !entry.canManageTeam &&
            !entry.isWorkspaceAdmin &&
            entry.roles.length === 0,
        ),
      ).toBe(true);
    });

    it('lists only the workspaces enabled on the contract', async () => {
      const other = await factory.createAdditionalContract(companyA);
      const otherParty = await factory.createAdditionalParty(other, companyA);
      await factory.createAdditionalWorkspace(other, projectLead, 'project');
      await grant(
        otherParty,
        projectLead,
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );
      const response = await get(
        'workspace-access',
        await signIn(projectLead),
        companyA.id,
        other.id,
      ).expect(200);
      expect(
        (response.body as ContractWorkspaceAccessResponse).workspaces.map(
          (entry) => entry.workspace,
        ),
      ).toEqual(['project']);
    });

    it('drops a revoked role at once', async () => {
      await dataSource
        .getRepository(ContractRoleAssignment)
        .update(
          { companyUserId: financeMember.id },
          { revokedAt: new Date(), revokedById: financeMember.id },
        );
      // Their only role is gone, and with it their view of the contract.
      await get(
        'workspace-access',
        await signIn(financeMember),
        companyA.id,
        contract.id,
      ).expect(404);
    });

    it('shows the other party only its own roles on the shared contract', async () => {
      const access = byWorkspace(await accessOf(hseB));
      expect(access.hse).toMatchObject({
        hasAccess: true,
        roles: [EContractorContractRole.HSE_MANAGER],
        canManageTeam: true,
      });
      expect(access.project.hasAccess).toBe(false);
      expect(access.finance.hasAccess).toBe(false);
    });

    it('scopes a person in two companies to the company in the header', async () => {
      const inB = await dataSource.getRepository(CompanyUser).save(
        dataSource.getRepository(CompanyUser).create({
          companyId: companyB.id,
          userId: projectLead.userId,
          companyRole: ECompanyRole.MEMBER,
          jobTitle: 'Integration test member',
          status: projectLead.status,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      await grant(partyB, inB, EContractorContractRole.FINANCE_OFFICER);
      const cookie = await signIn(projectLead);
      const asA = byWorkspace(
        (
          await get(
            'workspace-access',
            cookie,
            companyA.id,
            contract.id,
          ).expect(200)
        ).body,
      );
      const asB = byWorkspace(
        (
          await get(
            'workspace-access',
            cookie,
            companyB.id,
            contract.id,
          ).expect(200)
        ).body,
      );

      expect(asA.project.hasAccess).toBe(true);
      expect(asA.finance.hasAccess).toBe(false);
      expect(asB.project.hasAccess).toBe(false);
      expect(asB.finance).toMatchObject({
        hasAccess: true,
        roles: [EContractorContractRole.FINANCE_OFFICER],
      });
    });

    it('refuses the wrong company, an unrelated company, and archived or unknown contracts', async () => {
      await get(
        'workspace-access',
        await signIn(projectLead),
        companyB.id,
        contract.id,
      ).expect(403);
      await get(
        'workspace-access',
        await signIn(adminO),
        companyO.id,
        contract.id,
      ).expect(404);
      await get(
        'workspace-access',
        await signIn(projectLead),
        companyA.id,
        '01AAAAAAAAAAAAAAAAAAAAAAAA',
      ).expect(404);
      await dataSource
        .getRepository(Contract)
        .update({ id: contract.id }, { deletedAt: new Date() });
      await get(
        'workspace-access',
        await signIn(projectLead),
        companyA.id,
        contract.id,
      ).expect(404);
    });

    it('returns only the workspace fields, nothing about other people', async () => {
      const response = await get(
        'workspace-access',
        await signIn(hseAdmin),
        companyA.id,
        contract.id,
      ).expect(200);
      for (const entry of (response.body as ContractWorkspaceAccessResponse)
        .workspaces) {
        expect(Object.keys(entry).sort()).toEqual([
          'canManageTeam',
          'hasAccess',
          'isWorkspaceAdmin',
          'roles',
          'workspace',
        ]);
      }
      const raw = JSON.stringify(response.body);
      for (const hidden of [
        projectLead.id,
        financeMember.id,
        hseB.id,
        hseAdmin.userId,
        '@integration.contractflow.test',
      ]) {
        expect(raw).not.toContain(hidden);
      }
    });
  });

  describe('GET /contract/workspaces/:workspace', () => {
    it('opens each workspace to its own role holders', async () => {
      for (const [member, workspace] of [
        [projectLead, 'project'],
        [hseAdmin, 'hse'],
        [financeMember, 'finance'],
      ] as const) {
        const response = await get(
          `workspaces/${workspace}`,
          await signIn(member),
          companyA.id,
          contract.id,
        ).expect(200);
        expect(response.body).toMatchObject({ workspace, hasAccess: true });
      }
    });

    it('never lets one workspace open another', async () => {
      const cookie = await signIn(projectLead);
      await get('workspaces/hse', cookie, companyA.id, contract.id).expect(403);
      await get('workspaces/finance', cookie, companyA.id, contract.id).expect(
        403,
      );
    });

    it('refuses Company Administrators (403) and hides the contract from members without a role (404)', async () => {
      for (const [member, status] of [
        [adminA, 403],
        [plainA, 404],
      ] as const) {
        const cookie = await signIn(member);
        for (const workspace of ['project', 'hse', 'finance']) {
          await get(
            `workspaces/${workspace}`,
            cookie,
            companyA.id,
            contract.id,
          ).expect(status);
        }
      }
    });

    it('refuses a revoked role and a member who has left', async () => {
      const cookie = await signIn(financeMember);
      await get('workspaces/finance', cookie, companyA.id, contract.id).expect(
        200,
      );
      await dataSource
        .getRepository(ContractRoleAssignment)
        .update({ companyUserId: financeMember.id }, { revokedAt: new Date() });
      await get('workspaces/finance', cookie, companyA.id, contract.id).expect(
        404,
      );

      const hseCookie = await signIn(hseAdmin);
      await dataSource
        .getRepository(CompanyUser)
        .update({ id: hseAdmin.id }, { leftAt: new Date() });
      await get('workspaces/hse', hseCookie, companyA.id, contract.id).expect(
        403,
      );
    });

    it('decides by the header company’s own roles, never the other party’s', async () => {
      // B's HSE Manager opens HSE as B, but can't borrow A's project role.
      await get(
        'workspaces/hse',
        await signIn(hseB),
        companyB.id,
        contract.id,
      ).expect(200);
      await get(
        'workspaces/project',
        await signIn(hseB),
        companyB.id,
        contract.id,
      ).expect(403);
      // A's project lead can't use B's header to reach B's workspaces.
      await get(
        'workspaces/hse',
        await signIn(projectLead),
        companyB.id,
        contract.id,
      ).expect(403);
      await get(
        'workspaces/project',
        await signIn(adminO),
        companyO.id,
        contract.id,
      ).expect(404);
    });

    it('refuses a workspace the contract does not have, and archived contracts', async () => {
      const other = await factory.createAdditionalContract(companyA);
      const otherParty = await factory.createAdditionalParty(other, companyA);
      await factory.createAdditionalWorkspace(other, projectLead, 'project');
      await grant(otherParty, hseAdmin, EContractorContractRole.HSE_OFFICER);
      await get(
        'workspaces/hse',
        await signIn(hseAdmin),
        companyA.id,
        other.id,
      ).expect(403);

      await dataSource
        .getRepository(Contract)
        .update({ id: contract.id }, { deletedAt: new Date() });
      await get(
        'workspaces/project',
        await signIn(projectLead),
        companyA.id,
        contract.id,
      ).expect(404);
    });

    it('validates the workspace and rejects scope ids outside the headers', async () => {
      const cookie = await signIn(projectLead);
      await get('workspaces/admin', cookie, companyA.id, contract.id).expect(
        400,
      );
      await get('workspaces/general', cookie, companyA.id, contract.id).expect(
        400,
      );
      await get('workspaces/project', cookie, companyA.id, contract.id, {
        companyId: companyB.id,
      }).expect(400);
      await get('workspaces/project', cookie, companyA.id, contract.id, {
        contractId: contract.id,
      }).expect(400);
      await get('workspaces/project', null, companyA.id, contract.id).expect(
        401,
      );
      await get('workspace-access', null, companyA.id, contract.id).expect(401);
    });
  });

  describe('workspace team management (existing role routes)', () => {
    it('lets a Workspace Admin assign within their workspace only, without granting admin rights', async () => {
      const assigned = await roles.assign(
        hseAdmin.userId,
        companyA.id,
        contract.id,
        'hse',
        plainA.id,
        EContractorContractRole.HSE_MANAGER,
      );
      expect(assigned).toMatchObject({
        companyUserId: plainA.id,
        role: EContractorContractRole.HSE_MANAGER,
      });

      await expect(
        roles.assign(
          hseAdmin.userId,
          companyA.id,
          contract.id,
          'project',
          plainA.id,
          EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        roles.assign(
          hseAdmin.userId,
          companyA.id,
          contract.id,
          'hse',
          financeMember.id,
          EContractorContractRole.HSE_OFFICER,
          true,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses team changes to members without Workspace Admin rights', async () => {
      await expect(
        roles.assign(
          financeMember.userId,
          companyA.id,
          contract.id,
          'finance',
          plainA.id,
          EContractorContractRole.FINANCE_DIRECTOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        roles.list(projectLead.userId, companyA.id, contract.id, 'project'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps another company’s Workspace Admin out of this company’s team', async () => {
      await expect(
        roles.assign(
          hseB.userId,
          companyA.id,
          contract.id,
          'hse',
          plainA.id,
          EContractorContractRole.HSE_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // B's admin manages B's own HSE team, which never includes A's members.
      const team = await roles.list(
        hseB.userId,
        companyB.id,
        contract.id,
        'hse',
      );
      expect(team.map((row) => row.companyUserId)).toEqual([hseB.id]);
    });

    it('never leaves a workspace without an administrator', async () => {
      const own = await dataSource
        .getRepository(ContractRoleAssignment)
        .findOneByOrFail({ companyUserId: hseAdmin.id });
      await expect(
        roles.revoke(hseAdmin.userId, companyA.id, contract.id, own.id),
      ).rejects.toBeInstanceOf(ConflictException);

      // A replacement first, then the original admin may step down.
      const replacement = await roles.assign(
        adminA.userId,
        companyA.id,
        contract.id,
        'hse',
        plainA.id,
        EContractorContractRole.HSE_MANAGER,
        true,
      );
      expect(replacement.isWorkspaceAdmin).toBe(true);
      await expect(
        roles.revoke(hseAdmin.userId, companyA.id, contract.id, own.id),
      ).resolves.toMatchObject({
        id: own.id,
      });
    });

    it('treats an unknown assignment as not found', async () => {
      await expect(
        roles.revoke(
          hseAdmin.userId,
          companyA.id,
          contract.id,
          '01AAAAAAAAAAAAAAAAAAAAAAAA',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
