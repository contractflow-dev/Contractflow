import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ECompanyRole,
  EClientContractRole,
  EContractorContractRole,
  EContractStatus,
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EPartyType,
  EStatus,
  type ContractRole,
  type ContractStage as StageResponse,
  type Milestone as MilestoneResponse,
  type MilestoneDecision as DecisionResponse,
  type MilestoneOutstandingItem as ItemResponse,
  type MilestoneSubmission as SubmissionResponse,
} from '@contractflow/contracts-schema';
import { CompanyContextGuard } from '../../../src/common/guards/company-context.guard';
import { ContractContextGuard } from '../../../src/common/guards/contract-context.guard';
import { SessionAuthGuard } from '../../../src/common/guards/session-auth.guard';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import { ActivityLogRepository } from '../../../src/modules/cross-cutting/repositories/activity-log.repository';
import { ActivityService } from '../../../src/modules/cross-cutting/services/activity.service';
import { DocumentVersion } from '../../../src/modules/cross-cutting/entities/document-version.entity';
import { Document } from '../../../src/modules/cross-cutting/entities/document.entity';
import { DeliveryController } from '../../../src/modules/delivery/controllers/delivery.controller';
import { ContractStage } from '../../../src/modules/delivery/entities/contract-stage.entity';
import { MilestoneDecision } from '../../../src/modules/delivery/entities/milestone-decision.entity';
import { MilestoneOutstandingItem } from '../../../src/modules/delivery/entities/milestone-outstanding-item.entity';
import { MilestoneSubmission } from '../../../src/modules/delivery/entities/milestone-submission.entity';
import { Milestone } from '../../../src/modules/delivery/entities/milestone.entity';
import {
  MILESTONE_WORKFLOW_READER,
  MILESTONE_WORKFLOW_UNIT_OF_WORK,
} from '../../../src/modules/delivery/interface/milestone-workflow-persistence.interface';
import {
  MilestoneWorkflowContextFactory,
  TypeOrmMilestoneWorkflowReader,
} from '../../../src/modules/delivery/repositories/milestone-workflow-context.factory';
import { DeliveryService } from '../../../src/modules/delivery/services/delivery.service';
import { MilestoneReadService } from '../../../src/modules/delivery/services/milestone-read.service';
import { MilestoneWorkflowService } from '../../../src/modules/delivery/services/milestone-workflow.service';
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
import { installPostgresFailureTrigger } from '../database/postgres-failure-trigger';
import { runLegacyMilestoneTransition } from '../../../src/scripts/transition-legacy-milestones';
import { parseLegacyMapping } from '../../../src/modules/delivery/services/legacy-milestone-transition';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Stages and Milestones over real HTTP and PostgreSQL: the session guard, the
 * company and contract context guards, the validation pipe,
 * ContractAccessService, the Unit of Work and the history tables.
 *
 * A contract between a client (company C, Client Project Manager) and a
 * contractor (company K, Contractor Project Lead), plus readers and outsiders
 * who must be refused.
 */
