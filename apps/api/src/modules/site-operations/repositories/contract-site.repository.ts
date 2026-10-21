import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractSite } from '../entities/contract-site.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class ContractSiteRepository extends ContractScopedRepository<ContractSite> {
  constructor(
    @InjectRepository(ContractSite) repository: Repository<ContractSite>,
  ) {
    super(repository);
  }

  findByStatus(status: ContractSite['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<ContractSite>,
    });
  }

  findBySiteCode(siteCode: string, scope: IContractScope) {
    return this.findOne(
      { where: { siteCode } as FindOptionsWhere<ContractSite> },
      scope,
    );
  }
}
