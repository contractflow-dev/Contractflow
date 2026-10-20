import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { Document } from '../entities/document.entity';

/**
 * Documents belong to one contract and are owned by one party company. Both
 * boundaries apply: the company must be a party to the contract, and only
 * documents it owns are visible.
 */
@Injectable()
export class DocumentRepository extends ContractScopedRepository<
  Document,
  IContractCompanyScope
> {
  protected override readonly requireCompany = true;
  protected override readonly companyProperty = 'ownerCompanyId';

  constructor(
    @InjectRepository(Document)
    repository: Repository<Document>,
  ) {
    super(repository);
  }
}
