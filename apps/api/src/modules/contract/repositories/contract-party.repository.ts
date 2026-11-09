import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { EContractStatus } from '@contractflow/contracts-schema';
import type { DashboardContractRow } from '../interfaces/dashboard-contract-row.interface';

type Scope = IContractScope;
const PORTFOLIO_COLUMNS = {
  stalled: true,
  non_compliant_contractors: true,
  compliance_attention: true,
  overdue_payments: true,
  invoices_due_soon: true,
  open_incidents: true,
  needing_attention: true,
} as const;

export interface CompanyPortfolioCounts {
  stalledContractCount: number;
  nonCompliantContractorCount: number;
  complianceAttentionCount: number;
  overduePaymentCount: number;
  invoicesDueSoonCount: number;
  openIncidentCount: number;
  contractsNeedingAttentionCount: number;
}

@Injectable()
export class ContractPartyRepository extends ContractScopedRepository<ContractParty> {
  constructor(
    @InjectRepository(ContractParty) repository: Repository<ContractParty>,
  ) {
    super(repository);
  }

  findByType(partyType: ContractParty['partyType'], scope: Scope) {
    return this.findAll(scope, {
      where: { partyType } as FindOptionsWhere<ContractParty>,
    });
  }

  /** The row that links a company to this contract (used by access checks). */
  findByCompany(scope: Scope, companyId: string) {
    return this.findOne(scope, {
      where: { companyId } as FindOptionsWhere<ContractParty>,
    });
  }

  findAwarding(scope: Scope) {
    return this.findOne(scope, {
      where: { partyType: 'client' } as FindOptionsWhere<ContractParty>,
    });
  }

  findAwarded(scope: Scope) {
    return this.findOne(scope, {
      where: { partyType: 'contractor' } as FindOptionsWhere<ContractParty>,
    });
  }

  /** True once every party has signed (drives PENDING_SIGNATURE -> ACTIVE). */
  async allSigned(scope: Scope): Promise<boolean> {
    const r = await this.scopedQuery(scope)
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(e.signedAt)', 'signed')
      .getRawOne<{ total: string; signed: string }>();
    return Number(r?.total) > 0 && r?.total === r?.signed;
  }

