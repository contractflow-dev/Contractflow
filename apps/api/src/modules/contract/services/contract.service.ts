import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  type EContractStatus,
} from '@contractflow/contracts-schema';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyScopeService } from '../../identity/services/company-scope.service';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRepository } from '../repositories/contract.repository';
import {
  ContractStatusHistoryRepository,
  type ContractStatusHistoryFilter,
} from '../repositories/contract-status-history.repository';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import type { AssignableContractWorkspace } from './contract-workspace';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PageQuery {
  page: number;
  limit: number;
}

export interface ListContractsQuery extends PageQuery {
  search?: string;
  status?: EContractStatus;
  includeDeleted?: boolean;
}

export interface ListContractStatusHistoryQuery extends PageQuery {
  fromDate?: string;
  toDate?: string;
  status?: EContractStatus;
  userId?: string;
}

export interface ContractPartySummary {
  id: string;
  companyId: string;
  companyName: string;
  partyType: ContractParty['partyType'];
  signedAt: Date | null;
}

/** Everything a contract-level read needs once membership is proven. */
interface ContractAccess {
  /** For company-scoped repositories (e.g. ContractRepository). */
  companyScope: ICompanyScope;
  /** For contract-scoped repositories (e.g. status history). */
  contractScope: IContractScope;
  /** The acting company's party row on this contract. */
  membership: ContractParty;
}

/**
 * Read access to contracts for the members of a party company.
 *
 * Membership of an active company is verified first, and every query is then
 * bound to that company's `ContractParty` rows. Being a Company Admin or
 * Platform Admin grants no extra contract visibility. Workspace data
 * (finance, HSE, ...) needs its own role-assignment checks in its own module.
 */
@Injectable()
export class ContractService {
  constructor(
    private readonly companyScope: CompanyScopeService,
    private readonly parties: ContractPartyRepository,
    private readonly statusHistory: ContractStatusHistoryRepository,
    private readonly contracts: ContractRepository,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    userId: string,
    companyId: string,
    query: ListContractsQuery,
  ): Promise<Page<Contract>> {
    const scope = await this.companyScope.forUser(userId, companyId);
    if (query.includeDeleted) {
      const membership = await this.dataSource
        .getRepository(CompanyUser)
        .findOne({
          where: {
            userId,
            companyId: scope.companyId,
            status: ECompanyUserStatus.ACTIVE,
            leftAt: IsNull(),
          },
        });
      if (membership?.companyRole !== ECompanyRole.COMPANY_ADMIN) {
        throw new ForbiddenException(
          'Only the creating company administrator can list archived contracts.',
        );
      }
    }
    const result = await this.contracts.searchPage(scope, {
      search: query.search,
      status: query.status,
      includeDeleted: query.includeDeleted,
      creatorCompanyId: query.includeDeleted ? scope.companyId : undefined,
      skip: offset(query),
      take: query.limit,
    });
    return toPage(result, query);
  }

  async get(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{ contract: Contract; membership: ContractParty }> {
    const { companyScope, membership } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );

    const contract = await this.contracts.findById(contractId, companyScope);
    if (!contract) {
      throw contractNotFound();
    }
    return { contract, membership };
  }

  async listParties(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractPartySummary[]> {
    // Membership must be proven first: the query below is NOT company-scoped.
    const { contractScope } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );

    const parties = await this.parties.findAllWithCompany(contractScope);
    return parties.map(toPartySummary);
  }

  async listStatusHistory(
    userId: string,
    companyId: string,
    contractId: string,
    query: ListContractStatusHistoryQuery,
  ) {
    const { contractScope } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );

    if (
      query.fromDate &&
      query.toDate &&
      new Date(query.fromDate).getTime() > new Date(query.toDate).getTime()
    ) {
      throw new BadRequestException(
        'The history start date must not be after the end date.',
      );
    }
    const filter: ContractStatusHistoryFilter = {
      fromDate: query.fromDate,
      toDate: query.toDate
        ? normalizeEndDate(query.toDate)
        : undefined,
      status: query.status,
      userId: query.userId,
      skip: offset(query),
      take: query.limit,
    };
    const result = await this.statusHistory.searchPage(contractScope, filter);
    return {
      ...toPage(result, query),
      items: result.items.map(toHistorySummary),
    };
  }

  async listWorkspaces(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<AssignableContractWorkspace[]> {
    const { contractScope } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );
    const workspaces = await this.dataSource
      .getRepository(ContractWorkspaceEntity)
      .find({
        where: { contractId: contractScope.contractId },
        order: { workspace: 'ASC' },
      });
    return workspaces.map(({ workspace }) => workspace);
  }

  // ---------------------------------------------------------------------
  // Access check (the one place membership is decided)
  // ---------------------------------------------------------------------

  /**
   * Verifies the user is an active member of `companyId`, and that company is
   * a party to `contractId`. The contract-level scope is only built after both
   * checks pass. Not-found covers both "no such contract" and "not your
   * contract", so existence is never leaked.
   */
  private async requireMembership(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractAccess> {
    const companyScope = await this.companyScope.forUser(userId, companyId);
    const contractScope: IContractScope = {
      contractId,
      companyId: companyScope.companyId,
    };
    // The query is the proof: it matches only if THIS company is a party to THIS contract.
    const membership = await this.parties.findByCompany(
      companyScope.companyId,
      contractScope,
    );
    if (!membership) {
      throw contractNotFound();
    }
    const contract = await this.contracts.findById(contractId, companyScope);
    if (!contract) {
      throw contractNotFound();
    }
    return { companyScope, membership, contractScope };
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function contractNotFound(): NotFoundException {
  return new NotFoundException('Contract was not found');
}

function offset(query: PageQuery): number {
  return (query.page - 1) * query.limit;
}

function toPage<T>(
  result: { items: T[]; total: number },
  query: PageQuery,
): Page<T> {
  return {
    items: result.items,
    total: result.total,
    page: query.page,
    limit: query.limit,
  };
}

function toPartySummary(party: ContractParty): ContractPartySummary {
  return {
    id: party.id,
    companyId: party.companyId,
    companyName: party.company.name,
    partyType: party.partyType,
    signedAt: party.signedAt,
  };
}

function normalizeEndDate(value: string): string {
  return value.length === 10
    ? `${value}T23:59:59.999Z`
    : value;
}

function toHistorySummary(history: ContractStatusHistory) {
  return {
    id: history.id,
    contractId: history.contractId,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    reason: history.reason,
    changedById: history.changedById,
    changedAt: history.changedAt,
    changedBy: history.changedBy
      ? {
          userId: history.changedBy.userId,
          firstName: history.changedBy.user?.firstName ?? '',
          lastName: history.changedBy.user?.lastName ?? '',
        }
      : null,
  };
}
