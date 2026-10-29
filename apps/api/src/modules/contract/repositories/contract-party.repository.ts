import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

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
}
