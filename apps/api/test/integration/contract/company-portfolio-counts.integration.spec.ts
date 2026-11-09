import { ulid } from 'ulid';
import type { DataSource } from 'typeorm';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import type { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const DAY = 86_400_000;
const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/**
 * The Overview's portfolio and department figures, counted in PostgreSQL:
 * only the company's own contracts that are not archived, and never another
 * company's records beyond those shared contracts.
 */
describe('Company portfolio counts (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let repository: ContractPartyRepository;
  const contractIds: string[] = [];

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    repository = new ContractPartyRepository(
      dataSource.getRepository(ContractParty),
    );
  }, 60_000);

  afterEach(async () => {
    // These tables reference contracts without cascading: clear them first.
    for (const table of [
      'invoice',
      'compliance_record',
      'compliance_requirement',
      'hse_incident',
      'contract_site',
      'contract_status_history',
    ]) {
      await dataSource!.query(
        `DELETE FROM "${table}" WHERE contract_id = ANY($1)`,
        [contractIds],
      );
    }
    contractIds.length = 0;
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  const q = (sql: string, params: unknown[]) => dataSource!.query(sql, params);

  async function contract(
    company: Company,
    options: {
      status: string;
      changedDaysAgo: number;
      endInDays?: number;
      archived?: boolean;
    },
  ): Promise<Contract> {
    const created = await factory!.createAdditionalContract(company);
    contractIds.push(created.id);
    await factory!.createAdditionalParty(created, company);
    await q(
      `UPDATE contract SET status = $2, updated_at = $3, end_date = $4,
         deleted_at = $5 WHERE id = $1`,
      [
        created.id,
        options.status,
        new Date(Date.now() - options.changedDaysAgo * DAY),
        isoDate(options.endInDays ?? 300),
        options.archived ? new Date() : null,
      ],
    );
    return created;
  }

  async function complianceRecord(
    contractId: string,
    party: ContractParty,
    verifier: CompanyUser,
    status: string,
  ) {
    const requirement = ulid();
    await q(
      `INSERT INTO compliance_requirement (id, contract_id, name, description,
         category, applies_to_party_type, is_mandatory, frequency, first_due_date)
       VALUES ($1, $2, 'Insurance', '', 'hse', 'contractor', true, 'yearly', now())`,
      [requirement, contractId],
    );
    await q(
      `INSERT INTO compliance_record (id, contract_id, compliance_requirement_id,
         contract_party_id, reference_number, issuing_authority, issue_date,
         expiry_date, covered_amount_minor, currency_code, status, verified_at,
         verified_by_id, remarks)
       VALUES ($1, $2, $3, $4, 'REF', 'Insurer', $5, $6, 0, 'NGN', $7, now(), $8, '')`,
      [
        ulid(),
        contractId,
        requirement,
        party.id,
        isoDate(-400),
        isoDate(-1),
        status,
        verifier.id,
      ],
    );
  }

  async function invoice(
    contractId: string,
    issuer: ContractParty,
    payer: ContractParty,
    member: CompanyUser,
    options: { status: string; dueInDays: number; paid?: boolean },
  ) {
    await q(
      `INSERT INTO invoice (id, contract_id, issued_by_party_id, billed_to_party_id,
         invoice_number, invoice_type, status, issue_date, due_date, period_start,
         period_end, currency_code, gross_amount_minor, adjustments_total_minor,
         net_payable_minor, amount_paid_minor, submitted_at, submitted_by_id,
         certified_at, certified_by_id, rejection_reason)
       VALUES ($1, $2, $3, $4, $5, 'interim', $6, $7, $8, $7, $7, 'NGN', 1000, 0,
         1000, $9, now(), $10, now(), $10, '')`,
      [
        ulid(),
        contractId,
        issuer.id,
        payer.id,
        `INV-${ulid().slice(-8)}`,
        options.status,
        isoDate(-30),
        isoDate(options.dueInDays),
        options.paid ? 1000 : 0,
        member.id,
      ],
    );
  }

  async function incident(
    contractId: string,
    member: CompanyUser,
    status: string,
  ) {
    const site = ulid();
    await q(
      `INSERT INTO contract_site (id, contract_id, name, site_code, address_line1,
         city, state_region, country_code, latitude_e6, longitude_e6, status)
       VALUES ($1, $2, 'Site', $3, '1 Road', 'Lagos', 'Lagos', 'NG', 0, 0, 'active')`,
      [site, contractId, `S-${site.slice(-6)}`],
    );
    await q(
      `INSERT INTO hse_incident (id, contract_id, contract_site_id, reference_number,
         incident_type, severity, status, occurred_at, location_detail, description,
         immediate_action_taken, root_cause, investigation_summary, lost_time_days,
         estimated_cost_minor, currency_code, is_notifiable, authority_notified_at,
         reported_at, reported_by_id, investigated_by_id, closed_at, closed_by_id)
       VALUES ($1, $2, $3, $4, 'accident', 'minor', $5, now(), '', '', '', '', '',
         0, 0, 'NGN', false, now(), now(), $6, $6, now(), $6)`,
      [ulid(), contractId, site, `INC-${site.slice(-6)}`, status, member.id],
    );
  }

  const partyOf = (contractId: string, companyId: string) =>
    dataSource!
      .getRepository(ContractParty)
      .findOneByOrFail({ contractId, companyId });

  const windows = () => ({
    stalledBefore: new Date(Date.now() - 14 * DAY),
    today: isoDate(0),
    expiryLimit: isoDate(30),
    dueLimit: isoDate(30),
  });

  it("counts only the company's own live contracts and their records", async () => {
    const { company: a, member: memberA } =
      await factory!.createCompanyMember();
    const { company: b, member: memberB } =
      await factory!.createCompanyMember();

    // Stalled: active, untouched for 20 days. A counterparty on it is
    // non-compliant, has an open incident, and two unpaid invoices.
    const stalled = await contract(a, { status: 'active', changedDaysAgo: 20 });
    await factory!.createAdditionalParty(stalled, b);
    const [partyA, partyB] = await Promise.all([
      partyOf(stalled.id, a.id),
      partyOf(stalled.id, b.id),
    ]);
    await complianceRecord(stalled.id, partyB, memberA, 'expired');
    await complianceRecord(stalled.id, partyB, memberA, 'valid');
    await incident(stalled.id, memberA, 'open');
    await incident(stalled.id, memberA, 'closed');
    await invoice(stalled.id, partyB, partyA, memberB, {
      status: 'submitted',
      dueInDays: -1,
    });
    await invoice(stalled.id, partyB, partyA, memberB, {
      status: 'approved',
      dueInDays: 10,
    });
    await invoice(stalled.id, partyB, partyA, memberB, {
      status: 'paid',
      dueInDays: -5,
      paid: true,
    });
    await invoice(stalled.id, partyB, partyA, memberB, {
      status: 'cancelled',
      dueInDays: -5,
    });

    // Active and recently updated, but ending within the window.
    await contract(a, { status: 'active', changedDaysAgo: 0, endInDays: 10 });
    // Old update, but its status changed two days ago: not stalled.
    const moved = await contract(a, { status: 'active', changedDaysAgo: 30 });
    await q(
      `INSERT INTO contract_status_history (id, contract_id, from_status, to_status,
         reason, changed_by_id, changed_at)
       VALUES ($1, $2, 'draft', 'active', 'Started', $3, $4)`,
      [ulid(), moved.id, memberA.id, new Date(Date.now() - 2 * DAY)],
    );
    // Suspended: needs attention.
    await contract(a, { status: 'suspended', changedDaysAgo: 1 });
    // Archived: stalled and flagged, yet ignored entirely.
    const archived = await contract(a, {
      status: 'active',
      changedDaysAgo: 40,
      archived: true,
    });
    await factory!.createAdditionalParty(archived, b);
    await complianceRecord(
      archived.id,
      await partyOf(archived.id, b.id),
      memberA,
      'rejected',
    );
    await incident(archived.id, memberA, 'open');

    // Another company's own contract, with every kind of problem.
    const { company: d, member: memberD } =
      await factory!.createCompanyMember();
    const unrelated = await contract(d, {
      status: 'active',
      changedDaysAgo: 50,
    });
    await factory!.createAdditionalParty(unrelated, b);
    const [partyD, partyBd] = await Promise.all([
      partyOf(unrelated.id, d.id),
      partyOf(unrelated.id, b.id),
    ]);
    await complianceRecord(unrelated.id, partyBd, memberD, 'non_compliant');
    await incident(unrelated.id, memberD, 'in_progress');
    await invoice(unrelated.id, partyBd, partyD, memberB, {
      status: 'submitted',
      dueInDays: -3,
    });

    await expect(
      repository.getCompanyPortfolioCounts(a.id, windows()),
    ).resolves.toEqual({
      stalledContractCount: 1,
      nonCompliantContractorCount: 1,
      complianceAttentionCount: 1,
      overduePaymentCount: 1,
      invoicesDueSoonCount: 1,
      openIncidentCount: 1,
      // Stalled, ending soon, and suspended.
      contractsNeedingAttentionCount: 3,
    });

    // Company D sees only its own contract, never A's.
    await expect(
      repository.getCompanyPortfolioCounts(d.id, windows()),
    ).resolves.toEqual({
      stalledContractCount: 1,
      nonCompliantContractorCount: 1,
      complianceAttentionCount: 1,
      overduePaymentCount: 1,
      invoicesDueSoonCount: 0,
      openIncidentCount: 1,
      contractsNeedingAttentionCount: 1,
    });
  });

  it('reads zero for a company with no contracts', async () => {
    const { company } = await factory!.createCompanyMember();
    await expect(
      repository.getCompanyPortfolioCounts(company.id, windows()),
    ).resolves.toEqual({
      stalledContractCount: 0,
      nonCompliantContractorCount: 0,
      complianceAttentionCount: 0,
      overduePaymentCount: 0,
      invoicesDueSoonCount: 0,
      openIncidentCount: 0,
      contractsNeedingAttentionCount: 0,
    });
  });
});
