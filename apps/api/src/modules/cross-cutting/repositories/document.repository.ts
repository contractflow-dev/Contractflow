import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { Document } from '../entities/document.entity';
import {
  CompanyScopedRepository,
  requireCompanyId,
} from '../../../common/database/repositories/company-scoped.repository';
import { SelectQueryBuilder } from 'typeorm/browser';
import { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';

/**
 * Documents belong to one contract and are owned by one party company. Both
 * boundaries apply: the company must be a party to the contract, and only
 * documents it owns are visible.
 */
@Injectable()
export class DocumentRepository extends CompanyScopedRepository<Document> {
  constructor(@InjectRepository(Document) repository: Repository<Document>) {
    super(repository);
  }

  protected override applyScope(
    qb: SelectQueryBuilder<Document>,
    scope: ICompanyScope,
  ): void {
    qb.andWhere(`${qb.alias}.ownerCompanyId = :__scopeOwnerCompanyId`, {
      __scopeOwnerCompanyId: requireCompanyId(scope),
    });
  }

  protected override scopeWhere(
    scope: ICompanyScope,
  ): FindOptionsWhere<Document> {
    return {
      ownerCompanyId: requireCompanyId(scope),
    } as unknown as FindOptionsWhere<Document>;
  }

  protected override scopeValues(scope: ICompanyScope): DeepPartial<Document> {
    return {
      ownerCompanyId: requireCompanyId(scope),
    } as unknown as DeepPartial<Document>;
  }

  findByContract(contractId: string, scope: ICompanyScope) {
    return this.findAll(scope, {
      where: { contractId } as FindOptionsWhere<Document>,
      order: { createdAt: 'DESC' } as any,
    });
  }

  /** Company-level files: contract_id is null. */
  findCompanyLevel(scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.contractId IS NULL')
      .orderBy('e.createdAt', 'DESC')
      .getMany();
  }

  findByCategory(category: Document['category'], scope: ICompanyScope) {
    return this.findAll(scope, {
      where: { category } as FindOptionsWhere<Document>,
    });
  }

  findByStatus(status: Document['status'], scope: ICompanyScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Document>,
    });
  }

  findByDocumentNumber(documentNumber: string, scope: ICompanyScope) {
    return this.findOne(
      { where: { documentNumber } as FindOptionsWhere<Document> },
      scope,
    );
  }
}
