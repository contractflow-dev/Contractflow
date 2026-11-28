import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EClientContractRole,
  ECompanyRole,
  EContractStatus,
  EContractType,
  EContractorContractRole,
  ECurrencyCode,
  EPartyType,
  type ContractRole,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractPartyInvitation } from '../../../src/modules/contract/entities/contract-party-invitation.entity';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractStatusHistory } from '../../../src/modules/contract/entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractStatusHistoryRepository } from '../../../src/modules/contract/repositories/contract-status-history.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import { ContractService } from '../../../src/modules/contract/services/contract.service';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { CompanyUser as CompanyUserEntity } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Subcontracting, with the real services, unit of work and database:
 *
 * - Main contract: the client (AWARDING) and the contractor (AWARDED), and
 *   no one else.
 * - Each subcontract: the contractor (AWARDING) and one subcontractor
 *   (AWARDED), a separate child contract of the main contract.
 * - The contractor's Contractor Project Lead on the main contract creates
 *   subcontracts and invites their subcontractors; administrator rights
 *   alone don't. The client has no part in, or view of, any subcontract,
 *   and a subcontractor has none of the main contract.
 */
describe('Subcontracts (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let lifecycle: ContractLifecycleService;
  let contracts: ContractService;

  let client: Company;
  let clientAdmin: CompanyUser;
  let contractor: Company;
  let contractorAdmin: CompanyUser;
  let contractorLead: CompanyUser;
  let subcontractor: Company;
  let subcontractorAdmin: CompanyUser;
  let otherSubcontractor: Company;
  let otherSubcontractorAdmin: CompanyUser;
  let main: Contract;
  let contractorParty: ContractParty;
  const created = new Set<string>();

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    lifecycle = new ContractLifecycleService(
      new TypeOrmUnitOfWork(dataSource, new ContractLifecycleContextFactory()),
      {
        sendContractPartyInvitationEmail: async () => undefined,
      } as unknown as MailService,
    );
    const companyUsers = new CompanyUserRepository(
      dataSource.getRepository(CompanyUserEntity),
    );
    const parties = new ContractPartyRepository(
      dataSource.getRepository(ContractParty),
    );
    const roleAssignments = new ContractRoleAssignmentRepository(
      dataSource.getRepository(ContractRoleAssignment),
    );
    const contractRepository = new ContractRepository(
      dataSource.getRepository(Contract),
    );
    const workspaces = new ContractWorkspaceRepository(
      dataSource.getRepository(ContractWorkspaceEntity),
      dataSource.getRepository(ContractParty),
    );
    contracts = new ContractService(
      new CompanyScopeService(companyUsers),
      parties,
      new ContractStatusHistoryRepository(
        dataSource.getRepository(ContractStatusHistory),
      ),
      contractRepository,
      companyUsers,
      workspaces,
      roleAssignments,
      new ContractAccessService(
        companyUsers,
        parties,
        roleAssignments,
        contractRepository,
        workspaces,
      ),
    );
  }, 60_000);

  const assign = (
    party: ContractParty,
    member: CompanyUser,
    role: ContractRole,
  ) =>
    dataSource!.getRepository(ContractRoleAssignment).save(
      dataSource!.getRepository(ContractRoleAssignment).create({
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

  beforeEach(async () => {
    ({ company: client, member: clientAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
    ({ company: contractor, member: contractorAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
    contractorLead = await factory!.createAdditionalMember(contractor);
    ({ company: subcontractor, member: subcontractorAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
    ({ company: otherSubcontractor, member: otherSubcontractorAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));

    main = await factory!.createAdditionalContract(client);
    await dataSource!
      .getRepository(Contract)
      .update({ id: main.id }, { status: EContractStatus.ACTIVE });
    const clientParty = await factory!.createAdditionalParty(
      main,
      client,
      EPartyType.AWARDING,
    );
    await assign(
      clientParty,
      clientAdmin,
      EClientContractRole.CLIENT_PROJECT_MANAGER,
    );
    contractorParty = await factory!.createAdditionalParty(
      main,
      contractor,
      EPartyType.AWARDED,
    );
    await assign(
      contractorParty,
      contractorLead,
      EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    );
  });

  afterEach(async () => {
    // Subcontracts the service created go before their main contract.
    for (const id of created) {
      await dataSource!.getRepository(Contract).delete({ id });
    }
    created.clear();
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  let sequence = 0;
  const createSubcontract = async (
    member: CompanyUser,
    overrides: Record<string, unknown> = {},
  ) => {
    sequence += 1;
    const subcontract = await lifecycle.create(
      member.userId,
      member.companyId,
      {
        referenceNumber: `SUB-${Date.now()}-${sequence}`,
        title: 'Piling works',
        contractType: EContractType.SERVICE,
        partyType: EPartyType.AWARDING,
        parentContractId: main.id,
        workspaces: ['project'],
        originalValueMinor: '1000',
        currencyCode: ECurrencyCode.NGN,
        retentionRateBps: 500,
        paymentTermsDays: 30,
        awardDate: '2026-01-01',
        startDate: '2026-01-02',
        endDate: '2026-12-31',
        defectsLiabilityDays: 365,
        timezone: 'Africa/Lagos',
        ...overrides,
      } as never,
    );
    created.add(subcontract.id);
    return subcontract;
  };
  const partiesOf = (contractId: string) =>
    dataSource!.getRepository(ContractParty).find({ where: { contractId } });
  const partyOf = (contractId: string, company: Company) =>
    dataSource!
      .getRepository(ContractParty)
      .findOneByOrFail({ contractId, companyId: company.id });
  const inviteAs = (member: CompanyUser, contractId: string, target: Company) =>
    lifecycle.inviteCompany(member.userId, member.companyId, contractId, {
      email: target.email,
      partyType: EPartyType.AWARDED,
    });
  const accept = (admin: CompanyUser, invitationId: string) =>
    lifecycle.respondToIncomingInvitation(
      admin.userId,
      admin.companyId,
      invitationId,
      'accept',
    );

  describe('the main contract is between the client and the contractor only', () => {
    it('refuses a second awarding or awarded party', async () => {
      const parties = dataSource!.getRepository(ContractParty);
      await expect(
        factory!.createAdditionalParty(main, subcontractor, EPartyType.AWARDED),
      ).rejects.toThrow(/uq_contract_party_one_awarded/);
      await expect(
        factory!.createAdditionalParty(
          main,
          subcontractor,
          EPartyType.AWARDING,
        ),
      ).rejects.toThrow(/uq_contract_party_one_awarding/);
      // No company is both parties of one contract.
      await expect(
        parties.update(
          { id: contractorParty.id },
          { partyType: EPartyType.AWARDING },
        ),
      ).rejects.toThrow(/uq_contract_party_one_awarding/);
      expect(
        (await partiesOf(main.id)).map(({ companyId, partyType }) => [
          companyId,
          partyType,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [client.id, EPartyType.AWARDING],
          [contractor.id, EPartyType.AWARDED],
        ]),
      );
    });

    it('lets the client invite no one once the contractor is its awarded party', async () => {
      await expect(
        inviteAs(clientAdmin, main.id, subcontractor),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('creating a subcontract', () => {
    it('lets the contractor’s Project Lead create it, and makes them its lead', async () => {
      const subcontract = await createSubcontract(contractorLead);

      const stored = await dataSource!
        .getRepository(Contract)
        .findOneByOrFail({ id: subcontract.id });
      expect(stored).toMatchObject({
        parentContractId: main.id,
        createdByCompanyId: contractor.id,
        status: EContractStatus.DRAFT,
      });
      // The contractor awards it; the client is not a party to it.
      expect(
        (await partiesOf(subcontract.id)).map(({ companyId, partyType }) => [
          companyId,
          partyType,
        ]),
      ).toEqual([[contractor.id, EPartyType.AWARDING]]);
      const ownParty = await partyOf(subcontract.id, contractor);
      expect(
        await dataSource!.getRepository(ContractRoleAssignment).findOneBy({
          contractPartyId: ownParty.id,
          companyUserId: contractorLead.id,
          role: EClientContractRole.CLIENT_PROJECT_MANAGER,
        }),
      ).toMatchObject({ revokedAt: null, isWorkspaceAdmin: false });
    });

    it('lets one contractor hold several subcontracts of the same main contract', async () => {
      const first = await createSubcontract(contractorLead);
      const second = await createSubcontract(contractorLead);
      const children = await dataSource!
        .getRepository(Contract)
        .findBy({ parentContractId: main.id });
      expect(children.map(({ id }) => id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    });

    it('refuses the contractor’s administrator without the Project Lead role', async () => {
      await expect(createSubcontract(contractorAdmin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses the client, an unrelated company, a nested subcontract and an inactive parent', async () => {
      await expect(createSubcontract(clientAdmin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        createSubcontract(subcontractorAdmin),
      ).rejects.toBeInstanceOf(NotFoundException);

      const subcontract = await createSubcontract(contractorLead);
      await expect(
        createSubcontract(contractorLead, { parentContractId: subcontract.id }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await dataSource!
        .getRepository(Contract)
        .update({ id: main.id }, { status: EContractStatus.SUSPENDED });
      await expect(createSubcontract(contractorLead)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuses a subcontract the contractor wouldn’t award', async () => {
      await expect(
        createSubcontract(contractorLead, { partyType: EPartyType.AWARDED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('the database keeps the relationship sound', () => {
    it('refuses a self-parent, a nested subcontract and a changed parent', async () => {
      const subcontract = await createSubcontract(contractorLead);
      const rows = dataSource!.getRepository(Contract);

      await expect(
        rows.update({ id: main.id }, { parentContractId: main.id }),
      ).rejects.toThrow(/ck_contract_not_own_parent|cannot be changed/);
      await expect(
        rows.update({ id: subcontract.id }, { parentContractId: null }),
      ).rejects.toThrow(/cannot be changed/);
      await expect(
        factory!.createAdditionalContract(contractor, {
          parentContractId: subcontract.id,
        }),
      ).rejects.toThrow(/parent must be a main contract/);
    });

    it('keeps the client off a subcontract, and makes the contractor its awarding party', async () => {
      const subcontract = await createSubcontract(contractorLead);
      await expect(
        factory!.createAdditionalParty(subcontract, client, EPartyType.AWARDED),
      ).rejects.toThrow(/awarding party cannot be a party to its subcontract/);

      // A subcontract created directly, awarded by someone other than the
      // main contract's awarded party.
      const stray = await factory!.createAdditionalContract(subcontractor, {
        parentContractId: main.id,
      });
      await expect(
        factory!.createAdditionalParty(
          stray,
          subcontractor,
          EPartyType.AWARDING,
        ),
      ).rejects.toThrow(/must be the main contract's awarded party/);
    });

    it('keeps a main contract with subcontracts from being deleted', async () => {
      await createSubcontract(contractorLead);
      await expect(
        dataSource!.getRepository(Contract).delete({ id: main.id }),
      ).rejects.toThrow(/foreign key/);
    });

    it('refuses a parent change through the API, keeping the parent', async () => {
      const subcontract = await createSubcontract(contractorLead);
      await expect(
        lifecycle.update(
          contractorAdmin.userId,
          contractor.id,
          subcontract.id,
          {
            parentContractId: null,
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('inviting the subcontractor', () => {
    let subcontract: Contract;

    beforeEach(async () => {
      subcontract = await createSubcontract(contractorLead);
    });

    it('lets the Project Lead invite, and the subcontractor join once, as awarded party', async () => {
      const invitation = await inviteAs(
        contractorLead,
        subcontract.id,
        subcontractor,
      );
      expect(invitation).toMatchObject({
        partyType: EPartyType.AWARDED,
        status: 'pending',
      });

      await expect(accept(subcontractorAdmin, invitation.id)).resolves.toEqual({
        status: 'accepted',
      });
      // Answering again creates nothing more.
      await expect(
        accept(subcontractorAdmin, invitation.id),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        (await partiesOf(subcontract.id))
          .map(({ companyId, partyType }) => [companyId, partyType])
          .sort(),
      ).toEqual(
        [
          [contractor.id, EPartyType.AWARDING],
          [subcontractor.id, EPartyType.AWARDED],
        ].sort(),
      );
      // The subcontractor is not made a party to the main contract.
      expect(
        await dataSource!
          .getRepository(ContractParty)
          .findOneBy({ contractId: main.id, companyId: subcontractor.id }),
      ).toBeNull();
    });

    it('admits one subcontractor per subcontract', async () => {
      const first = await inviteAs(
        contractorLead,
        subcontract.id,
        subcontractor,
      );
      const second = await inviteAs(
        contractorLead,
        subcontract.id,
        otherSubcontractor,
      );
      await accept(subcontractorAdmin, first.id);

      await expect(
        accept(otherSubcontractorAdmin, second.id),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        inviteAs(contractorLead, subcontract.id, otherSubcontractor),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await partiesOf(subcontract.id)).toHaveLength(2);
    });

    it('refuses an expired or revoked invitation', async () => {
      const expired = await inviteAs(
        contractorLead,
        subcontract.id,
        subcontractor,
      );
      await dataSource!
        .getRepository(ContractPartyInvitation)
        .update({ id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });
      await expect(
        accept(subcontractorAdmin, expired.id),
      ).rejects.toBeInstanceOf(ConflictException);

      const revoked = await inviteAs(
        contractorLead,
        subcontract.id,
        subcontractor,
      );
      await lifecycle.revokeCompanyInvitation(
        contractorLead.userId,
        contractor.id,
        subcontract.id,
        revoked.id,
      );
      await expect(
        accept(subcontractorAdmin, revoked.id),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await partiesOf(subcontract.id)).toHaveLength(1);
    });

    it('refuses the client, the contractor’s administrator and a lead whose role was revoked', async () => {
      // The client isn't a party to the subcontract.
      await expect(
        inviteAs(clientAdmin, subcontract.id, subcontractor),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        inviteAs(contractorAdmin, subcontract.id, subcontractor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // The contractor can't put the client onto the subcontract either.
      await expect(
        inviteAs(contractorLead, subcontract.id, client),
      ).rejects.toBeInstanceOf(BadRequestException);

      await dataSource!.getRepository(ContractRoleAssignment).update(
        {
          contractPartyId: contractorParty.id,
          companyUserId: contractorLead.id,
        },
        { revokedAt: new Date(), revokedById: contractorAdmin.id },
      );
      await expect(
        inviteAs(contractorLead, subcontract.id, subcontractor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a subcontractor inviting itself into the main contract', async () => {
      const invitation = await inviteAs(
        contractorLead,
        subcontract.id,
        subcontractor,
      );
      await accept(subcontractorAdmin, invitation.id);
      await expect(
        inviteAs(subcontractorAdmin, main.id, subcontractor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports who may create and invite', async () => {
      await expect(
        lifecycle.managementPermissions(
          contractorLead.userId,
          contractor.id,
          main.id,
        ),
      ).resolves.toMatchObject({ canCreateSubcontract: true });
      await expect(
        lifecycle.managementPermissions(clientAdmin.userId, client.id, main.id),
      ).resolves.toMatchObject({ canCreateSubcontract: false });
      await expect(
        lifecycle.managementPermissions(
          contractorLead.userId,
          contractor.id,
          subcontract.id,
        ),
      ).resolves.toMatchObject({
        canInviteParties: true,
        invitesSubcontractors: true,
        canCreateSubcontract: false,
      });
      await expect(
        lifecycle.managementPermissions(
          contractorAdmin.userId,
          contractor.id,
          subcontract.id,
        ),
      ).resolves.toMatchObject({ canInviteParties: false });
    });
  });

  describe('the client and each subcontractor see only their own contracts', () => {
    let subcontract: Contract;
    let otherSubcontract: Contract;

    beforeEach(async () => {
      subcontract = await createSubcontract(contractorLead);
      otherSubcontract = await createSubcontract(contractorLead);
      await accept(
        subcontractorAdmin,
        (await inviteAs(contractorLead, subcontract.id, subcontractor)).id,
      );
      await accept(
        otherSubcontractorAdmin,
        (
          await inviteAs(
            contractorLead,
            otherSubcontract.id,
            otherSubcontractor,
          )
        ).id,
      );
    });

    it('denies the client a guessed subcontract id', async () => {
      await expect(
        contracts.get(clientAdmin.userId, client.id, subcontract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        contracts.listParties(clientAdmin.userId, client.id, subcontract.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        lifecycle.managementPermissions(
          clientAdmin.userId,
          client.id,
          subcontract.id,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('shows the client no subcontracts, in the main contract or the list', async () => {
      const detail = await contracts.get(
        clientAdmin.userId,
        client.id,
        main.id,
      );
      expect(detail.subcontracts).toEqual([]);
      const list = await contracts.list(clientAdmin.userId, client.id, {
        page: 1,
        limit: 100,
      } as never);
      expect(list.data.map(({ id }) => id)).toEqual([main.id]);
    });

    it('shows the contractor its subcontracts on the main contract', async () => {
      const detail = await contracts.get(
        contractorLead.userId,
        contractor.id,
        main.id,
      );
      expect(detail.subcontracts.map(({ id }) => id).sort()).toEqual(
        [subcontract.id, otherSubcontract.id].sort(),
      );
    });

    it('opens to a subcontractor its own subcontract only, naming no main contract', async () => {
      const own = await contracts.get(
        subcontractorAdmin.userId,
        subcontractor.id,
        subcontract.id,
      );
      expect(own.contract.parentContractId).toBe(main.id);
      expect(own.parentContract).toBeNull();

      await expect(
        contracts.get(subcontractorAdmin.userId, subcontractor.id, main.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        contracts.get(
          subcontractorAdmin.userId,
          subcontractor.id,
          otherSubcontract.id,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      const list = await contracts.list(
        subcontractorAdmin.userId,
        subcontractor.id,
        { page: 1, limit: 100 } as never,
      );
      expect(list.data.map(({ id }) => id)).toEqual([subcontract.id]);
      expect(list.data[0].parentContract).toBeNull();
    });

    it('names the main contractor’s role when refusing a status change on a subcontract', async () => {
      await expect(
        lifecycle.transition(
          contractorAdmin.userId,
          contractor.id,
          subcontract.id,
          { transition: 'activate', reason: 'Not my role.' },
        ),
      ).rejects.toThrow(
        'Only the awarding party’s Main Contractor Project Manager can change the contract’s status.',
      );
    });

    it('keeps the main contract’s records its own: a subcontract changes nothing on it', async () => {
      // Both parties of the subcontract have signed (activation needs it).
      await dataSource!
        .getRepository(ContractParty)
        .update({ contractId: subcontract.id }, { signedAt: new Date() });
      await lifecycle.transition(
        contractorLead.userId,
        contractor.id,
        subcontract.id,
        { transition: 'activate', reason: 'Subcontract signed.' },
      );
      await lifecycle.transition(
        contractorLead.userId,
        contractor.id,
        subcontract.id,
        { transition: 'complete', reason: 'Piling finished.' },
      );
      expect(
        await dataSource!
          .getRepository(Contract)
          .findOneByOrFail({ id: main.id }),
      ).toMatchObject({ status: EContractStatus.ACTIVE });
      expect(
        await dataSource!
          .getRepository(ContractStatusHistory)
          .countBy({ contractId: main.id }),
      ).toBe(0);
    });

    it('keeps a subcontract and its link when the main contract is archived', async () => {
      await lifecycle.archive(clientAdmin.userId, client.id, main.id);
      expect(
        await dataSource!
          .getRepository(Contract)
          .findOneByOrFail({ id: subcontract.id }),
      ).toMatchObject({ parentContractId: main.id, deletedAt: null });
      await expect(createSubcontract(contractorLead)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
