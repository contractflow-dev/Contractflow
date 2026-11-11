import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ECompanyRole } from '@contractflow/contracts-schema';
import type {
  Contract as ContractApiResponse,
  ContractCounterparty,
  ContractDetail,
  ContractListItem,
  ContractListRole,
  ContractMembership,
  IPaginatedResponse,
} from '@contractflow/contracts-schema';
import { CompanyScopeService } from '../../identity/services/company/company-scope.service';
import type { Contract } from '../entities/contract.entity';
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
import { ContractRoleAssignmentRepository } from '../repositories/contract-role-assignment.repository';
import { ContractAccessService } from './contract-access.service';
import { workspaceForRole } from './contract-workspace';
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

@Injectable()
export class ContractService {
  constructor(
    private readonly companyScope: CompanyScopeService,
    private readonly parties: ContractPartyRepository,
    private readonly statusHistory: ContractStatusHistoryRepository,
    private readonly contracts: ContractRepository,
    private readonly companyUsers: CompanyUserRepository,
    private readonly workspaces: ContractWorkspaceRepository,
    private readonly roleAssignments: ContractRoleAssignmentRepository,
    private readonly access: ContractAccessService,
  ) {}

  async list(
    userId: string,
    companyId: string,
    query: ListContractsQuery,
  ): Promise<IPaginatedResponse<ContractListItem>> {
    const context = await this.companyScope.contextForUser(userId, companyId);
    // The user's own membership of the header company: the only assignments
    // this list ever reads, and the reader the visibility rule is checked for.
    const companyUserId = context.membership.id;
    const scope = {
      companyId: context.companyId,
      companyUserId,
      // Ordinary members see contracts they hold a role on; a Company
      // Administrator also sees, read-only, every contract their company is
      // party to. Re-checked in SQL from the stored membership row.
      includeCompanyAdminOversight: true,
    };
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
      assignedToCompanyUserId: query.assignedToMe ? companyUserId : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      skip: pageOffset(query),
      take: query.limit,
    });
    // Other parties' names, under the same rule as GET /contract/parties:
    // anyone who may see the contract may see them. Archived contracts can't be
    // opened, so their parties aren't listed.
    const counterparties = query.includeDeleted
      ? []
      : await this.parties.findCounterparties(
          scope.companyId,
          result.items.map((contract) => contract.id),
        );
    const roles = query.includeDeleted
      ? []
      : await this.roleAssignments.findActiveRolesForContracts(
          { companyId: scope.companyId },
          companyUserId,
          result.items.map((contract) => contract.id),
        );
    const rolesByContract = new Map<string, ContractListRole[]>();
    for (const { contractId, role, isWorkspaceAdmin } of roles) {
      const list = rolesByContract.get(contractId) ?? [];
      list.push({ role, workspace: workspaceForRole(role), isWorkspaceAdmin });
      rolesByContract.set(contractId, list);
    }
    const byContract = new Map<string, ContractCounterparty[]>();
    for (const { contractId, companyName, partyType } of counterparties) {
      const list = byContract.get(contractId) ?? [];
      list.push({ companyName, partyType });
      byContract.set(contractId, list);
    }
    return toPaginatedResponse(
      {
        ...result,
        items: result.items.map((contract) => ({
          ...toContractResponse(contract),
          counterparties: byContract.get(contract.id) ?? [],
          myRoles: rolesByContract.get(contract.id) ?? [],
        })),
      },
      query,
    );
  }

  async get(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractDetail> {
    const { contract, party } = await this.access.authorizeContractOversight(
      userId,
      companyId,
      contractId,
    );
    return {
      contract: toContractResponse(contract),
      membership: toMembershipResponse(party),
    };
  }

  async listParties(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractPartySummary[]> {
    // Visibility must be proven first: the query below is NOT company-scoped.
    const { scope } = await this.access.authorizeContractOversight(
      userId,
      companyId,
      contractId,
    );

    const parties = await this.parties.findAllWithCompany(scope);
    return parties.map(toPartySummary);
  }

  async listStatusHistory(
    userId: string,
    companyId: string,
    contractId: string,
    query: ListContractStatusHistoryQuery,
  ) {
    const { scope: contractScope } =
      await this.access.authorizeContractOversight(
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
    // Which workspaces the contract has enabled is general contract setup
    // information, not access to any of them.
    const { scope } = await this.access.authorizeContractOversight(
      userId,
      companyId,
      contractId,
    );
    return this.workspaces.findWorkspaces(scope);
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

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
