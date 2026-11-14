import { ForbiddenException } from '@nestjs/common';
import {
  ECompanyDepartment,
  ECompanyRole,
  EContractStatus,
  EContractorContractRole,
  EDepartmentBlockerType,
  EFromStatus,
  EPartyType,
  EToStatus,
  type ContractRole,
  type DepartmentContract,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractPartyInvitation } from '../../../src/modules/contract/entities/contract-party-invitation.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../../../src/modules/contract/entities/contract-role-invitation.entity';
import { ContractStatusHistory } from '../../../src/modules/contract/entities/contract-status-history.entity';
import { CompanyDepartmentRepository } from '../../../src/modules/contract/repositories/company-department.repository';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { CompanyDepartmentService } from '../../../src/modules/contract/services/company-department.service';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import {
  CompanyUser as CompanyUserEntity,
  type CompanyUser,
} from '../../../src/modules/identity/entities/company-user.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * The department pages' query against PostgreSQL: one company's own
 * contracts in a workspace, its own people only, and the version 1 blockers
 * from information a Company Administrator may already see.
 */
describe('Company department contracts (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let service: CompanyDepartmentService;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const access = new ContractAccessService(
      new CompanyUserRepository(dataSource.getRepository(CompanyUserEntity)),
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
    service = new CompanyDepartmentService(
      access,
      new CompanyDepartmentRepository(dataSource.manager),
    );
  }, 60_000);

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await factory.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  const NOW = new Date();
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

  async function assign(
    party: ContractParty,
    member: CompanyUser,
    role: ContractRole,
    admin = false,
  ) {
    const repository = dataSource.getRepository(ContractRoleAssignment);
    await repository.save(
      repository.create({
        contractPartyId: party.id,
        companyUserId: member.id,
        companyId: member.companyId,
        role,
        isWorkspaceAdmin: admin,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
  }

  async function setContract(
    contract: Contract,
    values: { status?: EContractStatus; updatedAt?: Date; deleted?: boolean },
  ) {
    await dataSource.query(
      `UPDATE contract
          SET status = COALESCE($2, status),
              updated_at = COALESCE($3, updated_at),
              deleted_at = CASE WHEN $4 THEN now() ELSE deleted_at END
        WHERE id = $1`,
      [
        contract.id,
        values.status ?? null,
        values.updatedAt ?? null,
        values.deleted ?? false,
      ],
    );
  }

  async function partyAs(
    party: ContractParty,
    type: EPartyType,
    signed: boolean,
  ) {
    await dataSource
      .getRepository(ContractParty)
      .update(
        { id: party.id },
        { partyType: type, signedAt: signed ? daysAgo(40) : null },
      );
  }

  /**
   * Company A (the overseer) and company B:
   * - C1: A client (owner), B contractor; HSE on; A's HSE admin and B's
   *   HSE officer; B hasn't signed; no movement for 20 days.
   * - C2: owned by B, A contractor; HSE on; nobody from A; suspended by B.
   * - C3: A party, Finance only (not listed under HSE).
   * - C4: B only, HSE on (never listed for A).
   * - C5: A's archived contract with HSE.
   * - C6: A's draft with HSE, a pending invitation to company O and a
   *   pending role invitation; A's admin holds an HSE role here.
   */
  async function scenario() {
    const {
      company: a,
      actor: adminA,
      target: memberA,
      contract: c1,
      party: a1,
    } = await factory.createRoleAssignmentFixture(); // C1, Finance on
    const hseLead = await factory.createAdditionalMember(a);
    const { company: b, member: adminB } = await factory.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    );
    const memberB = await factory.createAdditionalMember(b);
    const { company: o } = await factory.createCompanyMember();

    await factory.createAdditionalWorkspace(c1, adminA, 'hse');
    await partyAs(a1, EPartyType.CLIENT, true);
    const b1 = await factory.createAdditionalParty(c1, b);
    await partyAs(b1, EPartyType.CONTRACTOR, false);
    await assign(a1, hseLead, EContractorContractRole.HSE_MANAGER, true);
    await assign(b1, memberB, EContractorContractRole.HSE_OFFICER, true);
    await setContract(c1, {
      status: EContractStatus.ACTIVE,
      updatedAt: daysAgo(20),
    });

    const c2 = await factory.createAdditionalContract(b);
    const b2 = await factory.createAdditionalParty(c2, b);
    await partyAs(b2, EPartyType.CLIENT, true);
    const a2 = await factory.createAdditionalParty(c2, a);
    await partyAs(a2, EPartyType.CONTRACTOR, true);
    await factory.createAdditionalWorkspace(c2, adminB, 'hse');
    await dataSource.getRepository(ContractStatusHistory).save(
      dataSource.getRepository(ContractStatusHistory).create({
        contractId: c2.id,
        fromStatus: EFromStatus.ACTIVE,
        toStatus: EToStatus.SUSPENDED,
        reason: 'Flooding',
        changedById: adminB.id,
        changedAt: daysAgo(3),
      }),
    );
    await setContract(c2, { status: EContractStatus.SUSPENDED });

    const c3 = await factory.createAdditionalContract(a);
    await factory.createAdditionalParty(c3, a);
    await factory.createAdditionalWorkspace(c3, adminA, 'finance');

    const c4 = await factory.createAdditionalContract(b);
    const b4 = await factory.createAdditionalParty(c4, b);
    await factory.createAdditionalWorkspace(c4, adminB, 'hse');
    await assign(b4, memberB, EContractorContractRole.HSE_OFFICER);

    const c5 = await factory.createAdditionalContract(a);
    await factory.createAdditionalParty(c5, a);
    await factory.createAdditionalWorkspace(c5, adminA, 'hse');
    await setContract(c5, { deleted: true });

    const c6 = await factory.createAdditionalContract(a);
    const a6 = await factory.createAdditionalParty(c6, a);
    await factory.createAdditionalWorkspace(c6, adminA, 'hse');
    await assign(a6, adminA, EContractorContractRole.HSE_OFFICER, true);
    await dataSource.getRepository(ContractPartyInvitation).save(
      dataSource.getRepository(ContractPartyInvitation).create({
        sourceContractPartyId: a6.id,
        sourceCompanyId: a.id,
        targetCompanyId: o.id,
        invitedByCompanyUserId: adminA.id,
        acceptedByCompanyUserId: null,
        partyType: EPartyType.CONTRACTOR,
        email: `invite-${Date.now()}@example.test`,
        tokenHash: `party-${Date.now()}-${Math.random()}`,
        status: 'pending',
        expiresAt: daysAgo(-5),
        respondedAt: null,
        revokedAt: null,
      }),
    );
    await dataSource.getRepository(ContractRoleInvitation).save(
      dataSource.getRepository(ContractRoleInvitation).create({
        contractPartyId: a6.id,
        companyId: a.id,
        invitedById: adminA.id,
        email: `role-${Date.now()}@example.test`,
        role: EContractorContractRole.HSE_MANAGER,
        workspace: 'hse',
        isWorkspaceAdmin: false,
        tokenHash: `role-${Date.now()}-${Math.random()}`,
        status: 'pending',
        expiresAt: daysAgo(-5),
        respondedAt: null,
        revokedAt: null,
      }),
    );

    return {
      a,
      b,
      o,
      adminA,
      memberA,
      adminB,
      memberB,
      hseLead,
      c1,
      c2,
      c3,
      c4,
      c5,
      c6,
    };
  }

  const list = (
    user: CompanyUser,
    company: Company,
    query: Record<string, unknown> = {},
  ) =>
    service.listContracts(
      user.userId,
      company.id,
      ECompanyDepartment.HSE,
      { page: 1, limit: 50, ...query },
      NOW,
    );

  const byId = (rows: DepartmentContract[], id: string) =>
    rows.find(({ contractId }) => contractId === id)!;

  it("lists only the company's own contracts with the workspace", async () => {
    const s = await scenario();

    const result = await list(s.adminA, s.a);

    expect(result.data.map(({ contractId }) => contractId).sort()).toEqual(
      [s.c1.id, s.c2.id, s.c6.id].sort(),
    );
    expect(result.summary).toEqual({
      contractCount: 3,
      memberCount: 2, // the HSE lead and the admin, nobody from B
      waitingOnMyCompanyCount: 1, // C6, A's own draft
      waitingOnOtherCompaniesCount: 2, // C1 (B's signatory), C2 (suspended by B)
    });
  });

  it("computes each row's party type, people, admin and main blocker", async () => {
    const s = await scenario();
    const rows = (await list(s.adminA, s.a)).data;

    const c1 = byId(rows, s.c1.id);
    expect(c1).toMatchObject({
      partyType: EPartyType.CLIENT,
      memberCount: 1,
      workspaceAdmins: [{ companyUserId: s.hseLead.id }],
      hasWorkspaceRole: false,
      primaryBlocker: {
        type: EDepartmentBlockerType.SIGNATORY_MISSING,
        holder: { companyId: s.b.id, myCompany: false },
      },
      otherBlockerCount: 1, // stalled, held by B too
    });
    expect(c1.daysSinceMovement).toBeGreaterThanOrEqual(20);
    // Nobody from company B is ever listed.
    expect(JSON.stringify(rows)).not.toContain(s.memberB.id);

    const c2 = byId(rows, s.c2.id);
    expect(c2).toMatchObject({
      partyType: EPartyType.CONTRACTOR,
      memberCount: 0,
      workspaceAdmins: [],
      primaryBlocker: {
        type: EDepartmentBlockerType.SUSPENDED,
        holder: { companyId: s.b.id, myCompany: false },
      },
    });
    expect(c2.otherBlockerCount).toBe(1); // nobody from A assigned

    const c6 = byId(rows, s.c6.id);
    expect(c6).toMatchObject({
      status: EContractStatus.DRAFT,
      hasWorkspaceRole: true,
      primaryBlocker: {
        type: EDepartmentBlockerType.DRAFT,
        holder: { companyId: s.a.id, myCompany: true },
      },
      otherBlockerCount: 2, // the invitation to O and the role invitation
    });
  });

  it('shows the archived contract only on request, read-only', async () => {
    const s = await scenario();

    const rows = (await list(s.adminA, s.a, { includeArchived: true })).data;

    expect(byId(rows, s.c5.id)).toMatchObject({
      archived: true,
      primaryBlocker: null,
    });
    // The summary still counts current contracts only.
    expect(
      (await list(s.adminA, s.a, { includeArchived: true })).summary
        .contractCount,
    ).toBe(3);
  });

  it("gives company B's administrator B's view, with B's people only", async () => {
    const s = await scenario();

    const rows = (await list(s.adminB, s.b)).data;

    expect(rows.map(({ contractId }) => contractId).sort()).toEqual(
      [s.c1.id, s.c2.id, s.c4.id].sort(),
    );
    expect(byId(rows, s.c1.id)).toMatchObject({
      partyType: EPartyType.CONTRACTOR,
      memberCount: 1,
      workspaceAdmins: [{ companyUserId: s.memberB.id }],
    });
    expect(JSON.stringify(rows)).not.toContain(s.hseLead.id);
  });

  it('refuses members and other companies', async () => {
    const s = await scenario();

    await expect(list(s.memberA, s.a)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(list(s.adminB, s.a)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
