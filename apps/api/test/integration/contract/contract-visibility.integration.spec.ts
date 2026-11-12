import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractorContractRole,
  type ContractRole,
  type ContractWorkspaceAccessResponse,
} from '@contractflow/contracts-schema';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { CompanyContextGuard } from '../../../src/common/guards/company-context.guard';
import { ContractContextGuard } from '../../../src/common/guards/contract-context.guard';
import { SessionAuthGuard } from '../../../src/common/guards/session-auth.guard';
import { ContractController } from '../../../src/modules/contract/controllers/contract-controller';
import { ContractWorkspaceController } from '../../../src/modules/contract/controllers/contract-workspace.controller';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import {
  ContractRoleAssignmentTransactionContextFactory,
  TypeOrmContractRoleAssignmentContext,
} from '../../../src/modules/contract/repositories/contract-role-assignment-transaction-context.factory';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractStatusHistoryRepository } from '../../../src/modules/contract/repositories/contract-status-history.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import { ContractRoleAssignmentService } from '../../../src/modules/contract/services/contract-role-assignment.service';
import { ContractWorkspaceAccessService } from '../../../src/modules/contract/services/contract-workspace-access.service';
import { ContractService } from '../../../src/modules/contract/services/contract.service';
import { ActivityController } from '../../../src/modules/cross-cutting/controllers/activity.controller';
import { ActivityLogRepository } from '../../../src/modules/cross-cutting/repositories/activity-log.repository';
import { ActivityService } from '../../../src/modules/cross-cutting/services/activity.service';
import { DeliveryController } from '../../../src/modules/delivery/controllers/delivery.controller';
import { ContractStageRepository } from '../../../src/modules/delivery/repositories/contract-stage.repository';
import { ContractVariationRepository } from '../../../src/modules/delivery/repositories/contract-variation.repository';
import { MilestoneRepository } from '../../../src/modules/delivery/repositories/milestone.repository';
import { DeliveryService } from '../../../src/modules/delivery/services/delivery.service';
import { FinancialController } from '../../../src/modules/financial/controllers/financial.controller';
import { InvoiceRepository } from '../../../src/modules/financial/repositories/invoice.repository';
import { PaymentRepository } from '../../../src/modules/financial/repositories/payment.repository';
import { FinancialService } from '../../../src/modules/financial/services/financial.service';
import { HseController } from '../../../src/modules/hse/controllers/hse.controller';
import { HseCorrectiveActionRepository } from '../../../src/modules/hse/repositories/hse-corrective-action.repository';
import { HseIncidentRepository } from '../../../src/modules/hse/repositories/hse-incident.repository';
import { HseInspectionRepository } from '../../../src/modules/hse/repositories/hse-inspection.repository';
import { HseService } from '../../../src/modules/hse/services/hse.service';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import {
  APP_USER_REPOSITORY,
  AUTH_UNIT_OF_WORK,
} from '../../../src/modules/identity/interface/auth-persistence.interface';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { UserSessionRepository } from '../../../src/modules/identity/repositories/user-session.repository';
import { UserSession } from '../../../src/modules/identity/entities/user-session.entity';
import { AuthService } from '../../../src/modules/identity/services/auth/auth.service';
import { PasswordService } from '../../../src/modules/identity/services/auth/password.service';
import { SessionService } from '../../../src/modules/identity/services/auth/session.service';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import { MailService } from '../../../src/modules/mail/mail.service';
import { SiteOperationsController } from '../../../src/modules/site-operations/controllers/site-operations.controller';
import { ContractSiteRepository } from '../../../src/modules/site-operations/repositories/contract-site.repository';
import { InventoryItemRepository } from '../../../src/modules/site-operations/repositories/inventory-item.repository';
import { InventoryTransactionRepository } from '../../../src/modules/site-operations/repositories/inventory-transaction.repository';
import { SiteDailyLogRepository } from '../../../src/modules/site-operations/repositories/site-daily-log.repository';
import { SiteOperationsService } from '../../../src/modules/site-operations/services/site-operations.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/** The read-only oversight surface a Company Administrator gets without a role. */
const OVERSIGHT_PATHS = ['', '/parties', '/status-history', '/workspaces'];

