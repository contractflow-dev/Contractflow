import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { EContractStatus } from '@contractflow/contracts-schema';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';

export interface ContractSearch {
  search?: string;
  status?: EContractStatus;
  includeDeleted?: boolean;
  creatorCompanyId?: string;
  skip?: number;
  take?: number;
}

/**
 * A contract has no company column: a company sees it through its
 * `ContractParty` row. Reads are therefore limited to contracts the scoped
 * company is party to. The generic find/write methods are disabled because
 * they would not apply that restriction and so could expose other companies'
 * contracts.
 */
@Injectable()
export class ContractRepository extends BaseRepository<
  Contract,
  ICompanyScope
> {
  constructor(
    @InjectRepository(Contract) repository: Repository<Contract>,
  ) {
    super(repository);
  }

  protected override applyScope(
    qb: SelectQueryBuilder<Contract>,
    scope: ICompanyScope,
  ): void {
    const companyId = scope?.companyId?.trim();
    if (!companyId) {
      throw new ForbiddenException('Company context is required');
    }
    const partyQuery = qb
      .subQuery()
      .select('1')
      .from(ContractParty, 'scope_party')
      .where(`scope_party.contractId = ${qb.alias}.id`)
      .andWhere('scope_party.companyId = :__scopeCompanyId')
      .getQuery();
    qb.andWhere(`EXISTS ${partyQuery}`, { __scopeCompanyId: companyId });
  }

  override async findById(
    id: string,
    scope: ICompanyScope,
  ): Promise<Contract | null> {
    return this.scopedQuery(scope, 'contract')
      .andWhere('contract.deletedAt IS NULL')
      .andWhere('contract.id = :id', { id })
      .getOne();
  }

  async searchPage(
    scope: ICompanyScope,
    options: ContractSearch = {},
  ): Promise<{ items: Contract[]; total: number }> {
    const qb = this.scopedQuery(scope, 'contract');

    if (options.includeDeleted) {
      if (!options.creatorCompanyId?.trim()) {
        throw new ForbiddenException(
          'Creator company context is required to list archived contracts',
        );
      }
      qb.andWhere('contract.deletedAt IS NOT NULL');
      qb.andWhere('contract.createdByCompanyId = :creatorCompanyId', {
        creatorCompanyId: options.creatorCompanyId,
      });
    } else {
      qb.andWhere('contract.deletedAt IS NULL');
    }

    if (options.status) {
      qb.andWhere('contract.status = :status', { status: options.status });
    }
    if (options.search) {
      const escaped = options.search.replace(/[\\%_]/g, '\\$&');
      qb.andWhere(
        '(contract.title ILIKE :search OR contract.referenceNumber ILIKE :search)',
        { search: `%${escaped}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('contract.createdAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .skip(options.skip)
      .take(options.take)
      .getManyAndCount();
    return { items, total };
  }

  override findOne(): Promise<Contract | null> {
    return this.unsupported();
  }

  override findAll(): Promise<Contract[]> {
    return this.unsupported();
  }

  override findPage(): Promise<{ items: Contract[]; total: number }> {
    return this.unsupported();
  }

  override save(): Promise<Contract> {
    return this.unsupported();
  }

  override update(): Promise<Contract> {
    return this.unsupported();
  }

  override delete(): Promise<void> {
    return this.unsupported();
  }

  private unsupported(): never {
    throw new ForbiddenException(
      'Contracts can only be read through findById and searchPage',
    );
  }
}
