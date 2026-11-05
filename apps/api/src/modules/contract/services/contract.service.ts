import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ECompanyRole } from '@contractflow/contracts-schema';
import type {
  Contract as ContractApiResponse,
  ContractDetail,
  ContractMembership,
  IPaginatedResponse,
} from '@contractflow/contracts-schema';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { CompanyScopeService } from '../../identity/services/company/company-scope.service';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRepository } from '../repositories/contract.repository';
import {
  ContractStatusHistoryRepository,
  type ContractStatusHistoryFilter,
} from '../repositories/contract-status-history.repository';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { ContractWorkspaceRepository } from '../repositories/contract-workspace.repository';
import type { AssignableContractWorkspace } from './contract-workspace';
import type {
  ContractPartySummary,
  ListContractStatusHistoryQuery,
  ListContractsQuery,
} from '../interfaces/contract-listing.interface';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';

/** Everything a contract-level read needs once membership is proven. */
interface ContractAccess {
  /** For contract-scoped repositories (e.g. status history). */
  contractScope: IContractScope;
  /** The acting company's party row on this contract. */
  membership: ContractParty;
  /** The visible, non-archived contract. */
  contract: Contract;
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
    private readonly companyUsers: CompanyUserRepository,
    private readonly workspaces: ContractWorkspaceRepository,
  ) {}

  async list(
    userId: string,
    companyId: string,
    query: ListContractsQuery,
  ): Promise<IPaginatedResponse<ContractApiResponse>> {
    const scope = await this.companyScope.forUser(userId, companyId);
    if (query.includeDeleted) {
      const companyRole = await this.companyUsers.findActiveRoleForUser(
        userId,
        scope.companyId,
      );
      if (companyRole !== ECompanyRole.COMPANY_ADMIN) {
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
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      skip: pageOffset(query),
      take: query.limit,
    });
    return toPaginatedResponse(
      { ...result, items: result.items.map(toContractResponse) },
      query,
    );
  }

  async get(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractDetail> {
    const { contract, membership } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );
    return {
      contract: toContractResponse(contract),
      membership: toMembershipResponse(membership),
    };
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
      toDate: query.toDate ? normalizeEndDate(query.toDate) : undefined,
      status: query.status,
      userId: query.userId,
      skip: pageOffset(query),
      take: query.limit,
    };
    const result = await this.statusHistory.searchPage(contractScope, filter);
    return toPaginatedResponse(
      { ...result, items: result.items.map(toHistorySummary) },
      query,
    );
  }

  async listWorkspaces(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<AssignableContractWorkspace[]> {
    const { contractScope, membership } = await this.requireMembership(
      userId,
      companyId,
      contractId,
    );
    return this.workspaces.findWorkspaces({
      contractId: contractScope.contractId,
      companyId: membership.companyId,
    });
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
      contractScope,
      companyScope.companyId,
    );
    if (!membership) {
      throw contractNotFound();
    }
    const contract = await this.contracts.findById(companyScope, contractId);
    if (!contract) {
      throw contractNotFound();
    }
    return { membership, contractScope, contract };
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function contractNotFound(): NotFoundException {
  return new NotFoundException('Contract was not found');
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

function toContractResponse(contract: Contract): ContractApiResponse {
  return {
    id: contract.id,
    referenceNumber: contract.referenceNumber,
    title: contract.title,
    description: contract.description,
    contractType: contract.contractType,
    status: contract.status,
    parentContractId: contract.parentContractId,
    originalValueMinor: contract.originalValueMinor,
    currentValueMinor: contract.currentValueMinor,
    currencyCode: contract.currencyCode,
    retentionRateBps: contract.retentionRateBps,
    advancePaymentRateBps: contract.advancePaymentRateBps,
    paymentTermsDays: contract.paymentTermsDays,
    liquidatedDamagesPerDayMinor: contract.liquidatedDamagesPerDayMinor,
    awardDate: toApiDate(contract.awardDate),
    startDate: toApiDate(contract.startDate),
    endDate: toApiDate(contract.endDate),
    revisedEndDate: contract.revisedEndDate
      ? toApiDate(contract.revisedEndDate)
      : null,
    actualCompletionDate: contract.actualCompletionDate
      ? toApiDate(contract.actualCompletionDate)
      : null,
    defectsLiabilityDays: contract.defectsLiabilityDays,
    timezone: contract.timezone,
    createdAt: toApiDate(contract.createdAt),
    updatedAt: toApiDate(contract.updatedAt),
    deletedAt: contract.deletedAt ? toApiDate(contract.deletedAt) : null,
  };
}

function toMembershipResponse(party: ContractParty): ContractMembership {
  return {
    id: party.id,
    companyId: party.companyId,
    partyType: party.partyType,
    signedAt: party.signedAt ? toApiDate(party.signedAt) : null,
  };
}

function toApiDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeEndDate(value: string): string {
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
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
