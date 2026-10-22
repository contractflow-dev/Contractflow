import { Injectable, NotFoundException } from '@nestjs/common';
import type { EContractStatus } from '@contractflow/contracts-schema';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyScopeService } from '../../identity/services/company-scope.service';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRepository } from '../repositories/contract.repository';
import { ContractStatusHistoryRepository } from '../repositories/contract-status-history.repository';

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
  ) {}

  async list(
    userId: string,
    companyId: string,
    query: ListContractsQuery,
  ): Promise<Page<Contract>> {
    const scope = await this.companyScope.forUser(userId, companyId);
    const result = await this.contracts.searchPage(scope, {
      search: query.search,
      status: query.status,
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
    query: PageQuery,
  ) {
    const { contractScope } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );

    const result = await this.statusHistory.findPage(contractScope, {
      skip: offset(query),
      take: query.limit,
    });
    return toPage(result, query);
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
