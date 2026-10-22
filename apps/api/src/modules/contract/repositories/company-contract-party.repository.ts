import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContractParty } from '../entities/contract-party.entity';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
// Company-side view of contract_party
// ---------------------------------------------------------------------------

/**
 * contract_party has BOTH contract_id and company_id. ContractPartyRepository
 * (contract-scoped) answers "who are the parties to THIS contract". This one
 * answers "which contracts is MY company a party to", and is what a guard uses
 * to confirm the acting company belongs to a contract before building an
 * IContractScope.
 */
@Injectable()
export class CompanyContractPartyRepository extends CompanyScopedRepository<ContractParty> {
  constructor(
    @InjectRepository(ContractParty) repository: Repository<ContractParty>,
  ) {
    super(repository);
  }

  /** Contract ids this company participates in (feeds dashboards / findForContracts). */
  async findContractIdsForCompany(scope: ICompanyScope): Promise<string[]> {
    const rows = await this.scopedQuery(scope)
      .select('e.contractId', 'contractId')
      .distinct(true)
      .getRawMany<{ contractId: string }>();
    return rows.map((r) => r.contractId);
  }

  /** This company's party row on one contract, or null if it is not a party. */
  findByContract(contractId: string, scope: ICompanyScope) {
    return this.findOne(
      { where: { contractId } as FindOptionsWhere<ContractParty> },
      scope,
    );
  }

  async isPartyToContract(
    contractId: string,
    scope: ICompanyScope,
  ): Promise<boolean> {
    return (await this.findByContract(contractId, scope)) !== null;
  }

  findByPartyType(partyType: ContractParty['partyType'], scope: ICompanyScope) {
    return this.findAll(scope, {
      where: { partyType } as FindOptionsWhere<ContractParty>,
    });
  }

  /** Contracts awaiting this company's signature. */
  findUnsigned(scope: ICompanyScope) {
    return this.scopedQuery(scope).andWhere('e.signedAt IS NULL').getMany();
  }
}
