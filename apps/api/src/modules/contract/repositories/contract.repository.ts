import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractSortField,
  ESortOrder,
  type EContractStatus,
} from '@contractflow/contracts-schema';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';

export interface ContractSearch {
  search?: string;
  status?: EContractStatus;
  includeDeleted?: boolean;
  creatorCompanyId?: string;
  /**
   * Only contracts this member of the scoped company holds an active role
   * assignment on. Narrows the company's contracts; never widens them.
   */
  assignedToCompanyUserId?: string;
  sortBy?: EContractSortField;
  sortOrder?: ESortOrder;
  skip?: number;
  take?: number;
}

/** Allowlisted `sortBy` values mapped to columns; never interpolate input. */
const SORT_COLUMNS: Record<EContractSortField, string> = {
  [EContractSortField.CREATED_AT]: 'contract.createdAt',
  [EContractSortField.REFERENCE_NUMBER]: 'contract.referenceNumber',
  [EContractSortField.TITLE]: 'contract.title',
  [EContractSortField.STATUS]: 'contract.status',
  [EContractSortField.START_DATE]: 'contract.startDate',
  [EContractSortField.END_DATE]: 'contract.endDate',
};

/**
 * Who is reading contracts, built only from a verified membership (never from
 * client input). Visibility is decided in SQL on every read, from the reader's
 * own `COMPANY_USER` row:
 *
 * - **Individual assignment:** the reader holds an active (unrevoked)
 *   `CONTRACT_ROLE_ASSIGNMENT` on their company's `CONTRACT_PARTY` row.
 * - **Company Administrator oversight:** only when
 *   `includeCompanyAdminOversight` is set, the reader is an active Company
 *   Administrator and their company is a party. This is read-only oversight
 *   for contract discovery, detail, parties and status history. It is never a
 *   workspace or protected-resource grant; `ContractAccessService.authorize`
 *   still requires a role for those.
 *
 * Company membership alone never makes a contract visible.
 */
export interface IContractVisibilityScope extends ICompanyScope {
  /** The reader's own `COMPANY_USER` id in `companyId`. */
  companyUserId: string;
  includeCompanyAdminOversight: boolean;
}

/**
 * A contract has no company column: a company sees it through its
 * `ContractParty` row, and a member sees it only through the visibility rule
 * of `IContractVisibilityScope`. The generic find/write methods are disabled
 * because they would not apply that restriction and so could expose
 * contracts the reader may not see.
 */
@Injectable()
export class ContractRepository extends BaseRepository<
  Contract,
  IContractVisibilityScope
> {
  constructor(@InjectRepository(Contract) repository: Repository<Contract>) {
    super(repository);
  }

  protected override applyScope(
    scope: IContractVisibilityScope,
    qb: SelectQueryBuilder<Contract>,
  ): void {
    const companyId = scope?.companyId?.trim();
    const companyUserId = scope?.companyUserId?.trim();
    if (!companyId || !companyUserId) {
      throw new ForbiddenException('Company context is required');
    }
    // One correlated EXISTS (not a join), so a member holding several roles
    // never multiplies contract rows, counts or pages.
    const assignmentQuery = qb
      .subQuery()
      .select('1')
      .from(ContractRoleAssignment, 'scope_assignment')
      .where('scope_assignment.contractPartyId = scope_party.id')
      .andWhere('scope_assignment.companyUserId = scope_member.id')
      .andWhere('scope_assignment.companyId = :__scopeCompanyId')
      .andWhere('scope_assignment.revokedAt IS NULL')
      .getQuery();
    const visibility = scope.includeCompanyAdminOversight
      ? `(EXISTS ${assignmentQuery} OR scope_member.companyRole = :__scopeAdminRole)`
      : `EXISTS ${assignmentQuery}`;
    const visibleQuery = qb
      .subQuery()
      .select('1')
      .from(ContractParty, 'scope_party')
      .innerJoin(
        CompanyUser,
        'scope_member',
        'scope_member.companyId = scope_party.companyId',
      )
      .where(`scope_party.contractId = ${qb.alias}.id`)
      .andWhere('scope_party.companyId = :__scopeCompanyId')
      .andWhere('scope_member.id = :__scopeCompanyUserId')
      .andWhere('scope_member.status = :__scopeMemberStatus')
      .andWhere('scope_member.leftAt IS NULL')
      .andWhere(visibility)
      .getQuery();
    qb.andWhere(`EXISTS ${visibleQuery}`, {
      __scopeCompanyId: companyId,
      __scopeCompanyUserId: companyUserId,
      __scopeMemberStatus: ECompanyUserStatus.ACTIVE,
      ...(scope.includeCompanyAdminOversight
        ? { __scopeAdminRole: ECompanyRole.COMPANY_ADMIN }
        : {}),
    });
  }

  override async findById(
    scope: IContractVisibilityScope,
    id: string,
  ): Promise<Contract | null> {
    return this.scopedQuery(scope, 'contract')
      .andWhere('contract.deletedAt IS NULL')
      .andWhere('contract.id = :id', { id })
      .getOne();
  }

  /** Like findById, but an archived (soft-deleted) contract is returned too. */
  findByIdIncludingArchived(
    scope: IContractVisibilityScope,
    id: string,
  ): Promise<Contract | null> {
    return this.scopedQuery(scope, 'contract')
      .andWhere('contract.id = :id', { id })
      .getOne();
  }

  async searchPage(
    scope: IContractVisibilityScope,
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
    if (options.assignedToCompanyUserId) {
      const assignment = qb
        .subQuery()
        .select('1')
        .from(ContractRoleAssignment, 'mine')
        .innerJoin(ContractParty, 'mine_party', 'mine_party.id = mine.contractPartyId')
        .where('mine_party.contractId = contract.id')
        .andWhere('mine.companyUserId = :assignedCompanyUserId')
        .andWhere('mine.companyId = :assignedCompanyId')
        .andWhere('mine.revokedAt IS NULL')
        .getQuery();
      qb.andWhere(`EXISTS ${assignment}`, {
        assignedCompanyUserId: options.assignedToCompanyUserId,
        assignedCompanyId: scope.companyId,
      });
    }
    if (options.search) {
      const escaped = options.search.replace(/[\\%_]/g, '\\$&');
      qb.andWhere(
        '(contract.title ILIKE :search OR contract.referenceNumber ILIKE :search)',
        { search: `%${escaped}%` },
      );
    }

    const sortColumn =
      SORT_COLUMNS[options.sortBy ?? EContractSortField.CREATED_AT];
    const sortOrder =
      options.sortOrder === ESortOrder.ASC ? ESortOrder.ASC : ESortOrder.DESC;
    // `id` is unique, so equal sort values keep a stable order across pages.
    const [items, total] = await qb
      .orderBy(sortColumn, sortOrder)
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
