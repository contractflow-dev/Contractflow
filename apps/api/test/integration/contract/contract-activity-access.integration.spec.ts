import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ECompanyRole,
  type ContractActivityItem,
  type IPaginatedResponse,
  EContractorContractRole,
  type ContractRole,
} from '@contractflow/contracts-schema';
import { CompanyContextGuard } from '../../../src/common/guards/company-context.guard';
import { ContractContextGuard } from '../../../src/common/guards/contract-context.guard';
import { SessionAuthGuard } from '../../../src/common/guards/session-auth.guard';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ActivityController } from '../../../src/modules/cross-cutting/controllers/activity.controller';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import { ActivityLogRepository } from '../../../src/modules/cross-cutting/repositories/activity-log.repository';
import { ActivityService } from '../../../src/modules/cross-cutting/services/activity.service';
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
 * `GET /api/contract/activity` over real HTTP: the global session guard, the
 * company and contract context guards, the validation pipe, ContractAccessService
 * and the company-scoped ActivityLogRepository all run against PostgreSQL.
 * Only AuthService's collaborators that `authenticate` never uses (mail,
 * passwords, registration persistence) are inert stand-ins.
 */
describe('Contract activity access PostgreSQL integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let sessions: SessionService;
  let cookieName: string;

  // A contract shared by A and B; O is unrelated. Each member below is
  // described by the access it should have.
  let companyA: Company;
  let companyB: Company;
  let companyO: Company;
  let contract: Contract;
  let partyB: ContractParty;
  let memberA: CompanyUser; // contract role through A's party
  let memberB: CompanyUser; // contract role through B's party
  let adminA: CompanyUser; // Company Administrator, no contract role
  let plainA: CompanyUser; // member of A, no contract role
  let adminO: CompanyUser; // administrator of an unrelated company
  let activityA: ActivityLog[]; // newest first
  let activityB: ActivityLog[];

  const SECRET_IP = '203.0.113.77';
  const SECRET_AGENT = 'LeakCheckAgent/9.9';
  const SECRET_VALUE = 'do-not-expose-this-secret';

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    sessions = new SessionService(
      new UserSessionRepository(dataSource.getRepository(UserSession)),
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
    const activity = new ActivityService(
      access,
      new ActivityLogRepository(dataSource.getRepository(ActivityLog)),
    );
    const companyScope = new CompanyScopeService(
      new CompanyUserRepository(dataSource.getRepository(CompanyUser)),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        { provide: ActivityService, useValue: activity },
        { provide: CompanyScopeService, useValue: companyScope },
        CompanyContextGuard,
        ContractContextGuard,
        // The real global guard and AuthService, backed by real sessions.
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
    // The same prefix and validation as main.ts.
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
    memberA = lifecycle.actor; // holds Contractor Project Lead through A's party
    adminA = await factory.createAdditionalMember(
      companyA,
      ECompanyRole.COMPANY_ADMIN,
    );
    plainA = await factory.createAdditionalMember(companyA);

    ({ company: companyB } = await factory.createCompanyMember());
    partyB = await factory.createAdditionalParty(contract, companyB);
    memberB = await factory.createAdditionalMember(companyB);
    await grantRole(
      partyB,
      memberB,
      EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
    );

    ({ company: companyO, member: adminO } =
      await factory.createCompanyMember());

    // Three entries by A and two by B, interleaved in time.
    activityA = [
      await writeActivity(companyA, memberA, 'contract.site_created', 10),
      await writeActivity(companyA, memberA, 'contract.signatory_recorded', 30),
      await writeActivity(companyA, memberA, 'contract.role_assigned', 50),
    ];
    activityB = [
      await writeActivity(companyB, memberB, 'document.upload_completed', 20),
      await writeActivity(companyB, memberB, 'contract.role_assigned', 40),
    ];
  });

  afterEach(async () => {
    // Contracts cascade to their activity; users cascade to their sessions.
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function grantRole(
    party: ContractParty,
    member: CompanyUser,
    role: ContractRole,
  ): Promise<ContractRoleAssignment> {
    const assignments = dataSource.getRepository(ContractRoleAssignment);
    return assignments.save(
      assignments.create({
        contractPartyId: party.id,
        companyUserId: member.id,
        companyId: member.companyId,
        role,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
  }

  /**
   * An activity row as the services write it, carrying values that must
   * never reach the response: request context, change sets and metadata.
   */
  async function writeActivity(
    company: Company,
    actor: CompanyUser,
    action: string,
    minutesAgo: number | Date,
    target: Contract = contract,
  ): Promise<ActivityLog> {
    const logs = dataSource.getRepository(ActivityLog);
    return logs.save(
      logs.create({
        contractId: target.id,
        companyId: company.id,
        actorUserId: actor.id,
        action,
        entityType: 'contract',
        entityId: randomUUID(),
        summary: `${action} by ${company.name}`,
        changes: { before: { password: SECRET_VALUE }, after: null },
        metadata: { token: SECRET_VALUE },
        ipAddress: SECRET_IP,
        userAgent: SECRET_AGENT,
        requestId: randomUUID(),
        occurredAt:
          minutesAgo instanceof Date
            ? minutesAgo
            : new Date(Date.now() - minutesAgo * 60_000),
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

  function getActivity(
    cookie: string | null,
    companyId: string | null,
    contractId: string | null,
    query: Record<string, string | number> = {},
  ) {
    const call = request(app.getHttpServer())
      .get('/api/contract/activity')
      .query(query);
    if (cookie) call.set('Cookie', cookie);
    if (companyId !== null) call.set('X-Company-Id', companyId);
    if (contractId !== null) call.set('X-Contract-Id', contractId);
    return call;
  }

  const ids = (rows: ActivityLog[]) => rows.map(({ id }) => id);
  const body = (response: { body: unknown }) =>
    response.body as IPaginatedResponse<ContractActivityItem>;

  describe('company isolation on a shared contract', () => {
    it('returns only the requesting company’s entries to each party', async () => {
      const a = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      expect(body(a).data.map(({ id }) => id)).toEqual(ids(activityA));
      expect(body(a).meta.totalItems).toBe(3);

      const b = await getActivity(
        await signIn(memberB),
        companyB.id,
        contract.id,
      ).expect(200);
      expect(body(b).data.map(({ id }) => id)).toEqual(ids(activityB));
      expect(body(b).meta.totalItems).toBe(2);
    });

    it('refuses another company’s header, so headers cannot cross companies', async () => {
      await getActivity(await signIn(memberA), companyB.id, contract.id).expect(
        403,
      );
      await getActivity(await signIn(memberB), companyA.id, contract.id).expect(
        403,
      );
    });

    it('never pages another company’s entries in, and counts only its own', async () => {
      const cookie = await signIn(memberA);
      const first = body(
        await getActivity(cookie, companyA.id, contract.id, {
          page: 1,
          limit: 2,
        }).expect(200),
      );
      const second = body(
        await getActivity(cookie, companyA.id, contract.id, {
          page: 2,
          limit: 2,
        }).expect(200),
      );

      const seen = [...first.data, ...second.data].map(({ id }) => id);
      expect(seen).toEqual(ids(activityA));
      expect(seen.some((id) => ids(activityB).includes(id))).toBe(false);
      expect(first.meta).toMatchObject({
        totalItems: 3,
        itemCount: 2,
        totalPages: 2,
        currentPage: 1,
      });
      expect(second.meta).toMatchObject({
        totalItems: 3,
        itemCount: 1,
        currentPage: 2,
      });
    });

    it('scopes each request to its own header for a user in both companies', async () => {
      // One person who belongs to both companies, with a role through each.
      const memberInB = await dataSource.getRepository(CompanyUser).save(
        dataSource.getRepository(CompanyUser).create({
          companyId: companyB.id,
          userId: memberA.userId,
          companyRole: ECompanyRole.MEMBER,
          jobTitle: 'Integration test member',
          status: memberA.status,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      await grantRole(
        partyB,
        memberInB,
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );
      const cookie = await signIn(memberA);

      const asA = body(
        await getActivity(cookie, companyA.id, contract.id).expect(200),
      );
      const asB = body(
        await getActivity(cookie, companyB.id, contract.id).expect(200),
      );
      const asAAgain = body(
        await getActivity(cookie, companyA.id, contract.id).expect(200),
      );

      expect(asA.data.map(({ id }) => id)).toEqual(ids(activityA));
      expect(asB.data.map(({ id }) => id)).toEqual(ids(activityB));
      expect(asAAgain.data.map(({ id }) => id)).toEqual(ids(activityA));
    });
  });

  describe('contract role authorization', () => {
    it('allows a member with an active role on the contract', async () => {
      await getActivity(await signIn(memberA), companyA.id, contract.id).expect(
        200,
      );
    });

    it('refuses a Company Administrator without a contract role', async () => {
      // Oversight makes the contract visible to them (403, not 404), but
      // never opens its activity.
      await getActivity(await signIn(adminA), companyA.id, contract.id).expect(
        403,
      );
    });

    it('hides the contract from a company member without a contract role', async () => {
      await getActivity(await signIn(plainA), companyA.id, contract.id).expect(
        404,
      );
    });

    it('refuses a member whose role is held on a different contract only', async () => {
      const other = await factory.createAdditionalContract(companyA);
      const otherParty = await factory.createAdditionalParty(other, companyA);
      await grantRole(
        otherParty,
        plainA,
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );

      await getActivity(await signIn(plainA), companyA.id, contract.id).expect(
        404,
      );
    });

    it('stops access as soon as the contract role is revoked', async () => {
      const cookie = await signIn(memberB);
      await getActivity(cookie, companyB.id, contract.id).expect(200);

      await dataSource
        .getRepository(ContractRoleAssignment)
        .update(
          { companyUserId: memberB.id, contractPartyId: partyB.id },
          { revokedAt: new Date(), revokedById: memberB.id },
        );
      await getActivity(cookie, companyB.id, contract.id).expect(404);
    });

    it('stops access once the member has left the company', async () => {
      const cookie = await signIn(memberB);
      await dataSource
        .getRepository(CompanyUser)
        .update({ id: memberB.id }, { leftAt: new Date() });

      await getActivity(cookie, companyB.id, contract.id).expect(403);
    });

    it('refuses an unrelated company, with its own or the party’s header', async () => {
      const cookie = await signIn(adminO);
      // Its own company is not a party to the contract.
      await getActivity(cookie, companyO.id, contract.id).expect(404);
      // It is not a member of the party company.
      await getActivity(cookie, companyA.id, contract.id).expect(403);
    });

    it('treats an archived contract as not found', async () => {
      await dataSource
        .getRepository(Contract)
        .update({ id: contract.id }, { deletedAt: new Date() });

      await getActivity(await signIn(memberA), companyA.id, contract.id).expect(
        404,
      );
    });
  });

  describe('authentication and request context', () => {
    it('rejects a request without a session, or with an unknown one', async () => {
      await getActivity(null, companyA.id, contract.id).expect(401);
      await getActivity(
        `${cookieName}=not-a-real-session`,
        companyA.id,
        contract.id,
      ).expect(401);
    });

    it('rejects a session that was signed out', async () => {
      const cookie = await signIn(memberA);
      await sessions.revokeSession(cookie.slice(cookieName.length + 1));

      await getActivity(cookie, companyA.id, contract.id).expect(401);
    });

    it('requires both context headers', async () => {
      const cookie = await signIn(memberA);
      await getActivity(cookie, null, contract.id).expect(400);
      await getActivity(cookie, companyA.id, null).expect(400);
    });

    it('rejects malformed company and contract identifiers', async () => {
      const cookie = await signIn(memberA);
      await getActivity(cookie, 'not-a-ulid', contract.id).expect(400);
      await getActivity(cookie, companyA.id, 'not-a-ulid').expect(400);
      await getActivity(
        cookie,
        `${companyA.id}' OR '1'='1`,
        contract.id,
      ).expect(400);
    });

    it('refuses scope identifiers in the query string', async () => {
      const cookie = await signIn(memberA);
      await getActivity(cookie, companyA.id, contract.id, {
        companyId: companyB.id,
      }).expect(400);
      await getActivity(cookie, companyA.id, contract.id, {
        contractId: contract.id,
      }).expect(400);
    });

    it('ignores other query parameters that try to widen the scope', async () => {
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
        // Unknown parameters are dropped. (actorUserId is a real filter
        // since Step 5.2; the filter tests show it can only narrow.)
        {
          companyIds: companyB.id,
          companyUserId: memberB.id,
          all: 'true',
        },
      ).expect(200);

      expect(body(response).data.map(({ id }) => id)).toEqual(ids(activityA));
    });
  });

  describe('response privacy', () => {
    it('returns only the established fields, never request context or change sets', async () => {
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      const items = body(response).data;

      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual([
          'action',
          'actorName',
          'actorUserId',
          'entityId',
          'entityType',
          'id',
          'occurredAt',
          'summary',
          'target',
        ]);
        // These rows carry no approved record id (only a secret token), so
        // no target is derived from them.
        expect(item.target).toBeNull();
      }
      const raw = JSON.stringify(response.body);
      for (const hidden of [
        SECRET_IP,
        SECRET_AGENT,
        SECRET_VALUE,
        'password',
        'token',
        'requestId',
        'ipAddress',
        'userAgent',
        'metadata',
        'changes',
        'companyId',
        'contractId',
      ]) {
        expect(raw).not.toContain(hidden);
      }
      for (const row of activityA) {
        expect(raw).not.toContain(row.requestId as string);
      }
    });

    it('exposes only an approved, structured record target, never the metadata around it', async () => {
      const logs = dataSource.getRepository(ActivityLog);
      async function writeTargeted(
        company: Company,
        actor: CompanyUser,
        action: string,
        entityType: string,
        details: {
          metadata?: Record<string, unknown>;
          after?: Record<string, unknown> | null;
        },
        minutesAgo: number,
      ): Promise<ActivityLog> {
        return logs.save(
          logs.create({
            contractId: contract.id,
            companyId: company.id,
            actorUserId: actor.id,
            action,
            entityType,
            entityId: randomUUID(),
            summary: `${action} by ${company.name}`,
            changes: {
              before: { password: SECRET_VALUE },
              after: details.after ?? null,
            },
            metadata: { token: SECRET_VALUE, ...details.metadata },
            ipAddress: SECRET_IP,
            userAgent: SECRET_AGENT,
            requestId: randomUUID(),
            occurredAt: new Date(Date.now() - minutesAgo * 60_000),
          }),
        );
      }

      const site = await writeTargeted(
        companyA,
        memberA,
        'contract.site_created',
        'contract',
        { after: { siteId: 'site-01', siteCode: SECRET_VALUE } },
        1,
      );
      const role = await writeTargeted(
        companyA,
        memberA,
        'contract.role_assigned',
        'contract_role_assignment',
        {
          metadata: {
            assignmentId: 'assignment-01',
            workspace: 'finance',
            companyUserId: 'private-member-id',
          },
        },
        2,
      );
      const upload = await writeTargeted(
        companyA,
        memberA,
        'document.upload_completed',
        'document',
        {
          metadata: {
            documentId: 'document-01',
            versionId: 'version-01',
            storageKey: 'private/storage/key',
          },
        },
        3,
      );
      // An unknown workspace is dropped, never echoed.
      const oddWorkspace = await writeTargeted(
        companyA,
        memberA,
        'contract.role_revoked',
        'contract_role_assignment',
        { metadata: { assignmentId: 'assignment-02', workspace: 'payroll' } },
        4,
      );
      // Unsupported or deleted records get no target.
      const deleted = await writeTargeted(
        companyA,
        memberA,
        'document.deleted',
        'document',
        { metadata: { documentId: 'deleted-document-01' } },
        5,
      );
      const mismatched = await writeTargeted(
        companyA,
        memberA,
        'contract.role_assigned',
        'contract',
        { metadata: { assignmentId: 'wrong-entity-01' } },
        6,
      );
      const noId = await writeTargeted(
        companyA,
        memberA,
        'document.upload_completed',
        'document',
        { metadata: { documentId: 42 } },
        7,
      );
      // The other party's record never reaches A, not even as a target.
      await writeTargeted(
        companyB,
        memberB,
        'document.upload_completed',
        'document',
        { metadata: { documentId: 'company-b-document', versionId: 'b-v1' } },
        1,
      );

      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
        { limit: 50 },
      ).expect(200);
      const byId = new Map(body(response).data.map((item) => [item.id, item]));

      expect(byId.get(site.id)?.target).toEqual({
        type: 'contract_site',
        id: 'site-01',
        section: 'sites',
      });
      expect(byId.get(role.id)?.target).toEqual({
        type: 'contract_role_assignment',
        id: 'assignment-01',
        section: 'roles',
        workspace: 'finance',
      });
      expect(byId.get(upload.id)?.target).toEqual({
        type: 'document',
        id: 'document-01',
        section: 'documents',
        versionId: 'version-01',
      });
      expect(byId.get(oddWorkspace.id)?.target).toEqual({
        type: 'contract_role_assignment',
        id: 'assignment-02',
        section: 'roles',
      });
      for (const row of [deleted, mismatched, noId]) {
        expect(byId.get(row.id)?.target).toBeNull();
      }

      const allowedKeys = ['id', 'section', 'type', 'versionId', 'workspace'];
      for (const item of body(response).data) {
        if (item.target) {
          expect(
            Object.keys(item.target).every((key) => allowedKeys.includes(key)),
          ).toBe(true);
        }
      }
      const raw = JSON.stringify(response.body);
      for (const hidden of [
        SECRET_VALUE,
        SECRET_IP,
        SECRET_AGENT,
        'private-member-id',
        'private/storage/key',
        'storageKey',
        'payroll',
        'deleted-document-01',
        'wrong-entity-01',
        'company-b-document',
        'b-v1',
      ]) {
        expect(raw).not.toContain(hidden);
      }
    });

    it('identifies the actor only by membership id and name, never user id or email', async () => {
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      const raw = JSON.stringify(response.body);

      expect(
        body(response).data.every((item) => item.actorUserId === memberA.id),
      ).toBe(true);
      expect(raw).not.toContain(memberA.userId);
      expect(raw).not.toContain('@integration.contractflow.test');
    });
  });

  describe('actor names', () => {
    /** "First Last" of the person behind a membership, as the API formats it. */
    async function nameOf(member: CompanyUser): Promise<string> {
      const person = await dataSource
        .getRepository(AppUser)
        .findOneByOrFail({ id: member.userId });
      return `${person.firstName} ${person.lastName}`;
    }
    const namesOf = (response: { body: unknown }) =>
      new Map(body(response).data.map((item) => [item.id, item.actorName]));

    it('names the actor of each entry', async () => {
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      const expected = await nameOf(memberA);

      expect(body(response).data.map(({ actorName }) => actorName)).toEqual([
        expected,
        expected,
        expected,
      ]);
    });

    it('names each company’s own actors on a shared contract', async () => {
      const a = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      const b = await getActivity(
        await signIn(memberB),
        companyB.id,
        contract.id,
      ).expect(200);
      const nameA = await nameOf(memberA);
      const nameB = await nameOf(memberB);

      expect(body(a).data.every(({ actorName }) => actorName === nameA)).toBe(
        true,
      );
      expect(body(b).data.every(({ actorName }) => actorName === nameB)).toBe(
        true,
      );
      expect(JSON.stringify(a.body)).not.toContain(nameB);
      expect(JSON.stringify(b.body)).not.toContain(nameA);
    });

    it('resolves the same person through the membership of the company in the header', async () => {
      // memberA's person also belongs to B and acts there.
      const memberInB = await dataSource.getRepository(CompanyUser).save(
        dataSource.getRepository(CompanyUser).create({
          companyId: companyB.id,
          userId: memberA.userId,
          companyRole: ECompanyRole.MEMBER,
          jobTitle: 'Integration test member',
          status: memberA.status,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      await grantRole(
        partyB,
        memberInB,
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );
      const inB = await writeActivity(
        companyB,
        memberInB,
        'contract.updated',
        1,
      );
      const cookie = await signIn(memberA);
      const person = await nameOf(memberA);

      const asB = await getActivity(cookie, companyB.id, contract.id).expect(
        200,
      );
      const entry = body(asB).data.find(({ id }) => id === inB.id);
      expect(entry).toMatchObject({
        actorUserId: memberInB.id,
        actorName: person,
      });
      // B's other entries keep B's own actor; nothing from A appears.
      expect(namesOf(asB).get(activityB[0].id)).toBe(await nameOf(memberB));
      expect(
        body(asB).data.some(({ actorUserId }) => actorUserId === memberA.id),
      ).toBe(false);

      const asA = await getActivity(cookie, companyA.id, contract.id).expect(
        200,
      );
      expect(body(asA).data.some(({ id }) => id === inB.id)).toBe(false);
      expect(
        body(asA).data.every(({ actorUserId }) => actorUserId === memberA.id),
      ).toBe(true);
    });

    it('never resolves a member of another party company, even if an entry points at one', async () => {
      // An inconsistent row: A's entry naming B's membership as the actor.
      const crossed = await writeActivity(
        companyA,
        memberB,
        'contract.updated',
        2,
      );
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);

      expect(namesOf(response).get(crossed.id)).toBeNull();
      expect(JSON.stringify(response.body)).not.toContain(
        await nameOf(memberB),
      );
    });

    it('never resolves a member of an unrelated company', async () => {
      const crossed = await writeActivity(
        companyA,
        adminO,
        'contract.updated',
        2,
      );
      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);

      expect(namesOf(response).get(crossed.id)).toBeNull();
      expect(JSON.stringify(response.body)).not.toContain(await nameOf(adminO));
      expect(JSON.stringify(response.body)).not.toContain(adminO.userId);
    });

    it('returns null, not an error, for an actor without a name', async () => {
      await dataSource
        .getRepository(AppUser)
        .update({ id: plainA.userId }, { firstName: '', lastName: '' });
      const unnamed = await writeActivity(
        companyA,
        plainA,
        'contract.updated',
        2,
      );

      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      expect(namesOf(response).get(unnamed.id)).toBeNull();
      expect(namesOf(response).get(activityA[0].id)).toBe(
        await nameOf(memberA),
      );
    });

    it('keeps naming a member who has since left the company', async () => {
      const departed = await writeActivity(
        companyA,
        plainA,
        'contract.updated',
        2,
      );
      await dataSource
        .getRepository(CompanyUser)
        .update({ id: plainA.id }, { leftAt: new Date() });

      const response = await getActivity(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      expect(namesOf(response).get(departed.id)).toBe(await nameOf(plainA));
    });

    it('keeps the right names on every page', async () => {
      const other = await writeActivity(
        companyA,
        plainA,
        'contract.updated',
        20,
      );
      const cookie = await signIn(memberA);
      const pages = await Promise.all(
        [1, 2, 3, 4].map(
          async (page) =>
            body(
              await getActivity(cookie, companyA.id, contract.id, {
                page,
                limit: 1,
              }).expect(200),
            ).data[0],
        ),
      );
      const nameA = await nameOf(memberA);

      // Newest first: 10 min (A), 20 min (plainA), 30 min (A), 50 min (A).
      expect(pages.map(({ id }) => id)).toEqual([
        activityA[0].id,
        other.id,
        activityA[1].id,
        activityA[2].id,
      ]);
      expect(pages.map(({ actorName }) => actorName)).toEqual([
        nameA,
        await nameOf(plainA),
        nameA,
        nameA,
      ]);
    });
  });

  describe('pagination', () => {
    it('returns the requested page and limit, newest first', async () => {
      const cookie = await signIn(memberA);
      const page = body(
        await getActivity(cookie, companyA.id, contract.id, {
          page: 2,
          limit: 1,
        }).expect(200),
      );

      expect(page.data.map(({ id }) => id)).toEqual([activityA[1].id]);
      expect(page.meta).toEqual({
        totalItems: 3,
        itemCount: 1,
        itemsPerPage: 1,
        totalPages: 3,
        currentPage: 2,
      });

      const all = body(
        await getActivity(cookie, companyA.id, contract.id).expect(200),
      );
      const times = all.data.map(({ occurredAt }) =>
        new Date(occurredAt).getTime(),
      );
      expect(times).toEqual([...times].sort((x, y) => y - x));
    });

    it('is unaffected by another company’s entries, however many there are', async () => {
      for (let index = 0; index < 5; index += 1) {
        await writeActivity(companyB, memberB, 'document.downloaded', index);
      }
      const page = body(
        await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
        ).expect(200),
      );

      expect(page.meta.totalItems).toBe(3);
      expect(page.data.map(({ id }) => id)).toEqual(ids(activityA));
    });

    it('returns the standard empty structure when there is no activity', async () => {
      const empty = await factory.createAdditionalContract(companyA);
      const emptyParty = await factory.createAdditionalParty(empty, companyA);
      await grantRole(
        emptyParty,
        plainA,
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );
      // Entries on another contract don't count here.
      await writeActivity(companyA, plainA, 'contract.updated', 5);

      const response = await getActivity(
        await signIn(plainA),
        companyA.id,
        empty.id,
      ).expect(200);
      expect(response.body).toEqual({
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      });
    });

    it('rejects page and limit values outside the allowed range', async () => {
      const cookie = await signIn(memberA);
      await getActivity(cookie, companyA.id, contract.id, {
        limit: 101,
      }).expect(400);
      await getActivity(cookie, companyA.id, contract.id, { limit: 0 }).expect(
        400,
      );
      await getActivity(cookie, companyA.id, contract.id, { page: 0 }).expect(
        400,
      );
      await getActivity(cookie, companyA.id, contract.id, {
        page: 'two',
      }).expect(400);
    });
  });

  describe('filters', () => {
    const minutesAgo = (minutes: number) =>
      new Date(Date.now() - minutes * 60_000).toISOString();
    const idsOf = (response: { body: unknown }) =>
      body(response).data.map(({ id }) => id);
    const EMPTY = {
      data: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 20,
        totalPages: 0,
        currentPage: 1,
      },
    };

    describe('date range', () => {
      it('keeps entries from the start date on', async () => {
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: minutesAgo(35),
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([activityA[0].id, activityA[1].id]);
        expect(body(response).meta.totalItems).toBe(2);
      });

      it('keeps entries up to the end date', async () => {
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            toDate: minutesAgo(20),
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([activityA[1].id, activityA[2].id]);
      });

      it('includes entries exactly on either boundary', async () => {
        const at = activityA[1].occurredAt.toISOString();
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: at,
            toDate: at,
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([activityA[1].id]);
      });

      it('combines start and end, excluding everything outside the range', async () => {
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: minutesAgo(40),
            toDate: minutesAgo(20),
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([activityA[1].id]);
        expect(body(response).meta.totalItems).toBe(1);
      });

      it('reads a calendar day as the whole UTC day', async () => {
        const at = (iso: string) =>
          writeActivity(
            companyA,
            memberA,
            'contract.site_updated',
            new Date(iso),
          );
        const before = await at('2026-03-14T23:59:59.999Z');
        const first = await at('2026-03-15T00:00:00.000Z');
        const last = await at('2026-03-15T23:59:59.999Z');
        const after = await at('2026-03-16T00:00:00.000Z');

        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: '2026-03-15',
            toDate: '2026-03-15',
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([last.id, first.id]);
        expect(idsOf(response)).not.toContain(before.id);
        expect(idsOf(response)).not.toContain(after.id);
      });

      it('honours the time zone of a zoned instant', async () => {
        const inside = await writeActivity(
          companyA,
          memberA,
          'contract.site_updated',
          new Date('2026-03-15T23:30:00.000Z'),
        );
        // 16 March in UTC+01:00 runs from 15 March 23:00 UTC.
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: '2026-03-16T00:00:00.000+01:00',
            toDate: '2026-03-16T23:59:59.999+01:00',
          },
        ).expect(200);
        expect(idsOf(response)).toEqual([inside.id]);
      });

      it('rejects malformed, impossible and zone-less dates', async () => {
        const cookie = await signIn(memberA);
        for (const fromDate of [
          'yesterday',
          '2026-02-30',
          '2026-13-01',
          '2026-11-10T10:00:00',
          '10/11/2026',
        ]) {
          await getActivity(cookie, companyA.id, contract.id, {
            fromDate,
          }).expect(400);
        }
        await getActivity(cookie, companyA.id, contract.id, {
          toDate: 'not-a-date',
        }).expect(400);
      });

      it('rejects an end date earlier than the start date', async () => {
        await getActivity(await signIn(memberA), companyA.id, contract.id, {
          fromDate: '2026-11-11',
          toDate: '2026-11-10',
        }).expect(400);
      });
    });

    describe('actor', () => {
      it('keeps only the chosen member’s entries, still named', async () => {
        const byAdmin = await writeActivity(
          companyA,
          adminA,
          'contract.site_updated',
          5,
        );
        const cookie = await signIn(memberA);

        const admin = await getActivity(cookie, companyA.id, contract.id, {
          actorUserId: adminA.id,
        }).expect(200);
        expect(idsOf(admin)).toEqual([byAdmin.id]);
        const person = await dataSource
          .getRepository(AppUser)
          .findOneByOrFail({ id: adminA.userId });
        expect(body(admin).data[0].actorName).toBe(
          `${person.firstName} ${person.lastName}`,
        );

        const member = await getActivity(cookie, companyA.id, contract.id, {
          actorUserId: memberA.id,
        }).expect(200);
        expect(idsOf(member)).toEqual(ids(activityA));
        expect(body(member).meta.totalItems).toBe(3);
      });

      it('scopes a person in both companies to the header company', async () => {
        const memberInB = await dataSource.getRepository(CompanyUser).save(
          dataSource.getRepository(CompanyUser).create({
            companyId: companyB.id,
            userId: memberA.userId,
            companyRole: ECompanyRole.MEMBER,
            jobTitle: 'Integration test member',
            status: memberA.status,
            joinedAt: new Date(),
            leftAt: null,
          }),
        );
        await grantRole(
          partyB,
          memberInB,
          EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
        );
        const inB = await writeActivity(
          companyB,
          memberInB,
          'contract.site_updated',
          5,
        );
        const cookie = await signIn(memberA);

        const asB = await getActivity(cookie, companyB.id, contract.id, {
          actorUserId: memberInB.id,
        }).expect(200);
        expect(idsOf(asB)).toEqual([inB.id]);
        // The same person's B membership finds nothing in A's context.
        const asA = await getActivity(cookie, companyA.id, contract.id, {
          actorUserId: memberInB.id,
        }).expect(200);
        expect(asA.body).toEqual(EMPTY);
      });

      it('cannot reach another company’s entries through its member', async () => {
        const cookie = await signIn(memberA);
        const response = await getActivity(cookie, companyA.id, contract.id, {
          actorUserId: memberB.id,
        }).expect(200);
        expect(response.body).toEqual(EMPTY);

        // An unrelated company's member, and an unknown id, find nothing either.
        for (const actorUserId of [adminO.id, '01AAAAAAAAAAAAAAAAAAAAAAAA']) {
          const other = await getActivity(cookie, companyA.id, contract.id, {
            actorUserId,
          }).expect(200);
          expect(other.body).toEqual(EMPTY);
        }
      });

      it('rejects a malformed actor id', async () => {
        const cookie = await signIn(memberA);
        for (const actorUserId of [
          'not-an-id',
          `${memberA.id}' OR '1'='1`,
          memberA.id.slice(0, 10),
        ]) {
          await getActivity(cookie, companyA.id, contract.id, {
            actorUserId,
          }).expect(400);
        }
      });
    });

    describe('action', () => {
      it('returns exactly the entries of each action', async () => {
        const cookie = await signIn(memberA);
        const expected: Array<[string, ActivityLog]> = [
          ['contract.site_created', activityA[0]],
          ['contract.signatory_recorded', activityA[1]],
          ['contract.role_assigned', activityA[2]],
        ];
        for (const [action, row] of expected) {
          const response = await getActivity(cookie, companyA.id, contract.id, {
            action,
          }).expect(200);
          expect(idsOf(response)).toEqual([row.id]);
          expect(
            body(response).data.every((item) => item.action === action),
          ).toBe(true);
        }
      });

      it('rejects actions the API does not record', async () => {
        const cookie = await signIn(memberA);
        for (const action of [
          'contract.hacked',
          'contract.updated',
          'CONTRACT.SITE_CREATED',
          'contract.site_created OR 1=1',
        ]) {
          await getActivity(cookie, companyA.id, contract.id, {
            action,
          }).expect(400);
        }
      });

      it('never returns another company’s entries for an action', async () => {
        const cookie = await signIn(memberA);
        // Only B recorded an upload; A shares role_assigned with B.
        const upload = await getActivity(cookie, companyA.id, contract.id, {
          action: 'document.upload_completed',
        }).expect(200);
        expect(upload.body).toEqual(EMPTY);
        const shared = await getActivity(cookie, companyA.id, contract.id, {
          action: 'contract.role_assigned',
        }).expect(200);
        expect(idsOf(shared)).toEqual([activityA[2].id]);
      });
    });

    describe('combined', () => {
      it('applies date, actor and action together, before paging, newest first', async () => {
        // Six matching entries, plus a near miss on each filter.
        const matching: ActivityLog[] = [];
        for (const minutes of [1, 2, 3, 4, 5]) {
          matching.push(
            await writeActivity(
              companyA,
              memberA,
              'contract.role_assigned',
              minutes,
            ),
          );
        }
        await writeActivity(companyA, adminA, 'contract.role_assigned', 6); // other actor
        await writeActivity(companyA, memberA, 'contract.site_updated', 7); // other action
        await writeActivity(companyA, memberA, 'contract.role_assigned', 120); // too early
        await writeActivity(companyB, memberB, 'contract.role_assigned', 8); // other company
        matching.push(activityA[2]); // role_assigned by memberA, 50 minutes ago

        const filters = {
          fromDate: minutesAgo(60),
          toDate: new Date(Date.now() + 60_000).toISOString(),
          actorUserId: memberA.id,
          action: 'contract.role_assigned',
        };
        const cookie = await signIn(memberA);
        const first = body(
          await getActivity(cookie, companyA.id, contract.id, {
            ...filters,
            page: 1,
            limit: 4,
          }).expect(200),
        );
        const second = body(
          await getActivity(cookie, companyA.id, contract.id, {
            ...filters,
            page: 2,
            limit: 4,
          }).expect(200),
        );
        const all = [...first.data, ...second.data];

        expect(all.map(({ id }) => id)).toEqual(matching.map(({ id }) => id));
        expect(first.meta).toEqual({
          totalItems: 6,
          itemCount: 4,
          itemsPerPage: 4,
          totalPages: 2,
          currentPage: 1,
        });
        expect(second.meta).toEqual({
          totalItems: 6,
          itemCount: 2,
          itemsPerPage: 4,
          totalPages: 2,
          currentPage: 2,
        });
        for (const item of all) {
          expect(item).toMatchObject({
            action: 'contract.role_assigned',
            actorUserId: memberA.id,
          });
          const at = new Date(item.occurredAt).getTime();
          expect(at).toBeGreaterThanOrEqual(
            new Date(filters.fromDate).getTime(),
          );
          expect(at).toBeLessThanOrEqual(new Date(filters.toDate).getTime());
        }
        const times = all.map(({ occurredAt }) =>
          new Date(occurredAt).getTime(),
        );
        expect(times).toEqual([...times].sort((x, y) => y - x));
      });

      it('returns the standard empty structure when nothing matches', async () => {
        const response = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          {
            fromDate: minutesAgo(40),
            toDate: minutesAgo(20),
            actorUserId: memberA.id,
            action: 'contract.site_created',
          },
        ).expect(200);
        expect(response.body).toEqual(EMPTY);
      });

      it('never widens access, whatever the filters', async () => {
        const wide = {
          fromDate: '2000-01-01',
          toDate: '2100-01-01',
          actorUserId: memberB.id,
          action: 'document.upload_completed',
        };
        // Another company's actor and action under A: nothing.
        const crossed = await getActivity(
          await signIn(memberA),
          companyA.id,
          contract.id,
          wide,
        ).expect(200);
        expect(crossed.body).toEqual(EMPTY);
        // The guards and the role check still come first.
        await getActivity(null, companyA.id, contract.id, wide).expect(401);
        await getActivity(
          await signIn(adminA),
          companyA.id,
          contract.id,
          wide,
        ).expect(403);
        await getActivity(
          await signIn(memberA),
          companyB.id,
          contract.id,
          wide,
        ).expect(403);
        await getActivity(
          await signIn(adminO),
          companyO.id,
          contract.id,
          wide,
        ).expect(404);
        await getActivity(await signIn(memberA), companyA.id, contract.id, {
          ...wide,
          companyId: companyB.id,
        }).expect(400);
        await getActivity(await signIn(memberA), companyA.id, contract.id, {
          ...wide,
          contractId: contract.id,
        }).expect(400);
      });
    });
  });

  describe('actor filter options', () => {
    function getActors(
      cookie: string | null,
      companyId: string,
      contractId: string,
    ) {
      const call = request(app.getHttpServer())
        .get('/api/contract/activity/actors')
        .set('X-Company-Id', companyId)
        .set('X-Contract-Id', contractId);
      if (cookie) call.set('Cookie', cookie);
      return call;
    }
    async function nameOf(member: CompanyUser): Promise<string> {
      const person = await dataSource
        .getRepository(AppUser)
        .findOneByOrFail({ id: member.userId });
      return `${person.firstName} ${person.lastName}`;
    }

    it('lists each actor of the caller’s company once, by name', async () => {
      await writeActivity(companyA, adminA, 'contract.site_updated', 5);
      const response = await getActors(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          { actorUserId: memberA.id, actorName: await nameOf(memberA) },
          { actorUserId: adminA.id, actorName: await nameOf(adminA) },
        ]),
      );
    });

    it('never lists another company’s members, even from an inconsistent entry', async () => {
      await writeActivity(companyA, memberB, 'contract.site_updated', 5);
      await writeActivity(companyA, adminO, 'contract.site_updated', 6);
      const response = await getActors(
        await signIn(memberA),
        companyA.id,
        contract.id,
      ).expect(200);
      const raw = JSON.stringify(response.body);

      expect(response.body).toEqual([
        { actorUserId: memberA.id, actorName: await nameOf(memberA) },
      ]);
      expect(raw).not.toContain(memberB.id);
      expect(raw).not.toContain(await nameOf(memberB));
      expect(raw).not.toContain(adminO.id);
      expect(raw).not.toContain('@integration.contractflow.test');
    });

    it('lists only the header company’s actors on a shared contract', async () => {
      const response = await getActors(
        await signIn(memberB),
        companyB.id,
        contract.id,
      ).expect(200);
      expect(response.body).toEqual([
        { actorUserId: memberB.id, actorName: await nameOf(memberB) },
      ]);
    });

    it('follows the same access rules as the activity itself', async () => {
      await getActors(null, companyA.id, contract.id).expect(401);
      await getActors(await signIn(adminA), companyA.id, contract.id).expect(
        403,
      );
      await getActors(await signIn(plainA), companyA.id, contract.id).expect(
        404,
      );
      await getActors(await signIn(memberA), companyB.id, contract.id).expect(
        403,
      );
      await getActors(await signIn(adminO), companyO.id, contract.id).expect(
        404,
      );
    });
  });
});
