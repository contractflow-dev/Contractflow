import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ComplianceRequirement } from '../entities/compliance-requirement.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class ComplianceRequirementRepository extends ContractScopedRepository<ComplianceRequirement> {
  constructor(
    @InjectRepository(ComplianceRequirement)
    repository: Repository<ComplianceRequirement>,
  ) {
    super(repository);
  }

  findMandatory(scope: IContractScope) {
    return this.findAll(scope, {
      where: { isMandatory: true } as FindOptionsWhere<ComplianceRequirement>,
    });
  }

  findByCategory(
    category: ComplianceRequirement['category'],
    scope: IContractScope,
  ) {
    return this.findAll(scope, {
      where: { category } as FindOptionsWhere<ComplianceRequirement>,
    });
  }

  findForPartyType(
    appliesToPartyType: ComplianceRequirement['appliesToPartyType'],
    scope: IContractScope,
  ) {
    return this.findAll(scope, {
      where: { appliesToPartyType } as FindOptionsWhere<ComplianceRequirement>,
    });
  }
}
