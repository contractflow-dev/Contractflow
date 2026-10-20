import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { ContractParty } from '../entities/contract-party.entity';

@Injectable()
export class ContractPartyRepository extends CompanyScopedRepository<
  ContractParty,
  ICompanyScope
> {
  constructor(
    @InjectRepository(ContractParty)
    repository: Repository<ContractParty>,
  ) {
    super(repository);
  }

  async findForContract(
    contractId: string,
    scope: ICompanyScope,
  ): Promise<ContractParty[]> {
    return this.scopedQuery(scope, 'party')
      .andWhere('party.contractId = :contractId', { contractId })
      .getMany();
  }
}
