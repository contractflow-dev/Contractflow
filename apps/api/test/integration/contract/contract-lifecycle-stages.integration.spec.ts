import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  EClientContractRole,
  ECompanyRole,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  ELifecycleStageCode,
  EPartyType,
  EStageHistoryEvent,
  EStatus,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import { ContractStageHistory } from '../../../src/modules/delivery/entities/contract-stage-history.entity';
import { ContractStage } from '../../../src/modules/delivery/entities/contract-stage.entity';
import { LifecycleTemplateStage } from '../../../src/modules/delivery/entities/lifecycle-template-stage.entity';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * The contract lifecycle on the real database: a new contract gets the nine
 * stages of the published system lifecycle; only the awarding party's Client
 * Project Manager changes its status; activation needs both signatures and
 * applicable weights of exactly 100%, and completes Contract Award; the
 * defects liability period sits between active and completed.
 */
describe('Contract lifecycle stages (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let lifecycle: ContractLifecycleService;

  let client: Company;
  let clientAdmin: CompanyUser;
  let contractor: Company;
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
  }, 60_000);

  beforeEach(async () => {
    ({ company: client, member: clientAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
    ({ company: contractor } = await factory!.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    ));
  });

  afterEach(async () => {
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
  const createContract = async () => {
    sequence += 1;
    const contract = await lifecycle.create(clientAdmin.userId, client.id, {
      referenceNumber: `LC-${Date.now()}-${sequence}`,
      title: 'Lifecycle contract',
      contractType: EContractType.SERVICE,
      partyType: EPartyType.AWARDING,
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
    } as never);
    created.add(contract.id);
    return contract;
  };
  const stagesOf = (contractId: string) =>
    dataSource!
      .getRepository(ContractStage)
      .find({ where: { contractId }, order: { sequence: 'ASC' } });
  /** Both parties signed, and the client's admin made its Project Manager. */
  const readyToActivate = async (contract: Contract) => {
    const parties = dataSource!.getRepository(ContractParty);
    const clientParty = await parties.findOneByOrFail({
      contractId: contract.id,
      companyId: client.id,
    });
    await factory!.createAdditionalParty(
      contract,
      contractor,
      EPartyType.AWARDED,
    );
    await parties.update({ contractId: contract.id }, { signedAt: new Date() });
    await dataSource!.getRepository(ContractRoleAssignment).save(
      dataSource!.getRepository(ContractRoleAssignment).create({
        contractPartyId: clientParty.id,
        companyUserId: clientAdmin.id,
        companyId: client.id,
        role: EClientContractRole.CLIENT_PROJECT_MANAGER,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: clientAdmin.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
  };
  const transition = (
    contractId: string,
    name: 'activate' | 'practical_completion' | 'complete',
  ) =>
    lifecycle.transition(clientAdmin.userId, client.id, contractId, {
      transition: name,
      reason: `Test ${name}.`,
    });

  it('copies the nine lifecycle stages to a new contract, totalling 100%, with history', async () => {
    const contract = await createContract();

    const stored = await dataSource!
      .getRepository(Contract)
      .findOneByOrFail({ id: contract.id });
    expect(stored.lifecycleTemplateVersionId).toEqual(expect.any(String));
    const stages = await stagesOf(contract.id);
    expect(stages.map(({ stageCode }) => stageCode)).toEqual(
      Object.values(ELifecycleStageCode),
    );
    expect(stages.reduce((sum, stage) => sum + stage.weightBps, 0)).toBe(10000);
    expect(
      stages.every(
        (stage) => stage.status === EStatus.PLANNED && stage.isApplicable,
      ),
    ).toBe(true);
    expect(
      await dataSource!.getRepository(ContractStageHistory).countBy({
        contractId: contract.id,
        eventType: EStageHistoryEvent.INITIALISED,
      }),
    ).toBe(9);
  });

  it('refuses activation without both signatures, or with weights off 100%', async () => {
    const contract = await createContract();
    // No Client Project Manager yet: nobody may change the status.
    await expect(transition(contract.id, 'activate')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await readyToActivate(contract);
    const execution = (await stagesOf(contract.id)).find(
      ({ stageCode }) => stageCode === ELifecycleStageCode.CONTRACT_EXECUTION,
    )!;
    await dataSource!
      .getRepository(ContractStage)
      .update({ id: execution.id }, { weightBps: 3000 });
    await expect(transition(contract.id, 'activate')).rejects.toThrow(
      'they total 95%',
    );
    expect(
      (
        await dataSource!
          .getRepository(Contract)
          .findOneByOrFail({ id: contract.id })
      ).status,
    ).toBe(EContractStatus.DRAFT);
  });

  it('activates, completing Contract Award, then runs through defects liability to completion', async () => {
    const contract = await createContract();
    await readyToActivate(contract);

    await expect(transition(contract.id, 'activate')).resolves.toMatchObject({
      status: EContractStatus.ACTIVE,
    });
    const award = (await stagesOf(contract.id))[0];
    expect(award).toMatchObject({
      stageCode: ELifecycleStageCode.CONTRACT_AWARD,
      status: EStatus.COMPLETED,
    });
    expect(
      await dataSource!.getRepository(ContractStageHistory).findOneBy({
        contractStageId: award.id,
        eventType: EStageHistoryEvent.STATUS_CHANGED,
      }),
    ).toMatchObject({ toStatus: EStatus.COMPLETED });

    await expect(
      transition(contract.id, 'practical_completion'),
    ).resolves.toMatchObject({ status: EContractStatus.DEFECTS_LIABILITY });
    await expect(transition(contract.id, 'complete')).resolves.toMatchObject({
      status: EContractStatus.COMPLETED,
    });
    await expect(transition(contract.id, 'complete')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('keeps stage history and published template stages from being changed', async () => {
    const contract = await createContract();
    const [history] = await dataSource!
      .getRepository(ContractStageHistory)
      .findBy({ contractId: contract.id });
    await expect(
      dataSource!
        .getRepository(ContractStageHistory)
        .update({ id: history.id }, { reason: 'rewritten' }),
    ).rejects.toThrow(/Stage history can't be changed/);

    const [templateStage] = await dataSource!
      .getRepository(LifecycleTemplateStage)
      .find({ take: 1 });
    await expect(
      dataSource!
        .getRepository(LifecycleTemplateStage)
        .update({ id: templateStage.id }, { defaultWeightBps: 1 }),
    ).rejects.toThrow(/published lifecycle template version can't change/);
  });
});