/**
 * Protected contract resources: collection and single-record routes. Only an
 * active role assignment for the matching workspace opens them; Company
 * Administrator oversight never does.
 */
const PROTECTED_PATHS = [
  '/activity',
  '/activity/actors',
  '/stages',
  `/stages/${ulid()}`,
  '/milestones',
  `/milestones/${ulid()}`,
  '/variations',
  `/variations/${ulid()}`,
  '/invoices',
  `/invoices/${ulid()}`,
  '/payments',
  `/payments/${ulid()}`,
  '/hse/incidents',
  `/hse/incidents/${ulid()}`,
  '/hse/inspections',
  `/hse/inspections/${ulid()}`,
  '/hse/corrective-actions',
  `/hse/corrective-actions/${ulid()}`,
  '/sites',
  `/sites/${ulid()}`,
  '/daily-logs',
  `/daily-logs/${ulid()}`,
  '/inventory-items',
  `/inventory-items/${ulid()}`,
  '/inventory-transactions',
  `/inventory-transactions/${ulid()}`,
  '/workspaces/project',
  '/workspaces/hse',
  '/workspaces/finance',
];

/**
 * Individual contract visibility with Company Administrator read-only
 * oversight, over real HTTP: session guard, company and contract context
 * guards, the real controllers and services, and PostgreSQL.
 */
