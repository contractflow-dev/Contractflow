import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EContractStatus } from '@contractflow/contracts-schema';
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
    @InjectRepository(ContractParty)
    private readonly partyRows: Repository<ContractParty>,
  ) {}

  async list(
    userId: string,
    companyId: string,
    query: {
      search?: string;
      status?: EContractStatus;
      page: number;
      limit: number;
    },
  ): Promise<Page<Contract>> {
    const scope = await this.companyScope.forUser(userId, companyId);
    const { items, total } = await this.contracts.searchPage(scope, {
      search: query.search,
      status: query.status,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{ contract: Contract; membership: ContractParty }> {
    const scope = await this.companyScope.forUser(userId, companyId);
    // Not-found for both "no such contract" and "not your contract".
    const [membership] = await this.parties.findForContract(contractId, scope);
    if (!membership) {
      throw new NotFoundException('Contract was not found');
    }

    const contract = await this.contracts.findById(contractId, scope);
    if (!contract) {
      throw new NotFoundException('Contract was not found');
    }
    return { contract, membership };
  }

  async listParties(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<
    {
      id: string;
      companyId: string;
      companyName: string;
      partyType: ContractParty['partyType'];
      signedAt: Date;
    }[]
  > {
    await this.get(userId, companyId, contractId);
    const parties = await this.partyRows.find({
      where: { contractId },
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
    return parties.map((party) => ({
      id: party.id,
      companyId: party.companyId,
      companyName: party.company.name,
      partyType: party.partyType,
      signedAt: party.signedAt,
    }));
  }

  async listStatusHistory(
    userId: string,
    companyId: string,
    contractId: string,
    query: { page: number; limit: number },
  ) {
    const scope = await this.companyScope.forUser(userId, companyId);
    const [party] = await this.parties.findForContract(contractId, scope);
    if (!party) {
      throw new NotFoundException('Contract was not found');
    }

    const { items, total } = await this.statusHistory.findForContract(
      { contractId, companyId: scope.companyId },
      { skip: (query.page - 1) * query.limit, take: query.limit },
    );
    return { items, total, page: query.page, limit: query.limit };
  }
}
