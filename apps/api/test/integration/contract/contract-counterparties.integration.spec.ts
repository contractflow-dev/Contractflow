import type { DataSource } from 'typeorm';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * The contract list shows each contract's other parties. The query must never
 * name a party of a contract the requesting company is not itself party to,
 * whatever contract IDs it is given, nor the parties of an archived contract.
 */
describe('ContractPartyRepository.findCounterparties (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let parties: ContractPartyRepository;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    parties = new ContractPartyRepository(
      dataSource.getRepository(ContractParty),
    );
  }, 60_000);

  afterEach(async () => {
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  it("names only the other parties to the requesting company's own, unarchived contracts", async () => {
    const { company: mine } = await factory!.createCompanyMember();
    const { company: partner } = await factory!.createCompanyMember();
    const { company: stranger } = await factory!.createCompanyMember();

    // Mine and partner's contract.
    const shared = await factory!.createAdditionalContract(mine);
    await factory!.createAdditionalParty(shared, mine);
    await factory!.createAdditionalParty(shared, partner);
    // A contract between partner and stranger that mine is not party to.
    const foreign = await factory!.createAdditionalContract(partner);
    await factory!.createAdditionalParty(foreign, partner);
    await factory!.createAdditionalParty(foreign, stranger);
    // Mine and stranger's contract, archived.
    const archived = await factory!.createAdditionalContract(mine);
    await factory!.createAdditionalParty(archived, mine);
    await factory!.createAdditionalParty(archived, stranger);
    await dataSource!
      .getRepository(Contract)
      .update({ id: archived.id }, { deletedAt: new Date() });

    const rows = await parties.findCounterparties(mine.id, [
      shared.id,
      foreign.id,
      archived.id,
    ]);

    expect(rows).toEqual([
      {
        contractId: shared.id,
        companyName: partner.name,
        partyType: 'contractor',
      },
    ]);
  });

  it('returns nothing without a company or contract IDs', async () => {
    const { company } = await factory!.createCompanyMember();
    const contract = await factory!.createAdditionalContract(company);
    await factory!.createAdditionalParty(contract, company);

    await expect(parties.findCounterparties(company.id, [])).resolves.toEqual(
      [],
    );
    await expect(
      parties.findCounterparties('  ', [contract.id]),
    ).resolves.toEqual([]);
  });
});
