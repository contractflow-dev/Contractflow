import { EContractSortField, ESortOrder } from '@contractflow/contracts-schema';
import { In, type DataSource } from 'typeorm';
import { toPaginatedResponse } from '../../../src/common/application/pagination';
import { Company } from '../../../src/modules/identity/entities/company.entity';
import { CompanyInvitation } from '../../../src/modules/identity/entities/company-invitation.entity';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { CompanyAdminReadRepository } from '../../../src/modules/identity/repositories/company-admin-read.repository';
import { CompanyInvitationRepository } from '../../../src/modules/identity/repositories/company-invitation.repository';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const tiedTimestamp = new Date('2026-03-01T09:00:00.000Z');

describe('Pagination PostgreSQL integration', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let contracts: ContractRepository;
  let companyReads: CompanyAdminReadRepository;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    contracts = new ContractRepository(dataSource.getRepository(Contract));
    companyReads = new CompanyAdminReadRepository(
      dataSource.getRepository(CompanyUser),
      dataSource.getRepository(Company),
      new CompanyInvitationRepository(
        dataSource.getRepository(CompanyInvitation),
      ),
    );
  }, 60_000);

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    await destroyPostgresTestDatabase();
  }, 60_000);

  /** Five contracts for one company, all created at the same instant. */
  async function companyWithTiedContracts() {
    const { company } = await factory.createCompanyMember();
    const created: Contract[] = [];
    for (let index = 0; index < 5; index += 1) {
      const contract = await factory.createAdditionalContract(company);
      await factory.createAdditionalParty(contract, company);
      created.push(contract);
    }
    await dataSource.getRepository(Contract).update(
      { id: In(created.map(({ id }) => id)) },
      {
        createdAt: tiedTimestamp,
      },
    );
    return { company, ids: created.map(({ id }) => id) };
  }

  it('pages a company scope without overlap, gaps, or other companies', async () => {
    const { company, ids } = await companyWithTiedContracts();
    const other = await companyWithTiedContracts();
    const scope = { companyId: company.id };

    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const query = { page, limit: 2 };
      const result = await contracts.searchPage(scope, {
        skip: (page - 1) * 2,
        take: 2,
      });
      const response = toPaginatedResponse(result, query);
      expect(response.meta).toEqual({
        totalItems: 5,
        itemCount: page === 3 ? 1 : 2,
        itemsPerPage: 2,
        totalPages: 3,
        currentPage: page,
      });
      seen.push(...result.items.map(({ id }) => id));
    }

    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...ids].sort());
    expect(seen.some((id) => other.ids.includes(id))).toBe(false);
  });

  it('keeps tied rows in the same order on repeated requests', async () => {
    const { company } = await companyWithTiedContracts();
    const scope = { companyId: company.id };

    const first = await contracts.searchPage(scope, { skip: 0, take: 5 });
    const second = await contracts.searchPage(scope, { skip: 0, take: 5 });

    expect(second.items.map(({ id }) => id)).toEqual(
      first.items.map(({ id }) => id),
    );
    expect(first.items.map(({ id }) => id)).toEqual(
      first.items.map(({ id }) => id).sort(),
    );
  });

  it('applies allowlisted sorting and filters before counting', async () => {
    const { company, ids } = await companyWithTiedContracts();
    const repository = dataSource.getRepository(Contract);
    for (const [index, id] of ids.entries()) {
      await repository.update({ id }, { title: `Pipeline ${5 - index}` });
    }
    await repository.update({ id: ids[0] }, { title: 'Unrelated works' });
    const scope = { companyId: company.id };

    const result = await contracts.searchPage(scope, {
      search: 'pipeline',
      sortBy: EContractSortField.TITLE,
      sortOrder: ESortOrder.ASC,
      skip: 0,
      take: 2,
    });

    expect(result.total).toBe(4);
    expect(result.items.map(({ title }) => title)).toEqual([
      'Pipeline 1',
      'Pipeline 2',
    ]);
  });

  it('reveals no rows or counts to a company that is not a party', async () => {
    await companyWithTiedContracts();
    const { company: outsider } = await factory.createCompanyMember();

    const result = await contracts.searchPage(
      { companyId: outsider.id },
      { skip: 0, take: 100 },
    );

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('returns an empty page past the end with the true total', async () => {
    const { company } = await companyWithTiedContracts();

    const result = await contracts.searchPage(
      { companyId: company.id },
      { skip: 20, take: 20 },
    );

    expect(result).toEqual({ items: [], total: 5 });
  });

  it('pages company members stably within one company only', async () => {
    const { company, member } = await factory.createCompanyMember();
    const second = await factory.createAdditionalMember(company);
    const third = await factory.createAdditionalMember(company);
    const { company: otherCompany } = await factory.createCompanyMember();
    await factory.createAdditionalMember(otherCompany);
    const memberIds = [member.id, second.id, third.id];
    await dataSource
      .getRepository(CompanyUser)
      .update({ id: In(memberIds) }, { joinedAt: tiedTimestamp });
    const scope = { companyId: company.id };

    const firstPage = await companyReads.listMembers(scope, {
      page: 1,
      limit: 2,
    });
    const secondPage = await companyReads.listMembers(scope, {
      page: 2,
      limit: 2,
    });

    expect(firstPage.total).toBe(3);
    expect(secondPage.total).toBe(3);
    const seen = [...firstPage.items, ...secondPage.items].map(({ id }) => id);
    expect([...seen].sort()).toEqual([...memberIds].sort());
  });
});
