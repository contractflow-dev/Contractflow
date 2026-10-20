import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { ContractSite } from '../entities/contract-site.entity';

@Injectable()
export class ContractSiteRepository extends ContractScopedRepository<ContractSite> {
  constructor(
    @InjectRepository(ContractSite) repository: Repository<ContractSite>,
  ) {
    super(repository);
  }
}