describe('Contract visibility (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let sessions: SessionService;
  let cookieName: string;

  let companyA: Company;
  let companyB: Company;
  let companyO: Company;
  let contract: Contract; // C1: A and B are parties
  let second: Contract; // C2: A only
  let partyA: ContractParty;
  let partyB: ContractParty;
  let projectLead: CompanyUser; // A: Project Lead on C1
  let financeMember: CompanyUser; // A: Finance Officer on C1
  let hseAdmin: CompanyUser; // A: HSE Officer + Workspace Admin on C1
  let otherContractMember: CompanyUser; // A: role on C2 only
  let adminA: CompanyUser; // A: Company Administrator, no role
  let plainA: CompanyUser; // A: member, no role
  let memberB: CompanyUser; // B: HSE Manager on C1
  let adminO: CompanyUser; // unrelated company's administrator

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    sessions = new SessionService(
      new UserSessionRepository(dataSource.getRepository(UserSession)),
    );
    const mail = {
      sendContractRoleInvitationEmail: async () => undefined,
    } as unknown as MailService;
    const roleAssignmentPersistence = new TypeOrmContractRoleAssignmentContext(
      dataSource.manager,
    );
    const repositoryTokens = integrationEntities
      .filter((entity) => dataSource.hasMetadata(entity))
      .map((entity) => ({
        provide: getRepositoryToken(entity),
        useValue: dataSource.getRepository(entity),
      }));

    const moduleRef = await Test.createTestingModule({
      controllers: [
        ContractController,
        ContractWorkspaceController,
        ActivityController,
        DeliveryController,
        FinancialController,
        HseController,
        SiteOperationsController,
      ],
      providers: [
        ...repositoryTokens,
        CompanyUserRepository,
        ContractPartyRepository,
        ContractRoleAssignmentRepository,
        ContractRepository,
        ContractWorkspaceRepository,
        ContractStatusHistoryRepository,
        ActivityLogRepository,
        ContractStageRepository,
        MilestoneRepository,
        ContractVariationRepository,
        InvoiceRepository,
        PaymentRepository,
        HseIncidentRepository,
        HseInspectionRepository,
        HseCorrectiveActionRepository,
        ContractSiteRepository,
        SiteDailyLogRepository,
        InventoryItemRepository,
        InventoryTransactionRepository,
        CompanyScopeService,
        ContractAccessService,
        ContractService,
        ActivityService,
        DeliveryService,
        FinancialService,
        HseService,
        SiteOperationsService,
        {
          provide: ContractWorkspaceAccessService,
          useFactory: (access: ContractAccessService) =>
            new ContractWorkspaceAccessService(
              access,
              roleAssignmentPersistence,
            ),
          inject: [ContractAccessService],
        },
        {
          provide: ContractRoleAssignmentService,
          useValue: new ContractRoleAssignmentService(
            roleAssignmentPersistence,
            new TypeOrmUnitOfWork(
              dataSource,
              new ContractRoleAssignmentTransactionContextFactory(),
            ),
            mail,
          ),
        },
        {
          provide: ContractLifecycleService,
          useValue: new ContractLifecycleService(
            new TypeOrmUnitOfWork(
              dataSource,
              new ContractLifecycleContextFactory(),
            ),
            mail,
          ),
        },
        CompanyContextGuard,
        ContractContextGuard,
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        AuthService,
        { provide: SessionService, useValue: sessions },
        { provide: AUTH_UNIT_OF_WORK, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: MailService, useValue: mail },
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
    projectLead = lifecycle.actor;
    await factory.createAdditionalWorkspace(contract, projectLead, 'hse');
    await factory.createAdditionalWorkspace(contract, projectLead, 'finance');

    financeMember = await factory.createAdditionalMember(companyA);
    await grant(partyA, financeMember, EContractorContractRole.FINANCE_OFFICER);
    hseAdmin = await factory.createAdditionalMember(companyA);
    await grant(partyA, hseAdmin, EContractorContractRole.HSE_OFFICER, true);
    adminA = await factory.createAdditionalMember(
      companyA,
      ECompanyRole.COMPANY_ADMIN,
    );
    plainA = await factory.createAdditionalMember(companyA);

    second = await factory.createAdditionalContract(companyA);
    const secondParty = await factory.createAdditionalParty(second, companyA);
    otherContractMember = await factory.createAdditionalMember(companyA);
    await grant(
      secondParty,
      otherContractMember,
      EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    );

    ({ company: companyB } = await factory.createCompanyMember());
    partyB = await factory.createAdditionalParty(contract, companyB);
    memberB = await factory.createAdditionalMember(companyB);
    await grant(partyB, memberB, EContractorContractRole.HSE_MANAGER);

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

  async function revokeAll(member: CompanyUser, role?: ContractRole) {
    await dataSource
      .getRepository(ContractRoleAssignment)
      .update(
        role ? { companyUserId: member.id, role } : { companyUserId: member.id },
        { revokedAt: new Date(), revokedById: member.id },
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

  function listContracts(
    cookie: string | null,
    companyId: string,
    query: Record<string, string> = {},
  ) {
    const call = request(app.getHttpServer())
      .get('/api/contracts')
      .query({ page: '1', limit: '50', ...query })
      .set('X-Company-Id', companyId);
    if (cookie) call.set('Cookie', cookie);
    return call;
  }

  function getContract(
    path: string,
    cookie: string | null,
    companyId: string,
    contractId: string,
    query: Record<string, string> = {},
  ) {
    const call = request(app.getHttpServer())
      .get(`/api/contract${path}`)
      .query(query)
      .set('X-Company-Id', companyId)
      .set('X-Contract-Id', contractId);
    if (cookie) call.set('Cookie', cookie);
    return call;
  }

  async function listedIds(
    member: CompanyUser,
    companyId = member.companyId,
    query: Record<string, string> = {},
  ): Promise<{ ids: string[]; total: number }> {
    const response = await listContracts(
      await signIn(member),
      companyId,
      query,
    ).expect(200);
    const body = response.body as {
      data: Array<{ id: string }>;
      meta: { totalItems: number };
    };
    return {
      ids: body.data.map(({ id }) => id).sort(),
      total: body.meta.totalItems,
    };
  }

  function send(
    method: 'post' | 'patch' | 'delete',
    path: string,
    cookie: string,
    companyId: string,
    contractId: string,
    body: Record<string, unknown> = {},
    query: Record<string, string> = {},
  ) {
    return request(app.getHttpServer())
      [method](`/api/contract${path}`)
      .query(query)
      .set('Cookie', cookie)
      .set('X-Company-Id', companyId)
      .set('X-Contract-Id', contractId)
      .send(body);
  }

  /**
   * Every contract route a member might probe: reads and writes, oversight,
   * protected and management. A caller who can't see the contract must get
   * the same answer for it as for a made-up contract id.
   */
  const PROBES: Array<{
    label: string;
    call: (cookie: string, companyId: string, contractId: string) => request.Test;
  }> = [
    ...OVERSIGHT_PATHS.map((path) => ({
      label: `GET ${path || '/'}`,
      call: (c: string, co: string, id: string) => getContract(path, c, co, id),
    })),
    ...PROTECTED_PATHS.map((path) => ({
      label: `GET ${path}`,
      call: (c: string, co: string, id: string) => getContract(path, c, co, id),
    })),
    ...[
      '/workspace-access',
      '/lifecycle-permissions',
      '/site-management',
      '/parties/signatory',
      '/party-invitations',
    ].map((path) => ({
      label: `GET ${path}`,
      call: (c: string, co: string, id: string) => getContract(path, c, co, id),
    })),
    ...['/role-management', '/role-assignments', '/role-assignment-members', '/role-invitations'].map(
      (path) => ({
        label: `GET ${path}?workspace=finance`,
        call: (c: string, co: string, id: string) =>
          getContract(path, c, co, id, { workspace: 'finance' }),
      }),
    ),
    {
      label: 'POST /transitions',
      call: (c, co, id) =>
        send('post', '/transitions', c, co, id, {
          transition: 'activate',
          reason: 'Probe',
        }),
    },
    {
      label: 'PATCH /parties/signatory',
      call: (c, co, id) =>
        send('patch', '/parties/signatory', c, co, id, {
          signatoryFirstName: 'Probe',
          signatoryLastName: 'Person',
          signatoryTitle: 'Director',
          signedAt: '2026-01-01T00:00:00.000Z',
        }),
    },
    {
      label: 'POST /role-assignments',
      call: (c, co, id) =>
        send(
          'post',
          '/role-assignments',
          c,
          co,
          id,
          {
            companyUserId: ulid(),
            role: EContractorContractRole.FINANCE_OFFICER,
          },
          { workspace: 'finance' },
        ),
    },
    {
      label: 'DELETE /role-assignments/:id',
      call: (c, co, id) => send('delete', `/role-assignments/${ulid()}`, c, co, id),
    },
    {
      label: 'POST /role-invitations',
      call: (c, co, id) =>
        send(
          'post',
          '/role-invitations',
          c,
          co,
          id,
          {
            email: 'probe@integration.contractflow.test',
            role: EContractorContractRole.FINANCE_OFFICER,
          },
          { workspace: 'finance' },
        ),
    },
  ];

  async function expectIndistinguishable(
    member: CompanyUser,
    companyId: string,
    expectedStatus: number,
  ) {
    const cookie = await signIn(member);
    const madeUp = ulid();
    for (const probe of PROBES) {
      const real = await probe.call(cookie, companyId, contract.id);
      const fake = await probe.call(cookie, companyId, madeUp);
      expect({ probe: probe.label, status: real.status }).toEqual({
        probe: probe.label,
        status: expectedStatus,
      });
      expect({ probe: probe.label, body: real.body }).toEqual({
        probe: probe.label,
        body: fake.body,
      });
    }
  }

  describe('no route reveals that a contract exists', () => {
    it('answers a member without a role exactly as for a made-up contract (404)', async () => {
      await expectIndistinguishable(plainA, companyA.id, 404);
    });

    it('answers a member whose role was revoked exactly as for a made-up contract (404)', async () => {
      await revokeAll(financeMember);
      await expectIndistinguishable(financeMember, companyA.id, 404);
    });

    it('answers members of a company that is not a party exactly as for a made-up contract (404)', async () => {
      const plainO = await factory.createAdditionalMember(companyO);
      await expectIndistinguishable(plainO, companyO.id, 404);
      await expectIndistinguishable(adminO, companyO.id, 404);
    });

    it('answers departed and inactive members at the company boundary, identically for every contract id (403)', async () => {
      // The company-context guard refuses them before any contract is read,
      // so the answer can't depend on the contract.
      await dataSource
        .getRepository(CompanyUser)
        .update({ id: projectLead.id }, { leftAt: new Date() });
      await expectIndistinguishable(projectLead, companyA.id, 403);

      await dataSource
        .getRepository(CompanyUser)
        .update(
          { id: financeMember.id },
          { status: ECompanyUserStatus.INACTIVE },
        );
      await expectIndistinguishable(financeMember, companyA.id, 403);
    });

    it('answers another company’s header exactly the same way for every contract id (403)', async () => {
      await expectIndistinguishable(adminO, companyA.id, 403);
    });
  });

  describe('security matrix: roles, administrators and workspaces', () => {
    it('lets a Company Administrator with a role open only that role’s workspace', async () => {
      await grant(partyA, adminA, EContractorContractRole.FINANCE_OFFICER);
      const cookie = await signIn(adminA);
      await getContract('/workspaces/finance', cookie, companyA.id, contract.id).expect(200);
      await getContract('/invoices', cookie, companyA.id, contract.id).expect(200);
      await getContract('/activity', cookie, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/hse', cookie, companyA.id, contract.id).expect(403);
      await getContract('/hse/incidents', cookie, companyA.id, contract.id).expect(403);
      await getContract('/workspaces/project', cookie, companyA.id, contract.id).expect(403);
      await getContract('/stages', cookie, companyA.id, contract.id).expect(403);
    });

    it('opens exactly the workspaces of a member’s several roles, and lists the contract once', async () => {
      await grant(partyA, financeMember, EContractorContractRole.HSE_OFFICER);
      const cookie = await signIn(financeMember);
      await getContract('/workspaces/finance', cookie, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/hse', cookie, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/project', cookie, companyA.id, contract.id).expect(403);
      await expect(listedIds(financeMember)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });
    });

    it('rejects an unknown workspace identifier (400)', async () => {
      const cookie = await signIn(projectLead);
      await getContract('/workspaces/payroll', cookie, companyA.id, contract.id).expect(400);
      await getContract('/role-management', cookie, companyA.id, contract.id, {
        workspace: 'payroll',
      }).expect(400);
    });

    it('keeps admin-only management closed to visible members who aren’t administrators (403)', async () => {
      const cookie = await signIn(projectLead);
      for (const path of ['/site-management', '/parties/signatory', '/party-invitations']) {
        const response = await getContract(path, cookie, companyA.id, contract.id);
        expect({ path, status: response.status }).toEqual({ path, status: 403 });
      }
      await getContract('/role-assignments', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(403);
      await request(app.getHttpServer())
        .get('/api/company/role-assignments')
        .query({ page: '1', limit: '20' })
        .set('Cookie', cookie)
        .set('X-Company-Id', companyA.id)
        .expect(403);
      // The lifecycle flags say so too.
      const flags = await getContract('/lifecycle-permissions', cookie, companyA.id, contract.id).expect(200);
      expect(flags.body).toEqual({ canManage: false, canTransition: true, canRestore: false });
    });

    it('keeps company-wide role assignments open to the Company Administrator', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/company/role-assignments')
        .query({ page: '1', limit: '50' })
        .set('Cookie', await signIn(adminA))
        .set('X-Company-Id', companyA.id)
        .expect(200);
      const rows = (response.body as { data: Array<{ companyUserId: string }> }).data;
      expect(rows.map(({ companyUserId }) => companyUserId).sort()).toEqual(
        [projectLead.id, financeMember.id, hseAdmin.id, otherContractMember.id].sort(),
      );
    });

    it('lets an administrator without a role reach the transition check only to be refused (403), and keeps conflicts as 409', async () => {
      const admin = await signIn(adminA);
      await send('post', '/transitions', admin, companyA.id, contract.id, {
        transition: 'activate',
        reason: 'Starting',
      }).expect(403);
      // The project lead may transition; an impossible transition conflicts.
      await send('post', '/transitions', await signIn(projectLead), companyA.id, contract.id, {
        transition: 'resume',
        reason: 'Not on hold',
      }).expect(409);
      // Restoring a contract that isn't archived conflicts as before.
      await send('post', '/restore', admin, companyA.id, contract.id).expect(409);
    });
  });

  describe('contract list and discovery (GET /contracts)', () => {
    it('shows a Company Administrator every contract the company is party to, without a role', async () => {
      await expect(listedIds(adminA)).resolves.toEqual({
        ids: [contract.id, second.id].sort(),
        total: 2,
      });
    });

    it('shows an ordinary member only the contracts they hold an active role on', async () => {
      await expect(listedIds(projectLead)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });
      await expect(listedIds(otherContractMember)).resolves.toEqual({
        ids: [second.id],
        total: 1,
      });
    });

    it('shows a member with no role nothing, with a zero count', async () => {
      await expect(listedIds(plainA)).resolves.toEqual({ ids: [], total: 0 });
    });

    it('never lets search or sorting reveal an inaccessible contract', async () => {
      for (const query of [
        { search: contract.title },
        { search: contract.referenceNumber },
        { sortBy: 'title', sortOrder: 'ASC' },
        { status: contract.status },
      ]) {
        await expect(listedIds(plainA, companyA.id, query)).resolves.toEqual({
          ids: [],
          total: 0,
        });
      }
      await expect(
        listedIds(otherContractMember, companyA.id, { search: contract.title }),
      ).resolves.toEqual({ ids: [], total: 0 });
    });

    it('drops a contract as soon as the only role is revoked, and keeps it while another remains', async () => {
      await grant(partyA, financeMember, EContractorContractRole.HSE_OFFICER);
      await revokeAll(financeMember, EContractorContractRole.FINANCE_OFFICER);
      await expect(listedIds(financeMember)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });

      await revokeAll(financeMember);
      await expect(listedIds(financeMember)).resolves.toEqual({
        ids: [],
        total: 0,
      });
    });

    it('lists a contract once, however many roles the member holds on it', async () => {
      await grant(partyA, projectLead, EContractorContractRole.FINANCE_OFFICER);
      await grant(partyA, projectLead, EContractorContractRole.HSE_OFFICER);
      await expect(listedIds(projectLead)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });
    });

    it('never counts a role held through another company’s party', async () => {
      // memberB's user also joins company A, with no role there.
      const alsoInA = await dataSource.getRepository(CompanyUser).save(
        dataSource.getRepository(CompanyUser).create({
          companyId: companyA.id,
          userId: memberB.userId,
          companyRole: ECompanyRole.MEMBER,
          jobTitle: 'Integration test member',
          status: ECompanyUserStatus.ACTIVE,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      await expect(listedIds(memberB, companyB.id)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });
      await expect(listedIds(alsoInA, companyA.id)).resolves.toEqual({
        ids: [],
        total: 0,
      });
      // The B-party role does not open C1 under A's header either.
      await getContract('', await signIn(alsoInA), companyA.id, contract.id).expect(
        404,
      );
    });

    it('shows an unrelated company none of these contracts', async () => {
      await expect(listedIds(adminO)).resolves.toEqual({ ids: [], total: 0 });
    });

    it('refuses departed and inactive members at the company boundary', async () => {
      const leftCookie = await signIn(projectLead);
      await dataSource
        .getRepository(CompanyUser)
        .update({ id: projectLead.id }, { leftAt: new Date() });
      await listContracts(leftCookie, companyA.id).expect(403);

      const inactiveCookie = await signIn(financeMember);
      await dataSource
        .getRepository(CompanyUser)
        .update(
          { id: financeMember.id },
          { status: ECompanyUserStatus.INACTIVE },
        );
      await listContracts(inactiveCookie, companyA.id).expect(403);
    });

    it('requires a session', async () => {
      await listContracts(null, companyA.id).expect(401);
    });
  });

  describe('contract detail, parties, status history and workspaces', () => {
    it('serves the oversight surface to a Company Administrator without a role', async () => {
      const cookie = await signIn(adminA);
      for (const path of OVERSIGHT_PATHS) {
        await getContract(path, cookie, companyA.id, contract.id).expect(200);
      }
      const detail = await getContract('', cookie, companyA.id, contract.id);
      expect(detail.body).toMatchObject({
        contract: { id: contract.id },
        membership: { id: partyA.id },
      });
      // Nothing in the response reveals the internal access basis.
      expect(JSON.stringify(detail.body)).not.toContain('oversight');
    });

    it('serves the same surface to a member with an active role', async () => {
      const cookie = await signIn(projectLead);
      for (const path of OVERSIGHT_PATHS) {
        await getContract(path, cookie, companyA.id, contract.id).expect(200);
      }
    });

    it('hides the contract (404) from members without a role, with a role elsewhere, or revoked', async () => {
      await revokeAll(financeMember);
      for (const member of [plainA, otherContractMember, financeMember]) {
        const cookie = await signIn(member);
        for (const path of OVERSIGHT_PATHS) {
          await getContract(path, cookie, companyA.id, contract.id).expect(404);
        }
      }
    });

    it('answers a non-party company 404 and a non-member 403, whatever contract id is sent', async () => {
      const cookie = await signIn(adminO);
      await getContract('', cookie, companyO.id, contract.id).expect(404);
      await getContract('', cookie, companyA.id, contract.id).expect(403);
      // A real contract id and a made-up one look the same.
      const real = await getContract('', await signIn(plainA), companyA.id, contract.id);
      const fake = await getContract('', await signIn(plainA), companyA.id, ulid());
      expect(real.status).toBe(404);
      expect(fake.status).toBe(404);
      expect(real.body).toEqual(fake.body);
    });

    it('hides an archived contract from oversight and from role holders', async () => {
      await dataSource
        .getRepository(Contract)
        .update({ id: contract.id }, { deletedAt: new Date() });
      for (const member of [adminA, projectLead]) {
        await getContract('', await signIn(member), companyA.id, contract.id).expect(
          404,
        );
      }
    });
  });

  describe('protected contract resources and workspaces', () => {
    it('refuses a Company Administrator without a role (403) on every protected route', async () => {
      const cookie = await signIn(adminA);
      for (const path of PROTECTED_PATHS) {
        const response = await getContract(path, cookie, companyA.id, contract.id);
        expect({ path, status: response.status }).toEqual({ path, status: 403 });
      }
    });

    it('hides the contract (404) on every protected route from a member without a role', async () => {
      const cookie = await signIn(plainA);
      for (const path of PROTECTED_PATHS) {
        const response = await getContract(path, cookie, companyA.id, contract.id);
        expect({ path, status: response.status }).toEqual({ path, status: 404 });
      }
    });

    it('gives a Company Administrator without a role no workspace access in the summary', async () => {
      const response = await getContract(
        '/workspace-access',
        await signIn(adminA),
        companyA.id,
        contract.id,
      ).expect(200);
      const body = response.body as ContractWorkspaceAccessResponse;
      expect(body.workspaces.map(({ workspace }) => workspace)).toEqual([
        'project',
        'hse',
        'finance',
      ]);
      for (const entry of body.workspaces) {
        expect(entry).toMatchObject({
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        });
      }
    });

    it('opens only the workspace a role belongs to', async () => {
      const finance = await signIn(financeMember);
      await getContract('/workspaces/finance', finance, companyA.id, contract.id).expect(200);
      await getContract('/invoices', finance, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/hse', finance, companyA.id, contract.id).expect(403);
      await getContract('/hse/incidents', finance, companyA.id, contract.id).expect(403);
      await getContract('/workspaces/project', finance, companyA.id, contract.id).expect(403);
      await getContract('/stages', finance, companyA.id, contract.id).expect(403);

      const lead = await signIn(projectLead);
      await getContract('/stages', lead, companyA.id, contract.id).expect(200);
      await getContract('/invoices', lead, companyA.id, contract.id).expect(403);
    });

    it('keeps Workspace Admin rights to their own workspace', async () => {
      const cookie = await signIn(hseAdmin);
      await getContract('/workspaces/hse', cookie, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/finance', cookie, companyA.id, contract.id).expect(403);
      const hse = await getContract('/role-management', cookie, companyA.id, contract.id, {
        workspace: 'hse',
      }).expect(200);
      expect(hse.body).toMatchObject({ canManage: true, canGrantWorkspaceAdmin: false });
      const finance = await getContract('/role-management', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(200);
      expect(finance.body).toMatchObject({ canManage: false });
      await getContract('/role-assignments', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(403);
    });

    it('closes a former workspace after revocation, and never lends another contract’s role', async () => {
      await revokeAll(financeMember);
      await getContract(
        '/workspaces/finance',
        await signIn(financeMember),
        companyA.id,
        contract.id,
      ).expect(404);
      await getContract(
        '/workspaces/project',
        await signIn(otherContractMember),
        companyA.id,
        contract.id,
      ).expect(404);
    });
  });

  describe('Company Administrator management keeps working without a role', () => {
    it('reads lifecycle and role-management permissions, sites and role assignments', async () => {
      const cookie = await signIn(adminA);
      const lifecycle = await getContract(
        '/lifecycle-permissions',
        cookie,
        companyA.id,
        contract.id,
      ).expect(200);
      expect(lifecycle.body).toEqual({
        canManage: true,
        canTransition: false,
        canRestore: false,
      });
      const roles = await getContract('/role-management', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(200);
      expect(roles.body).toMatchObject({ canManage: true, canGrantWorkspaceAdmin: true });
      await getContract('/role-assignments', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(200);
      await getContract('/role-assignment-members', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(200);
      await getContract('/site-management', cookie, companyA.id, contract.id).expect(200);
    });

    it('hides lifecycle and role-management permissions (404) from a member without a role', async () => {
      const cookie = await signIn(plainA);
      await getContract('/lifecycle-permissions', cookie, companyA.id, contract.id).expect(404);
      await getContract('/role-management', cookie, companyA.id, contract.id, {
        workspace: 'finance',
      }).expect(404);
    });

    it('grants visibility through a direct role assignment and removes it on revocation', async () => {
      const admin = await signIn(adminA);
      const assigned = await request(app.getHttpServer())
        .post('/api/contract/role-assignments')
        .query({ workspace: 'finance' })
        .set('Cookie', admin)
        .set('X-Company-Id', companyA.id)
        .set('X-Contract-Id', contract.id)
        .send({
          companyUserId: plainA.id,
          role: EContractorContractRole.FINANCE_OFFICER,
        })
        .expect(201);
      const assignmentId = (assigned.body as { id: string }).id;

      const member = await signIn(plainA);
      await expect(listedIds(plainA)).resolves.toEqual({
        ids: [contract.id],
        total: 1,
      });
      await getContract('', member, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/finance', member, companyA.id, contract.id).expect(200);
      await getContract('/workspaces/project', member, companyA.id, contract.id).expect(403);

      // The administrator still has no workspace of their own.
      await getContract('/workspaces/finance', admin, companyA.id, contract.id).expect(403);

      await request(app.getHttpServer())
        .delete(`/api/contract/role-assignments/${assignmentId}`)
        .set('Cookie', admin)
        .set('X-Company-Id', companyA.id)
        .set('X-Contract-Id', contract.id)
        .expect(200);
      await expect(listedIds(plainA)).resolves.toEqual({ ids: [], total: 0 });
      await getContract('', member, companyA.id, contract.id).expect(404);
    });
  });
});
