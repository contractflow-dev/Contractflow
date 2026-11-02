import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { EContractStatus } from '@contractflow/contracts-schema';
import type { DashboardContractRow } from '../interfaces/dashboard-contract-row.interface';

type Scope = IContractScope;
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