  /** Every party to the contract, with the company loaded, oldest first. */
  findAllWithCompany(scope: Scope) {
    return this.findAll(scope, {
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * The other parties to each of the given contracts, with company names, for
   * the contract list. A row is returned only when `companyId` is itself a
   * party to that contract and the contract is not archived, so passing a
   * contract ID never reveals a contract the company cannot already open
   * (the same rule as `GET /contract/parties`).
   */
  async findCounterparties(
    companyId: string,
    contractIds: string[],
  ): Promise<
    { contractId: string; companyName: string; partyType: ContractParty['partyType'] }[]
  > {
    if (!companyId.trim() || contractIds.length === 0) {
      return [];
    }
    const rows = await this.repository
      .createQueryBuilder('party')
      .innerJoin('party.company', 'company')
      .innerJoin('party.contract', 'contract')
      .where('party.contractId IN (:...contractIds)', { contractIds })
      .andWhere('party.companyId <> :companyId', { companyId })
      .andWhere('contract.deletedAt IS NULL')
      .andWhere(
        `EXISTS (SELECT 1 FROM contract_party own
          WHERE own.contract_id = party.contract_id
            AND own.company_id = :companyId)`,
      )
      .select('party.contractId', 'contractId')
      .addSelect('company.name', 'companyName')
      .addSelect('party.partyType', 'partyType')
      .orderBy('party.createdAt', 'ASC')
      .addOrderBy('party.id', 'ASC')
      .getRawMany<{
        contractId: string;
        companyName: string;
        partyType: ContractParty['partyType'];
      }>();
    return rows;
  }

  async countActiveContracts(companyId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .select('COUNT(DISTINCT contract.id)', 'count')
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  async countCompanyContracts(
    companyId: string,
    status?: EContractStatus,
  ): Promise<number> {
    const query = this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .select('COUNT(DISTINCT contract.id)', 'count');
    if (status) {
      query.andWhere('contract.status = :status', { status });
    }
    const result = await query.getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  /**
   * Portfolio and department figures for one company's dashboard. Every
   * figure is limited to contracts the company is a party to that are not
   * archived ("own"); invoice figures also require the company to be the
   * issuer or the payer. Read-only counts, so no other company's records are
   * returned, only how many of them match.
   */
  async getCompanyPortfolioCounts(
    companyId: string,
    window: {
      /** Changes before this instant leave an active contract stalled. */
      stalledBefore: Date;
      /** Calendar dates, YYYY-MM-DD. */
      today: string;
      expiryLimit: string;
      dueLimit: string;
    },
  ): Promise<CompanyPortfolioCounts> {
    const [row] = (await this.repository.query(
      `WITH own AS (
         SELECT c.id, c.status, c.updated_at, c.end_date, c.revised_end_date
         FROM contract c
         WHERE c.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM contract_party p
                       WHERE p.contract_id = c.id AND p.company_id = $1)
       ),
       stalled AS (
         SELECT o.id FROM own o
         WHERE o.status = 'active'
           AND o.updated_at < $2
           AND NOT EXISTS (SELECT 1 FROM contract_status_history h
                           WHERE h.contract_id = o.id AND h.changed_at >= $2)
           AND NOT EXISTS (SELECT 1 FROM milestone m
                           WHERE m.contract_id = o.id AND m.updated_at >= $2)
       ),
       flagged_records AS (
         SELECT r.id, r.status, p.company_id
         FROM compliance_record r
         JOIN own o ON o.id = r.contract_id
         JOIN contract_party p ON p.id = r.contract_party_id
         WHERE p.party_type IN ('contractor', 'subcontractor')
       ),
       open_invoices AS (
         SELECT v.due_date
         FROM invoice v
         JOIN own o ON o.id = v.contract_id
         JOIN contract_party issuer ON issuer.id = v.issued_by_party_id
         JOIN contract_party payer ON payer.id = v.billed_to_party_id
         WHERE (issuer.company_id = $1 OR payer.company_id = $1)
           AND v.status NOT IN ('draft', 'rejected', 'paid', 'cancelled', 'void')
           AND v.amount_paid_minor < v.net_payable_minor
       )
       SELECT
         (SELECT COUNT(*) FROM stalled) AS stalled,
         (SELECT COUNT(DISTINCT company_id) FROM flagged_records
            WHERE company_id <> $1
              AND status IN ('expired', 'rejected', 'non_compliant')) AS non_compliant_contractors,
         (SELECT COUNT(*) FROM flagged_records
            WHERE status IN ('expired', 'rejected', 'non_compliant', 'renewal_due')) AS compliance_attention,
         (SELECT COUNT(*) FROM open_invoices WHERE due_date < $3) AS overdue_payments,
         (SELECT COUNT(*) FROM open_invoices
            WHERE due_date BETWEEN $3 AND $5) AS invoices_due_soon,
         (SELECT COUNT(*) FROM hse_incident i JOIN own o ON o.id = i.contract_id
            WHERE i.status IN ('open', 'in_progress')) AS open_incidents,
         (SELECT COUNT(*) FROM own o
            WHERE o.status = 'suspended'
               OR o.id IN (SELECT id FROM stalled)
               OR (o.status = 'active'
                   AND COALESCE(o.revised_end_date, o.end_date) BETWEEN $3 AND $4)
         ) AS needing_attention`,
      [
        companyId,
        window.stalledBefore,
        window.today,
        window.expiryLimit,
        window.dueLimit,
      ],
    )) as Array<Record<keyof typeof PORTFOLIO_COLUMNS, string>>;
    const count = (key: keyof typeof PORTFOLIO_COLUMNS) =>
      Number(row?.[key] ?? 0);
    return {
      stalledContractCount: count('stalled'),
      nonCompliantContractorCount: count('non_compliant_contractors'),
      complianceAttentionCount: count('compliance_attention'),
      overduePaymentCount: count('overdue_payments'),
      invoicesDueSoonCount: count('invoices_due_soon'),
      openIncidentCount: count('open_incidents'),
      contractsNeedingAttentionCount: count('needing_attention'),
    };
  }

  async countExpiringCompanyContracts(
    companyId: string,
    today: string,
    expiryLimit: string,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :today AND :expiryLimit',
        { today, expiryLimit },
      )
      .select('COUNT(DISTINCT contract.id)', 'count')
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  async findExpiringCompanyContracts(
    companyId: string,
    today: string,
    expiryLimit: string,
    limit: number,
  ): Promise<DashboardContractRow[]> {
    return this.findDashboardContracts(companyId)
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :today AND :expiryLimit',
        { today, expiryLimit },
      )
      .orderBy('COALESCE(contract.revisedEndDate, contract.endDate)', 'ASC')
      .addOrderBy('contract.id', 'ASC')
      .take(limit)
      .getRawMany<DashboardContractRow>();
  }

  async findRecentlyUpdatedCompanyContracts(
    companyId: string,
    updatedSince: Date,
    limit: number,
  ): Promise<DashboardContractRow[]> {
    return this.findDashboardContracts(companyId)
      .andWhere('contract.updatedAt >= :updatedSince', { updatedSince })
      .orderBy('contract.updatedAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .take(limit)
      .getRawMany<DashboardContractRow>();
  }

  async countExpiringContracts(
    companyId: string,
    days: number,
  ): Promise<number> {
    return this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        `COALESCE(contract.revisedEndDate, contract.endDate)
          BETWEEN CURRENT_DATE
          AND CURRENT_DATE + (:days * INTERVAL '1 day')`,
        { days },
      )
      .select('COUNT(DISTINCT contract.id)', 'count')
      .getRawOne<{ count: string }>()
      .then((result) => Number(result?.count ?? 0));
  }

  async findExpiringContracts(
    companyId: string,
    days: number,
    limit = 5,
  ): Promise<DashboardContractRow[]> {
    return this.findContracts(companyId)
      .andWhere('contract.status = :status', {
        status: EContractStatus.ACTIVE,
      })
      .andWhere(
        `COALESCE(contract.revisedEndDate, contract.endDate)
          BETWEEN CURRENT_DATE
          AND CURRENT_DATE + (:days * INTERVAL '1 day')`,
        { days },
      )
      .orderBy('COALESCE(contract.revisedEndDate, contract.endDate)', 'ASC')
      .limit(limit)
      .getRawMany();
  }

  async findRecentContracts(
    companyId: string,
    limit = 5,
  ): Promise<DashboardContractRow[]> {
    return this.findContracts(companyId)
      .andWhere("contract.updatedAt >= CURRENT_DATE - INTERVAL '30 days'")
      .orderBy('contract.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  private findContracts(companyId: string) {
    return this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .select([
        'contract.id AS id',
        'contract.referenceNumber AS "referenceNumber"',
        'contract.title AS title',
        'contract.status AS status',
        'contract.endDate AS "endDate"',
        'contract.updatedAt AS "updatedAt"',
      ])
      .distinct(true);
  }

  private findDashboardContracts(companyId: string) {
    return this.repository
      .createQueryBuilder('party')
      .innerJoin('party.contract', 'contract')
      .where('party.companyId = :companyId', { companyId })
      .select([
        'contract.id AS id',
        'contract.referenceNumber AS "referenceNumber"',
        'contract.title AS title',
        'contract.status AS status',
        'COALESCE(contract.revisedEndDate, contract.endDate) AS "endDate"',
        'contract.updatedAt AS "updatedAt"',
      ])
      .distinct(true);
  }
}