describe('Stages and Milestones workflow (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let sessions: SessionService;
  let cookieName: string;
  let activityFeed: ActivityService;

  let client: Company;
  let contractor: Company;
  let contract: Contract;
  let clientParty: ContractParty;
  let contractorParty: ContractParty;
  let manager: CompanyUser; // Client Project Manager
  let engineer: CompanyUser; // Client Site Engineer: reads, never plans or decides
  let lead: CompanyUser; // Contractor Project Lead
  let supervisor: CompanyUser; // Contractor Site Supervisor: reads, never submits
  let financeOfficer: CompanyUser; // contractor finance: no Project access
  let clientAdmin: CompanyUser; // Company Administrator without a contract role
  let outsiderAdmin: CompanyUser;

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
    const reader = new TypeOrmMilestoneWorkflowReader(dataSource.manager);
    activityFeed = new ActivityService(
      access,
      new ActivityLogRepository(dataSource.getRepository(ActivityLog)),
    );
    const unitOfWork = new TypeOrmUnitOfWork(
      dataSource,
      new MilestoneWorkflowContextFactory(),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [DeliveryController],
      providers: [
        { provide: ContractAccessService, useValue: access },
        { provide: MILESTONE_WORKFLOW_READER, useValue: reader },
        { provide: MILESTONE_WORKFLOW_UNIT_OF_WORK, useValue: unitOfWork },
        MilestoneReadService,
        MilestoneWorkflowService,
        // Variations aren't exercised here.
        { provide: DeliveryService, useValue: {} },
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
    ({ company: client, member: manager } = await factory.createCompanyMember(
      ECompanyRole.MEMBER,
    ));
    contract = await factory.createAdditionalContract(client);
    // Operations need an active contract (approved rule 6); fixtures are drafts.
    await setContract({ status: EContractStatus.ACTIVE });
    clientParty = await factory.createAdditionalParty(contract, client);
    clientParty.partyType = EPartyType.AWARDING;
    await dataSource.getRepository(ContractParty).save(clientParty);
    await factory.createAdditionalWorkspace(contract, manager, 'project');
    await factory.createAdditionalWorkspace(contract, manager, 'finance');
    await grant(
      clientParty,
      manager,
      EClientContractRole.CLIENT_PROJECT_MANAGER,
    );
    engineer = await factory.createAdditionalMember(client);
    await grant(
      clientParty,
      engineer,
      EClientContractRole.CLIENT_SITE_ENGINEER,
    );
    clientAdmin = await factory.createAdditionalMember(
      client,
      ECompanyRole.COMPANY_ADMIN,
    );

    ({ company: contractor, member: lead } = await factory.createCompanyMember(
      ECompanyRole.MEMBER,
    ));
    contractorParty = await factory.createAdditionalParty(contract, contractor);
    await grant(
      contractorParty,
      lead,
      EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    );
    supervisor = await factory.createAdditionalMember(contractor);
    await grant(
      contractorParty,
      supervisor,
      EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
    );
    financeOfficer = await factory.createAdditionalMember(contractor);
    await grant(
      contractorParty,
      financeOfficer,
      EContractorContractRole.FINANCE_OFFICER,
    );

    ({ member: outsiderAdmin } = await factory.createCompanyMember());
  });

  const documentIds: string[] = [];

  afterEach(async () => {
    // Evidence and document versions don't follow their contract on delete;
    // the rest of the workflow's rows do.
    if (documentIds.length) {
      await dataSource.query(
        'DELETE FROM "milestone_submission_evidence" WHERE "document_id" = ANY($1)',
        [documentIds],
      );
      await dataSource.query(
        'DELETE FROM "document_version" WHERE "document_id" = ANY($1)',
        [documentIds],
      );
      await dataSource.query('DELETE FROM "document" WHERE "id" = ANY($1)', [
        documentIds,
      ]);
      documentIds.length = 0;
    }
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  // --- Helpers ---------------------------------------------------------------

  async function setContract(values: Partial<Contract>): Promise<void> {
    await dataSource.getRepository(Contract).update(contract.id, values);
  }

  /** A calendar day in a time zone, as `YYYY-MM-DD`. */
  function dayIn(timeZone: string, now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  async function grant(
    party: ContractParty,
    member: CompanyUser,
    role: ContractRole,
  ): Promise<void> {
    const assignments = dataSource.getRepository(ContractRoleAssignment);
    await assignments.save(
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

  /** A call as `member`, in their company, on the contract. */
  async function as(member: CompanyUser) {
    const cookie = await signIn(member);
    const send = (
      method: 'get' | 'post' | 'patch',
      path: string,
      body?: object,
      companyId = member.companyId,
    ) => {
      const call = request(app.getHttpServer())
        [method](`/api/contract/${path}`)
        .set('Cookie', cookie)
        .set('X-Company-Id', companyId)
        .set('X-Contract-Id', contract.id);
      return body ? call.send(body) : call;
    };
    return {
      get: (path: string, companyId?: string) =>
        send('get', path, undefined, companyId),
      post: (path: string, body: object = {}, companyId?: string) =>
        send('post', path, body, companyId),
      patch: (path: string, body: object, companyId?: string) =>
        send('patch', path, body, companyId),
    };
  }

  /** A contract document with one available version, uploaded by `owner`. */
  async function evidenceDocument(
    owner: CompanyUser,
    options: {
      title?: string;
      visibility?: EDocumentVisibility;
      category?: EDocumentCategory;
      versions?: number;
      onContract?: Contract;
    } = {},
  ): Promise<{ document: Document; versions: DocumentVersion[] }> {
    const documents = dataSource.getRepository(Document);
    const document = await documents.save(
      documents.create({
        contractId: (options.onContract ?? contract).id,
        ownerCompanyId: owner.companyId,
        title: options.title ?? 'Installation photographs',
        documentNumber: `EV-${randomUUID().slice(0, 8)}`,
        category: options.category ?? EDocumentCategory.REPORT,
        visibility: options.visibility ?? EDocumentVisibility.PUBLIC,
        status: EDocumentStatus.VALID,
        deletedAt: null,
        deletedById: null,
      }),
    );
    documentIds.push(document.id);
    const versions: DocumentVersion[] = [];
    for (let number = 1; number <= (options.versions ?? 1); number += 1) {
      versions.push(await addVersion(document, owner, number));
    }
    return { document, versions };
  }

  async function addVersion(
    document: Document,
    owner: CompanyUser,
    versionNumber: number,
  ): Promise<DocumentVersion> {
    const versions = dataSource.getRepository(DocumentVersion);
    return versions.save(
      versions.create({
        documentId: document.id,
        versionNumber,
        storageKey: `test/${document.id}/${versionNumber}`,
        fileName: `photos-v${versionNumber}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksumSha256: 'a'.repeat(64),
        changeNote: '',
        uploadedById: owner.id,
        uploadedAt: new Date(),
        uploadStatus: EDocumentUploadStatus.AVAILABLE,
        storageProvider: 's3',
        storageBucket: 'integration',
        storageVersionId: null,
        uploadExpiresAt: null,
        failureReason: null,
      }),
    );
  }

  async function createStage(weightBps = 5000): Promise<StageResponse> {
    const response = await (
      await as(manager)
    )
      .post('stages', {
        name: 'Street lighting',
        weightBps,
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2027-12-31',
      })
      .expect(201);
    return response.body as StageResponse;
  }

  async function createStreetlights(
    stage: StageResponse,
  ): Promise<MilestoneResponse> {
    const response = await (
      await as(manager)
    )
      .post(`stages/${stage.id}/milestones`, {
        title: 'Install 100 solar streetlights',
        acceptanceCriteria:
          'Each light works dusk to dawn and is fixed to spec.',
        deliverables: 'Installed lights, test certificates, photographs',
        weightBps: 6000,
        plannedStartDate: '2027-02-01',
        dueDate: '2027-06-30',
        targetQuantity: 100,
        quantityUnit: 'streetlights',
        isPaymentMilestone: true,
        amountMinor: '5000000000',
      })
      .expect(201);
    return response.body as MilestoneResponse;
  }

  async function submit(
    milestone: MilestoneResponse,
    documentId: string,
    outstandingItemIds?: string[],
  ): Promise<SubmissionResponse> {
    const response = await (
      await as(lead)
    )
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'Work complete; photographs attached.',
        reportedProgressBps: 10000,
        evidence: [{ documentId, caption: 'Night-time photographs' }],
        ...(outstandingItemIds ? { outstandingItemIds } : {}),
      })
      .expect(201);
    return response.body as SubmissionResponse;
  }

  async function activity(): Promise<ActivityLog[]> {
    return dataSource.getRepository(ActivityLog).find({
      where: { contractId: contract.id },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });
  }

  // --- The streetlight workflow ----------------------------------------------

  it('runs the whole workflow: partial approval, outstanding work only, then approval', async () => {
    const stage = await createStage();
    const milestone = await createStreetlights(stage);
    expect(milestone).toMatchObject({
      status: EMilestoneStatus.PLANNED,
      approvedBps: 0,
      targetQuantity: 100,
      approvedQuantity: 0,
      currencyCode: contract.currencyCode,
      amountMinor: '5000000000',
      isOverdue: false,
    });

    const leadApi = await as(lead);
    const managerApi = await as(manager);
    const started = await leadApi
      .post(`milestones/${milestone.id}/start`)
      .expect(200);
    expect(started.body).toMatchObject({
      status: EMilestoneStatus.IN_PROGRESS,
    });
    expect((started.body as MilestoneResponse).actualStartDate).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );

    // 1. The contractor submits the whole milestone.
    const { document, versions } = await evidenceDocument(lead);
    const first = await submit(milestone, document.id);
    expect(first).toMatchObject({
      sequence: 1,
      submissionType: EMilestoneSubmissionType.INITIAL,
      previousDecisionId: null,
      submittedById: lead.id,
      evidence: [
        {
          documentId: document.id,
          documentVersionId: versions[0].id,
          versionNumber: 1,
          caption: 'Night-time photographs',
        },
      ],
      addressedItemIds: [],
      decision: null,
    });

    // The pending review queue shows it to the client.
    const queue = await managerApi
      .get('milestones?pendingReview=true')
      .expect(200);
    expect(queue.body.data.map(({ id }: MilestoneResponse) => id)).toEqual([
      milestone.id,
    ]);

    // 2. The client accepts 70, with 20 to correct and 10 to replace.
    const partial = await managerApi
      .post(`milestones/${milestone.id}/submissions/${first.id}/decision`, {
        decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
        reason:
          '30 units did not meet the agreed installation and quality requirements.',
        approvedBps: 7000,
        approvedWork: '70 verified installations',
        approvedQuantity: 70,
        outstandingItems: [
          { description: 'Correct the installation of 20 units', quantity: 20 },
          { description: 'Replace 10 units', quantity: 10 },
        ],
      })
      .expect(201);
    const partialDecision = partial.body as DecisionResponse;
    expect(partialDecision).toMatchObject({
      decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
      submissionId: first.id,
      approvedBps: 7000,
      cumulativeApprovedBps: 7000,
      approvedQuantity: 70,
      decidedById: manager.id,
    });
    expect(partialDecision.raisedItemIds).toHaveLength(2);

    const items = (
      await leadApi
        .get(`milestones/${milestone.id}/outstanding-items`)
        .expect(200)
    ).body as ItemResponse[];
    const [correct20, replace10] = items;
    expect(
      items.map(({ description, quantity, status }) => ({
        description,
        quantity,
        status,
      })),
    ).toEqual([
      {
        description: 'Correct the installation of 20 units',
        quantity: 20,
        status: 'outstanding',
      },
      { description: 'Replace 10 units', quantity: 10, status: 'outstanding' },
    ]);

    // Resubmitting the whole milestone, or only part of the open work, is refused.
    await leadApi
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'All again',
        evidence: [{ documentId: document.id }],
      })
      .expect(400);
    await leadApi
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'Some of it',
        evidence: [{ documentId: document.id }],
        outstandingItemIds: [correct20.id],
      })
      .expect(400);

    // 3. The contractor submits the outstanding work, with a new evidence version.
    const secondVersion = await addVersion(document, lead, 2);
    const second = await submit(milestone, document.id, [
      correct20.id,
      replace10.id,
    ]);
    expect(second).toMatchObject({
      sequence: 2,
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      previousDecisionId: partialDecision.id,
      addressedItemIds: expect.arrayContaining([correct20.id, replace10.id]),
      evidence: [{ documentVersionId: secondVersion.id, versionNumber: 2 }],
    });

    // 4. The client accepts the 20 corrections; the 10 replacements stay open.
    const secondDecision = (
      await managerApi
        .post(`milestones/${milestone.id}/submissions/${second.id}/decision`, {
          decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
          reason: 'The 10 replacements are not delivered yet.',
          approvedBps: 2000,
          approvedWork: '20 installations corrected',
          acceptedItemIds: [correct20.id],
        })
        .expect(201)
    ).body as DecisionResponse;
    expect(secondDecision).toMatchObject({
      cumulativeApprovedBps: 9000,
      approvedQuantity: 20,
      acceptedItemIds: [correct20.id],
    });

    // 5. Only the replacements are resubmitted, and approved.
    const third = await submit(milestone, document.id, [replace10.id]);
    expect(third.previousDecisionId).toBe(secondDecision.id);
    const approval = (
      await managerApi
        .post(`milestones/${milestone.id}/submissions/${third.id}/decision`, {
          decision: EMilestoneDecisionType.APPROVED,
        })
        .expect(201)
    ).body as DecisionResponse;
    expect(approval).toMatchObject({
      approvedBps: 1000,
      cumulativeApprovedBps: 10000,
      approvedQuantity: 10,
      acceptedItemIds: [replace10.id],
    });

    const done = (await leadApi.get(`milestones/${milestone.id}`).expect(200))
      .body as MilestoneResponse;
    expect(done).toMatchObject({
      status: EMilestoneStatus.APPROVED,
      approvedBps: 10000,
      approvedQuantity: 100,
      approvedById: manager.id,
    });
    expect(done.completedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The whole history stays, with the first evidence at its first version.
    const history = (
      await leadApi.get(`milestones/${milestone.id}/submissions`).expect(200)
    ).body as SubmissionResponse[];
    expect(
      history.map(({ sequence, submissionType, decision }) => [
        sequence,
        submissionType,
        decision?.decision,
      ]),
    ).toEqual([
      [1, 'initial', 'partially_approved'],
      [2, 'outstanding_work', 'partially_approved'],
      [3, 'outstanding_work', 'approved'],
    ]);
    expect(history[0].evidence[0].documentVersionId).toBe(versions[0].id);
    const finalItems = (
      await leadApi
        .get(`milestones/${milestone.id}/outstanding-items`)
        .expect(200)
    ).body as ItemResponse[];
    expect(finalItems).toEqual([
      expect.objectContaining({
        id: correct20.id,
        status: 'accepted',
        acceptedByDecisionId: secondDecision.id,
        addressedBySubmissionIds: [second.id],
      }),
      expect.objectContaining({
        id: replace10.id,
        status: 'accepted',
        acceptedByDecisionId: approval.id,
        addressedBySubmissionIds: [second.id, third.id],
      }),
    ]);
    const decisions = (
      await leadApi.get(`milestones/${milestone.id}/decisions`).expect(200)
    ).body as DecisionResponse[];
    expect(decisions.map(({ id }) => id)).toEqual([
      partialDecision.id,
      secondDecision.id,
      approval.id,
    ]);

    // Stage progress follows the approved milestone: 60% of the stage.
    const stageNow = (await leadApi.get(`stages/${stage.id}`).expect(200))
      .body as StageResponse;
    expect(stageNow.progressBps).toBe(6000);

    // Every step is in the activity log, in the Project workspace, naming the
    // milestone and the acting member of the acting company.
    const entries = await activity();
    expect(entries.map(({ action }) => action)).toEqual([
      'stage.created',
      'milestone.created',
      'milestone.started',
      'milestone.submitted',
      'milestone.evidence_attached',
      'milestone.partially_approved',
      'milestone.resubmitted',
      'milestone.evidence_attached',
      'milestone.partially_approved',
      'milestone.outstanding_items_updated',
      'milestone.resubmitted',
      'milestone.evidence_attached',
      'milestone.approved',
      'milestone.completed',
    ]);
    expect(entries.every(({ workspace }) => workspace === 'project')).toBe(
      true,
    );
    for (const entry of entries.slice(1)) {
      expect(entry).toMatchObject({
        entityType: 'milestone',
        entityId: milestone.id,
      });
    }
    expect(entries[0]).toMatchObject({
      entityType: 'contract_stage',
      entityId: stage.id,
    });
    const partialEntry = entries[5];
    expect(partialEntry).toMatchObject({
      actorUserId: manager.id,
      companyId: client.id,
      reason:
        '30 units did not meet the agreed installation and quality requirements.',
    });
    expect(partialEntry.metadata).toMatchObject({
      submissionId: first.id,
      decisionId: partialDecision.id,
    });
    expect(entries[3]).toMatchObject({
      actorUserId: lead.id,
      companyId: contractor.id,
    });
  });

  it('keeps a rejection and its reason, and links the resubmission to it', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const first = await submit(milestone, document.id);
    const managerApi = await as(manager);

    await managerApi
      .post(`milestones/${milestone.id}/submissions/${first.id}/decision`, {
        decision: EMilestoneDecisionType.REJECTED,
      })
      .expect(400);
    const rejection = (
      await managerApi
        .post(`milestones/${milestone.id}/submissions/${first.id}/decision`, {
          decision: EMilestoneDecisionType.REJECTED,
          reason: 'Photographs do not show the poles.',
        })
        .expect(201)
    ).body as DecisionResponse;

    const leadApi = await as(lead);
    const rejected = (
      await leadApi.get(`milestones/${milestone.id}`).expect(200)
    ).body as MilestoneResponse;
    expect(rejected).toMatchObject({
      status: EMilestoneStatus.REJECTED,
      rejectionReason: 'Photographs do not show the poles.',
      approvedBps: 0,
    });

    const second = await submit(milestone, document.id);
    expect(second).toMatchObject({
      sequence: 2,
      submissionType: EMilestoneSubmissionType.RESUBMISSION,
      previousDecisionId: rejection.id,
    });
    const history = (
      await leadApi.get(`milestones/${milestone.id}/submissions`).expect(200)
    ).body as SubmissionResponse[];
    expect(history[0]).toMatchObject({
      id: first.id,
      evidence: [expect.objectContaining({ documentId: document.id })],
      decision: expect.objectContaining({
        decision: 'rejected',
        reason: 'Photographs do not show the poles.',
      }),
    });
    expect(history[1].decision).toBeNull();
  });

  // --- Authorization -----------------------------------------------------------

  it('lets only the Client Project Manager plan, and only the Contractor Project Lead submit', async () => {
    const stage = await createStage(2000);
    const milestone = await createStreetlights(stage);
    const newStage = {
      name: 'Other',
      weightBps: 100,
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-02-01',
    };

    // Project readers who aren't the Client Project Manager can't plan.
    for (const member of [engineer, lead, supervisor]) {
      await (await as(member)).post('stages', newStage).expect(403);
      await (
        await as(member)
      )
        .patch(`milestones/${milestone.id}`, { title: 'Renamed' })
        .expect(403);
    }
    // Without a Project role: refused (403), even as a Company Administrator.
    await (await as(clientAdmin)).post('stages', newStage).expect(403);
    await (await as(financeOfficer)).get('milestones').expect(403);
    await (await as(clientAdmin)).get('milestones').expect(403);
    // Another company can't reach the contract at all.
    await (await as(outsiderAdmin)).get('milestones').expect(404);
    await (await as(outsiderAdmin)).post('stages', newStage).expect(404);
    // A header naming another company is refused before anything is read.
    await (await as(lead)).get('milestones', client.id).expect(403);

    // Every Project role on either side can read.
    for (const member of [manager, engineer, lead, supervisor]) {
      const list = await (await as(member)).get('milestones').expect(200);
      expect(list.body.data).toHaveLength(1);
    }

    // The client can't submit for the contractor, nor start its work.
    const { document } = await evidenceDocument(manager);
    await (
      await as(manager)
    )
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'On their behalf',
        evidence: [{ documentId: document.id }],
      })
      .expect(403);
    await (
      await as(manager)
    )
      .post(`milestones/${milestone.id}/start`)
      .expect(403);
    await (
      await as(supervisor)
    )
      .post(`milestones/${milestone.id}/start`)
      .expect(403);
  });

  it('never lets the contractor decide on its own submission', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const submission = await submit(milestone, document.id);
    const approve = { decision: EMilestoneDecisionType.APPROVED };

    for (const member of [lead, supervisor, engineer]) {
      await (
        await as(member)
      )
        .post(
          `milestones/${milestone.id}/submissions/${submission.id}/decision`,
          approve,
        )
        .expect(403);
    }
    expect(
      await dataSource
        .getRepository(MilestoneDecision)
        .countBy({ submissionId: submission.id }),
    ).toBe(0);
    const stillPending = await dataSource
      .getRepository(Milestone)
      .findOneByOrFail({ id: milestone.id });
    expect(stillPending.status).toBe(EMilestoneStatus.PENDING_APPROVAL);
  });

  it('accepts as evidence only shared, Project-readable documents the contractor uploaded to this contract', async () => {
    const milestone = await createStreetlights(await createStage());
    const leadApi = await as(lead);
    const tryEvidence = (documentId: string) =>
      leadApi.post(`milestones/${milestone.id}/submissions`, {
        notes: 'Evidence',
        evidence: [{ documentId }],
      });

    const clientOwned = await evidenceDocument(manager);
    await tryEvidence(clientOwned.document.id).expect(400);
    const privateDoc = await evidenceDocument(lead, {
      visibility: EDocumentVisibility.PRIVATE,
    });
    await tryEvidence(privateDoc.document.id).expect(400);
    const hseDoc = await evidenceDocument(lead, {
      category: EDocumentCategory.HSE,
    });
    await tryEvidence(hseDoc.document.id).expect(400);
    const otherContract = await factory.createAdditionalContract(contractor);
    const elsewhere = await evidenceDocument(lead, {
      onContract: otherContract,
    });
    await tryEvidence(elsewhere.document.id).expect(400);
    const unfinished = await evidenceDocument(lead, { versions: 0 });
    await tryEvidence(unfinished.document.id).expect(400);
    await leadApi
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'None',
        evidence: [],
      })
      .expect(400);

    expect(
      await dataSource
        .getRepository(MilestoneSubmission)
        .countBy({ milestoneId: milestone.id }),
    ).toBe(0);
  });

  // --- Integrity -----------------------------------------------------------------

  it('decides a submission once, even when two decisions race', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const submission = await submit(milestone, document.id);
    const managerApi = await as(manager);
    const path = `milestones/${milestone.id}/submissions/${submission.id}/decision`;

    const results = await Promise.all([
      managerApi.post(path, { decision: EMilestoneDecisionType.APPROVED }),
      managerApi.post(path, { decision: EMilestoneDecisionType.APPROVED }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await dataSource
        .getRepository(MilestoneDecision)
        .countBy({ submissionId: submission.id }),
    ).toBe(1);
    // A later decision on the same submission is refused too, and an approved
    // milestone takes no further submissions.
    await managerApi
      .post(path, { decision: EMilestoneDecisionType.REJECTED, reason: 'Late' })
      .expect(409);
    await (
      await as(lead)
    )
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'Again',
        evidence: [{ documentId: document.id }],
      })
      .expect(409);
  });

  it('rolls the whole decision back when its activity entry fails', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const submission = await submit(milestone, document.id);
    const removeTrigger = await installPostgresFailureTrigger(dataSource, {
      table: 'activity_log',
      contractId: contract.id,
      marker: 'milestone.approved',
      column: 'action',
    });
    try {
      await (
        await as(manager)
      )
        .post(
          `milestones/${milestone.id}/submissions/${submission.id}/decision`,
          {
            decision: EMilestoneDecisionType.APPROVED,
          },
        )
        .expect(500);
    } finally {
      await removeTrigger();
    }

    expect(
      await dataSource
        .getRepository(MilestoneDecision)
        .countBy({ submissionId: submission.id }),
    ).toBe(0);
    const unchanged = await dataSource
      .getRepository(Milestone)
      .findOneByOrFail({ id: milestone.id });
    expect(unchanged).toMatchObject({
      status: EMilestoneStatus.PENDING_APPROVAL,
      approvedBps: 0,
      approvedById: null,
    });
    const actions = (await activity()).map(({ action }) => action);
    expect(actions).not.toContain('milestone.approved');
    expect(actions).not.toContain('milestone.completed');
  });

  // --- Stages --------------------------------------------------------------------

  it('moves a stage through its statuses, with reasons, and completes it only when its milestones are approved', async () => {
    const stage = await createStage();
    const milestone = await createStreetlights(stage);
    const managerApi = await as(manager);
    const move = (body: object) =>
      managerApi.post(`stages/${stage.id}/transitions`, body);

    await move({ status: EStatus.COMPLETED }).expect(409);
    await move({
      status: EStatus.IN_PROGRESS,
      effectiveDate: '2026-01-05',
    }).expect(200);
    await move({ status: EStatus.ON_HOLD }).expect(400);
    const held = await move({
      status: EStatus.ON_HOLD,
      reason: 'Permit suspended.',
    }).expect(200);
    expect(held.body).toMatchObject({
      status: 'on_hold',
      actualStartDate: '2026-01-05',
    });

    // Work can't be submitted while the stage is on hold.
    const { document } = await evidenceDocument(lead);
    await (
      await as(lead)
    )
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'Done',
        evidence: [{ documentId: document.id }],
      })
      .expect(409);

    await move({
      status: EStatus.IN_PROGRESS,
      reason: 'Permit renewed.',
    }).expect(200);
    await move({ status: EStatus.COMPLETED }).expect(409);

    const submission = await submit(milestone, document.id);
    await managerApi
      .post(
        `milestones/${milestone.id}/submissions/${submission.id}/decision`,
        {
          decision: EMilestoneDecisionType.APPROVED,
        },
      )
      .expect(201);
    const completed = await move({
      status: EStatus.COMPLETED,
      effectiveDate: '2026-06-30',
    }).expect(200);
    expect(completed.body).toMatchObject({
      status: 'completed',
      actualEndDate: '2026-06-30',
      progressBps: 6000,
    });

    const stageEntries = (await activity()).filter(
      ({ entityType }) => entityType === 'contract_stage',
    );
    expect(stageEntries.map(({ action, reason }) => [action, reason])).toEqual([
      ['stage.created', null],
      ['stage.status_changed', null],
      ['stage.status_changed', 'Permit suspended.'],
      ['stage.status_changed', 'Permit renewed.'],
      ['stage.completed', null],
    ]);
  });

  it('keeps stage and milestone weights within 100%, and fixes the scope once work is submitted', async () => {
    const stage = await createStage(8000);
    const managerApi = await as(manager);
    await managerApi
      .post('stages', {
        name: 'Too heavy',
        weightBps: 3000,
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-02-01',
      })
      .expect(400);
    const milestone = await createStreetlights(stage);
    await managerApi
      .post(`stages/${stage.id}/milestones`, {
        title: 'Too heavy',
        weightBps: 5000,
        dueDate: '2027-06-30',
        isPaymentMilestone: false,
      })
      .expect(400);

    const { document } = await evidenceDocument(lead);
    await submit(milestone, document.id);
    await managerApi
      .patch(`milestones/${milestone.id}`, { targetQuantity: 120 })
      .expect(409);
    const moved = await managerApi
      .patch(`milestones/${milestone.id}`, { revisedDueDate: '2027-07-31' })
      .expect(200);
    expect(moved.body).toMatchObject({ revisedDueDate: '2027-07-31' });
    const update = (await activity()).find(
      ({ action }) => action === 'milestone.updated',
    );
    expect(update?.changes).toEqual({
      before: { revisedDueDate: null },
      after: { revisedDueDate: '2027-07-31' },
    });
  });

  // --- Rules added after review ------------------------------------------------

  it('keeps milestone history immutable in the database itself', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const first = await submit(milestone, document.id);
    const decision = (
      await (
        await as(manager)
      )
        .post(`milestones/${milestone.id}/submissions/${first.id}/decision`, {
          decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
          reason: 'Not all units pass.',
          approvedBps: 7000,
          approvedWork: '70 units',
          approvedQuantity: 70,
          outstandingItems: [{ description: '30 units', quantity: 30 }],
        })
        .expect(201)
    ).body as DecisionResponse;

    for (const [table, id] of [
      ['milestone_submission', first.id],
      ['milestone_decision', decision.id],
    ] as const) {
      await expect(
        dataSource.query(
          `UPDATE "${table}" SET "updated_at" = now() WHERE "id" = $1`,
          [id],
        ),
      ).rejects.toThrow(/append-only/);
    }
    await expect(
      dataSource.query(
        'UPDATE "milestone_submission_evidence" SET "caption" = $1 WHERE "submission_id" = $2',
        ['Changed', first.id],
      ),
    ).rejects.toThrow(/append-only/);

    // An outstanding item can't be rewritten, and is accepted only once.
    const [item] = await dataSource
      .getRepository(MilestoneOutstandingItem)
      .findBy({ milestoneId: milestone.id });
    await expect(
      dataSource.query(
        'UPDATE "milestone_outstanding_item" SET "description" = $1 WHERE "id" = $2',
        ['Rewritten', item.id],
      ),
    ).rejects.toThrow(/only be accepted, once/);
    const second = await submit(milestone, document.id, [item.id]);
    const approval = (
      await (
        await as(manager)
      )
        .post(`milestones/${milestone.id}/submissions/${second.id}/decision`, {
          decision: EMilestoneDecisionType.APPROVED,
        })
        .expect(201)
    ).body as DecisionResponse;
    await expect(
      dataSource.query(
        'UPDATE "milestone_outstanding_item" SET "accepted_by_decision_id" = $1 WHERE "id" = $2',
        [decision.id, item.id],
      ),
    ).rejects.toThrow(/only be accepted, once/);
    const accepted = await dataSource
      .getRepository(MilestoneOutstandingItem)
      .findOneByOrFail({ id: item.id });
    expect(accepted.acceptedByDecisionId).toBe(approval.id);
  });

  it('refuses to start twice, or to submit while a submission waits for review', async () => {
    const milestone = await createStreetlights(await createStage());
    const leadApi = await as(lead);
    await leadApi.post(`milestones/${milestone.id}/start`).expect(200);
    await leadApi.post(`milestones/${milestone.id}/start`).expect(409);

    const { document } = await evidenceDocument(lead);
    await submit(milestone, document.id);
    await leadApi
      .post(`milestones/${milestone.id}/submissions`, {
        notes: 'Again',
        evidence: [{ documentId: document.id }],
      })
      .expect(409);
    expect(
      await dataSource
        .getRepository(MilestoneSubmission)
        .countBy({ milestoneId: milestone.id }),
    ).toBe(1);
  });

  it('shows milestone activity only to readers holding a Project role', async () => {
    const stage = await createStage();
    await createStreetlights(stage);
    // A client member whose only role is in the HSE workspace.
    await factory.createAdditionalWorkspace(contract, manager, 'hse');
    const hseManager = await factory.createAdditionalMember(client);
    await grant(clientParty, hseManager, EClientContractRole.HSE_MANAGER);

    const forManager = await activityFeed.listForContract(
      manager.userId,
      client.id,
      contract.id,
      { page: 1, limit: 50 },
    );
    expect(forManager.data.map(({ action }) => action)).toEqual([
      'milestone.created',
      'stage.created',
    ]);
    expect(
      forManager.data.every(({ workspace }) => workspace === 'project'),
    ).toBe(true);

    const forHse = await activityFeed.listForContract(
      hseManager.userId,
      client.id,
      contract.id,
      { page: 1, limit: 50 },
    );
    expect(forHse.data).toEqual([]);
    expect(forHse.meta.totalItems).toBe(0);
  });

  it('creates a milestone only within a stage of the contract, named by the path', async () => {
    const managerApi = await as(manager);
    const body = {
      title: 'Orphan',
      weightBps: 100,
      dueDate: '2027-06-30',
      isPaymentMilestone: false,
    };
    // A stage of another contract is "not found" here.
    const otherContract = await factory.createAdditionalContract(client);
    const stages = dataSource.getRepository(ContractStage);
    const foreignStage = await stages.save(
      stages.create({
        contractId: otherContract.id,
        name: 'Elsewhere',
        description: null,
        sequence: 1,
        status: EStatus.PLANNED,
        weightBps: 100,
        plannedStartDate: '2027-01-01',
        plannedEndDate: '2027-02-01',
        actualStartDate: null,
        actualEndDate: null,
      }),
    );
    await managerApi
      .post(`stages/${foreignStage.id}/milestones`, body)
      .expect(404);
    // The old body field is not accepted as a way to choose the stage.
    await managerApi
      .post('milestones', { ...body, contractStageId: foreignStage.id })
      .expect(404);
  });

  // --- Submission date filter --------------------------------------------------

  it('filters milestones by when they were submitted, from the submission history', async () => {
    const stage = await createStage();
    const managerApi = await as(manager);
    const leadApi = await as(lead);
    const create = async (title: string, dueDate: string) =>
      (
        await managerApi
          .post(`stages/${stage.id}/milestones`, {
            title,
            weightBps: 1000,
            dueDate,
            isPaymentMilestone: false,
          })
          .expect(201)
      ).body as MilestoneResponse;
    // Due dates sort the list: B, then A, then C.
    const a = await create('A', '2027-05-01');
    const b = await create('B', '2027-04-01');
    const c = await create('C', '2027-06-01');
    const { document } = await evidenceDocument(lead);
    const pause = () => new Promise((resolve) => setTimeout(resolve, 25));

    const firstA = await submit(a, document.id);
    await pause();
    const firstB = await submit(b, document.id);
    await pause();
    // A is rejected and resubmitted: its history now has two submissions.
    await managerApi
      .post(`milestones/${a.id}/submissions/${firstA.id}/decision`, {
        decision: EMilestoneDecisionType.REJECTED,
        reason: 'Missing photographs.',
      })
      .expect(201);
    const secondA = await submit(a, document.id);
    const t1 = firstA.submittedAt;
    const t2 = firstB.submittedAt;
    const t3 = secondA.submittedAt;
    expect(t1 < t2 && t2 < t3).toBe(true);

    const list = async (query: Record<string, string | number>) =>
      (
        await leadApi
          .get(
            `milestones?${new URLSearchParams(Object.entries(query).map(([k, v]): [string, string] => [k, String(v)]))}`,
          )
          .expect(200)
      ).body as { data: MilestoneResponse[]; meta: { totalItems: number } };
    const titles = (page: { data: MilestoneResponse[] }) =>
      page.data.map(({ title }) => title);

    // Both ends are inclusive, to the millisecond.
    expect(titles(await list({ submittedFrom: t1, submittedTo: t1 }))).toEqual([
      'A',
    ]);
    expect(titles(await list({ submittedFrom: t1, submittedTo: t2 }))).toEqual([
      'B',
      'A',
    ]);
    // A milestone is listed once, though two of its submissions match.
    const all = await list({ submittedFrom: t1, submittedTo: t3 });
    expect(titles(all)).toEqual(['B', 'A']);
    expect(all.meta.totalItems).toBe(2);
    // The resubmission counts: A was submitted after B's only submission.
    expect(titles(await list({ submittedFrom: t3 }))).toEqual(['A']);
    // The never-submitted milestone matches no submission range.
    expect(titles(await list({ submittedTo: t3 }))).not.toContain('C');
    expect(titles(await list({}))).toEqual(['B', 'A', 'C']);
    // Whole UTC days: today's submissions; and a day with none.
    const today = t1.slice(0, 10);
    expect(
      titles(await list({ submittedFrom: today, submittedTo: today })),
    ).toEqual(['B', 'A']);
    expect((await list({ submittedFrom: '2027-01-01' })).data).toEqual([]);
    // Combined with other filters, and paged with a stable order.
    expect(
      titles(await list({ submittedFrom: t1, pendingReview: 'true' })),
    ).toEqual(['B', 'A']);
    const first = await list({ submittedFrom: t1, limit: 1, page: 1 });
    const second = await list({ submittedFrom: t1, limit: 1, page: 2 });
    expect([...titles(first), ...titles(second)]).toEqual(['B', 'A']);
    expect(first.meta.totalItems).toBe(2);
    expect(c.status).toBe(EMilestoneStatus.PLANNED);
  });

  it('refuses malformed and reversed submission date ranges', async () => {
    const leadApi = await as(lead);
    await leadApi
      .get('milestones?submittedFrom=2026-11-10T09:00:00')
      .expect(400);
    await leadApi.get('milestones?submittedFrom=not-a-date').expect(400);
    await leadApi
      .get('milestones?submittedFrom=2026-11-11&submittedTo=2026-11-10')
      .expect(400);
    await leadApi
      .get('milestones?dueFrom=2027-02-01&dueTo=2027-01-01')
      .expect(400);
  });

  it('never lists another contract’s milestones, whatever their submissions', async () => {
    const milestone = await createStreetlights(await createStage());
    const { document } = await evidenceDocument(lead);
    const own = await submit(milestone, document.id);

    // Another contract with a submitted milestone at the same moment.
    const other = await factory.createAdditionalContract(contractor);
    const otherParty = await factory.createAdditionalParty(other, contractor);
    const stages = dataSource.getRepository(ContractStage);
    const otherStage = await stages.save(
      stages.create({
        contractId: other.id,
        name: 'Elsewhere',
        description: null,
        sequence: 1,
        status: EStatus.IN_PROGRESS,
        weightBps: 100,
        plannedStartDate: '2027-01-01',
        plannedEndDate: '2027-02-01',
        actualStartDate: null,
        actualEndDate: null,
      }),
    );
    const milestones = dataSource.getRepository(Milestone);
    const otherMilestone = await milestones.save(
      milestones.create({
        contractId: other.id,
        contractStageId: otherStage.id,
        title: 'Other contract',
        description: null,
        acceptanceCriteria: null,
        deliverables: null,
        sequence: 1,
        status: EMilestoneStatus.PENDING_APPROVAL,
        progressBps: 0,
        approvedBps: 0,
        weightBps: 100,
        targetQuantity: null,
        quantityUnit: null,
        approvedQuantity: null,
        isPaymentMilestone: false,
        amountMinor: null,
        currencyCode: null,
        plannedStartDate: null,
        actualStartDate: null,
        dueDate: '2027-01-01',
        revisedDueDate: null,
        completedDate: null,
        submittedAt: new Date(own.submittedAt),
        submittedById: lead.id,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
      }),
    );
    const submissions = dataSource.getRepository(MilestoneSubmission);
    await submissions.save(
      submissions.create({
        contractId: other.id,
        milestoneId: otherMilestone.id,
        sequence: 1,
        submissionType: EMilestoneSubmissionType.INITIAL,
        previousDecisionId: null,
        submittedById: lead.id,
        submittedByPartyId: otherParty.id,
        submittedAt: new Date(own.submittedAt),
        notes: 'Elsewhere',
        reportedProgressBps: null,
      }),
    );

    const response = (
      await (
        await as(lead)
      )
        .get(
          `milestones?submittedFrom=${encodeURIComponent(own.submittedAt)}&submittedTo=${encodeURIComponent(own.submittedAt)}`,
        )
        .expect(200)
    ).body as { data: MilestoneResponse[]; meta: { totalItems: number } };
    expect(response.data.map(({ id }) => id)).toEqual([milestone.id]);
    expect(response.meta.totalItems).toBe(1);
  });

  // --- Approved rules (22 November 2026) -------------------------------------

  it('allows planning only on a draft contract, and only reads on a suspended or completed one', async () => {
    const stage = await createStage();
    const milestone = await createStreetlights(stage);
    const { document } = await evidenceDocument(lead);
    const managerApi = await as(manager);
    const leadApi = await as(lead);
    const submitBody = {
      notes: 'Done',
      evidence: [{ documentId: document.id }],
    };

    await setContract({ status: EContractStatus.DRAFT });
    await managerApi
      .patch(`milestones/${milestone.id}`, { title: 'Renamed' })
      .expect(200);
    await leadApi.post(`milestones/${milestone.id}/start`).expect(409);
    const draft = await leadApi
      .post(`milestones/${milestone.id}/submissions`, submitBody)
      .expect(409);
    expect(draft.body.message).toMatch(/still a draft/);
    await managerApi
      .post(`stages/${stage.id}/transitions`, { status: EStatus.IN_PROGRESS })
      .expect(409);

    for (const status of [
      EContractStatus.SUSPENDED,
      EContractStatus.COMPLETED,
    ]) {
      await setContract({ status });
      const refused = await managerApi
        .patch(`milestones/${milestone.id}`, { title: 'Again' })
        .expect(409);
      expect(refused.body.message).toMatch(new RegExp(`is ${status}`));
      await leadApi
        .post(`milestones/${milestone.id}/submissions`, submitBody)
        .expect(409);
      // Reads are unaffected.
      await leadApi.get(`milestones/${milestone.id}`).expect(200);
      await managerApi.get('stages').expect(200);
    }

    await setContract({ status: EContractStatus.ACTIVE });
    await submit(milestone, document.id);
    expect(
      await dataSource
        .getRepository(MilestoneSubmission)
        .countBy({ milestoneId: milestone.id }),
    ).toBe(1);
  });

  it('judges overdue by the contract’s own calendar day', async () => {
    // Pago Pago is UTC-11 and Kiritimati UTC+14: on any day, Kiritimati's date
    // is ahead, so a milestone due "today" in Pago Pago is past due there.
    const dueDay = dayIn('Pacific/Pago_Pago');
    expect(dayIn('Pacific/Kiritimati') > dueDay).toBe(true);
    const stage = (
      await (
        await as(manager)
      )
        .post('stages', {
          name: 'Today',
          weightBps: 1000,
          plannedStartDate: '2026-01-01',
          plannedEndDate: '2027-12-31',
        })
        .expect(201)
    ).body as StageResponse;
    const milestone = (
      await (
        await as(manager)
      )
        .post(`stages/${stage.id}/milestones`, {
          title: 'Due today in Pago Pago',
          weightBps: 1000,
          dueDate: dueDay,
          isPaymentMilestone: false,
        })
        .expect(201)
    ).body as MilestoneResponse;
    const leadApi = await as(lead);

    await setContract({ timezone: 'Pacific/Pago_Pago' });
    expect(
      (await leadApi.get(`milestones/${milestone.id}`).expect(200)).body
        .isOverdue,
    ).toBe(false);
    expect(
      (await leadApi.get('milestones?overdue=true').expect(200)).body.data,
    ).toEqual([]);

    await setContract({ timezone: 'Pacific/Kiritimati' });
    expect(
      (await leadApi.get(`milestones/${milestone.id}`).expect(200)).body
        .isOverdue,
    ).toBe(true);
    expect(
      (await leadApi.get('milestones?overdue=true').expect(200)).body.data.map(
        ({ id }: MilestoneResponse) => id,
      ),
    ).toEqual([milestone.id]);
  });

  it('keeps milestone dates within the stage unless the Client Project Manager overrides, with a reason', async () => {
    const managerApi = await as(manager);
    const stage = (
      await managerApi
        .post('stages', {
          name: 'Bounded',
          weightBps: 1000,
          plannedStartDate: '2027-01-01',
          plannedEndDate: '2027-06-30',
        })
        .expect(201)
    ).body as StageResponse;
    const late = {
      title: 'Handover',
      weightBps: 1000,
      dueDate: '2027-08-31',
      isPaymentMilestone: false,
    };
    const refused = await managerApi
      .post(`stages/${stage.id}/milestones`, late)
      .expect(400);
    expect(refused.body.message).toMatch(
      /due date \(2027-08-31\) fall outside/,
    );
    const milestone = (
      await managerApi
        .post(`stages/${stage.id}/milestones`, {
          ...late,
          dateOverrideReason: 'Handover follows the stage.',
        })
        .expect(201)
    ).body as MilestoneResponse;
    const inside = (
      await managerApi
        .post(`stages/${stage.id}/milestones`, {
          title: 'Inside',
          weightBps: 1000,
          plannedStartDate: '2027-02-01',
          dueDate: '2027-05-31',
          isPaymentMilestone: false,
        })
        .expect(201)
    ).body as MilestoneResponse;

    // Moving the stage's end before a milestone's due date needs an override too.
    await managerApi
      .patch(`stages/${stage.id}`, { plannedEndDate: '2027-04-30' })
      .expect(400);
    await managerApi
      .patch(`stages/${stage.id}`, {
        plannedEndDate: '2027-04-30',
        dateOverrideReason: 'Scope split into phase 2.',
      })
      .expect(200);
    // And moving a milestone's dates out of the stage.
    await managerApi
      .patch(`milestones/${inside.id}`, { dueDate: '2027-12-31' })
      .expect(400);

    const entries = (await activity()).filter(({ reason }) => reason);
    expect(
      entries.map(({ action, entityId, reason, metadata }) => ({
        action,
        entityId,
        reason,
        dateOverride: metadata.dateOverride,
      })),
    ).toEqual([
      {
        action: 'milestone.created',
        entityId: milestone.id,
        reason: 'Handover follows the stage.',
        dateOverride: true,
      },
      {
        action: 'stage.updated',
        entityId: stage.id,
        reason: 'Scope split into phase 2.',
        dateOverride: true,
      },
    ]);
  });

  it('moves legacy milestones into the workflow only by an explicit mapping, keeping the original status', async () => {
    const stage = await createStage();
    const milestones = dataSource.getRepository(Milestone);
    const legacy = async (title: string, status: EMilestoneStatus) =>
      milestones.save(
        milestones.create({
          contractId: contract.id,
          contractStageId: stage.id,
          title,
          description: null,
          acceptanceCriteria: null,
          deliverables: null,
          sequence: 90,
          status,
          progressBps: 0,
          approvedBps: status === EMilestoneStatus.APPROVED ? 10000 : 0,
          weightBps: 0,
          targetQuantity: null,
          quantityUnit: null,
          approvedQuantity: null,
          isPaymentMilestone: false,
          amountMinor: null,
          currencyCode: null,
          plannedStartDate: null,
          actualStartDate: null,
          dueDate: '2027-03-31',
          revisedDueDate: null,
          completedDate: null,
          submittedAt: null,
          submittedById: null,
          approvedAt: null,
          approvedById: null,
          rejectionReason: null,
          legacyStatus: null,
        }),
      );
    const atRisk = await legacy('Legacy at risk', EMilestoneStatus.AT_RISK);
    const active = await legacy('Legacy active', EMilestoneStatus.ACTIVE);
    const approved = await legacy('Legacy approved', EMilestoneStatus.APPROVED);
    const leadApi = await as(lead);

    // The workflow can't move them on its own.
    const { document } = await evidenceDocument(lead);
    await leadApi
      .post(`milestones/${atRisk.id}/submissions`, {
        notes: 'Done',
        evidence: [{ documentId: document.id }],
      })
      .expect(409);

    const options = {
      mapping: parseLegacyMapping(['at_risk=in_progress']),
      contractId: contract.id,
    };
    const dryRun = await runLegacyMilestoneTransition(dataSource, {
      ...options,
      apply: false,
    });
    expect(dryRun).toMatchObject({ applied: false, moved: 0 });
    expect(dryRun.changes.map(({ id, from, to }) => [id, from, to])).toEqual([
      [atRisk.id, 'at_risk', 'in_progress'],
    ]);
    expect(dryRun.skipped.map(({ id }) => id)).toEqual([active.id]);
    expect((await milestones.findOneByOrFail({ id: atRisk.id })).status).toBe(
      EMilestoneStatus.AT_RISK,
    );

    const applied = await runLegacyMilestoneTransition(dataSource, {
      ...options,
      apply: true,
    });
    expect(applied).toMatchObject({ applied: true, moved: 1 });
    expect(await milestones.findOneByOrFail({ id: atRisk.id })).toMatchObject({
      status: EMilestoneStatus.IN_PROGRESS,
      legacyStatus: EMilestoneStatus.AT_RISK,
    });
    // Unmapped and approved milestones are untouched.
    expect(await milestones.findOneByOrFail({ id: active.id })).toMatchObject({
      status: EMilestoneStatus.ACTIVE,
      legacyStatus: null,
    });
    expect(await milestones.findOneByOrFail({ id: approved.id })).toMatchObject(
      {
        status: EMilestoneStatus.APPROVED,
        approvedBps: 10000,
        legacyStatus: null,
      },
    );
    // Running it again changes nothing.
    const again = await runLegacyMilestoneTransition(dataSource, {
      ...options,
      apply: true,
    });
    expect(again).toMatchObject({ moved: 0, changes: [] });

    // The moved milestone now continues in the workflow, showing where it came from.
    const shown = (await leadApi.get(`milestones/${atRisk.id}`).expect(200))
      .body as MilestoneResponse;
    expect(shown).toMatchObject({
      status: 'in_progress',
      legacyStatus: 'at_risk',
    });
    await leadApi
      .post(`milestones/${atRisk.id}/submissions`, {
        notes: 'Done',
        evidence: [{ documentId: document.id }],
      })
      .expect(201);
  });
});
