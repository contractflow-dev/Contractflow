import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';

@Injectable()
export class ContractRoleAssignmentRepository extends CompanyScopedRepository<
  ContractRoleAssignment,
  ICompanyScope
> {
  constructor(
    @InjectRepository(ContractRoleAssignment)
    repository: Repository<ContractRoleAssignment>,
  ) {
    super(repository);
  }

  override async findById(
    id: string,
    scope: ICompanyScope,
  ): Promise<ContractRoleAssignment | null> {
    return this.scopedQuery(scope, 'assignment')
      .innerJoin('assignment.contractParty', 'party')
      .innerJoin('assignment.companyUser', 'member')
      .andWhere('assignment.id = :id', { id })
      .andWhere('party.companyId = :__scopeCompanyId')
      .andWhere('member.companyId = :__scopeCompanyId')
      .getOne();
  }

  async findForContractParty(
    contractPartyId: string,
    scope: ICompanyScope,
  ): Promise<ContractRoleAssignment[]> {
    return this.scopedQuery(scope, 'assignment')
      .innerJoin('assignment.contractParty', 'party')
      .innerJoin('assignment.companyUser', 'member')
      .andWhere('assignment.contractPartyId = :contractPartyId', {
        contractPartyId,
      })
      .andWhere('party.companyId = :__scopeCompanyId')
      .andWhere('member.companyId = :__scopeCompanyId')
      .getMany();
  }
}
