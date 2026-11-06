import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EDocumentVisibility } from '@contractflow/contracts-schema';
import { IsNull } from 'typeorm';
import type {
  DeepPartial,
  FindOptionsOrder,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Document } from '../entities/document.entity';
import {
  CompanyScopedRepository,
  requireCompanyId,
} from '../../../common/database/repositories/company-scoped.repository';
import { SelectQueryBuilder } from 'typeorm/browser';
import { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';

function requireContractId(scope: { contractId?: string }): string {
  const contractId = scope?.contractId?.trim();
  if (!contractId) {
    throw new BadRequestException('Contract context is required');
  }
  return contractId;
}

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

  // Soft-deleted documents are outside every scope. They are filtered here
  // but never stamped by scopeValues, so updates cannot clear deletedAt.
  protected override applyScope(
    scope: ICompanyScope,
    qb: SelectQueryBuilder<Document>,
  ): void {
    qb.andWhere(`${qb.alias}.ownerCompanyId = :__scopeOwnerCompanyId`, {
      __scopeOwnerCompanyId: requireCompanyId(scope),
    }).andWhere(`${qb.alias}.deletedAt IS NULL`);
  }

  protected override scopeWhere(
    scope: ICompanyScope,
  ): FindOptionsWhere<Document> {
    return {
      ownerCompanyId: requireCompanyId(scope),
      deletedAt: IsNull(),
    } as unknown as FindOptionsWhere<Document>;
  }

  protected override scopeValues(scope: ICompanyScope): DeepPartial<Document> {
    return {
      ownerCompanyId: requireCompanyId(scope),
    } as unknown as DeepPartial<Document>;
  }

  // -------------------------------------------------------------------------
  // Contract-scoped access. `scope` must come from ContractAccessService, which
  // has verified that the company is a party to the contract.
  // -------------------------------------------------------------------------

  /** An active document owned by the scope company in the scope contract. */
  findOwnedInContract(
    scope: IContractCompanyScope,
    documentId: string,
    options: { lockForUpdate?: boolean } = {},
  ): Promise<Document | null> {
    return this.findOne(scope, {
      where: {
        id: documentId,
        contractId: requireContractId(scope),
      } as FindOptionsWhere<Document>,
      ...(options.lockForUpdate
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
  }

  /** Owned by the scope company, or shared with every contract party. */
  findVisibleInContract(
    scope: IContractCompanyScope,
    documentId: string,
  ): Promise<Document | null> {
    return this.visibleInContract(scope)
      .andWhere('document.id = :documentId', { documentId })
      .getOne();
  }

  async findVisiblePageInContract(
    scope: IContractCompanyScope,
    categories: Document['category'][],
    page: { skip: number; take: number },
  ): Promise<{ items: Document[]; total: number }> {
    if (!categories.length) return { items: [], total: 0 };
    const [items, total] = await this.visibleInContract(scope)
      .andWhere('document.category IN (:...categories)', { categories })
      .orderBy('document.createdAt', 'DESC')
      .addOrderBy('document.id', 'ASC')
      .skip(page.skip)
      .take(page.take)
      .getManyAndCount();
    return { items, total };
  }

  /** Marks an active owned document deleted. Returns false if none matched. */
  async softDeleteInContract(
    scope: IContractCompanyScope,
    documentId: string,
    deletedById: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.repository.update(
      {
        id: documentId,
        contractId: requireContractId(scope),
        ownerCompanyId: requireCompanyId(scope),
        deletedAt: IsNull(),
      },
      { deletedAt: now, deletedById },
    );
    return Boolean(result.affected);
  }

  private visibleInContract(scope: IContractCompanyScope) {
    return this.repository
      .createQueryBuilder('document')
      .where('document.contractId = :contractId', {
        contractId: requireContractId(scope),
      })
      .andWhere('document.deletedAt IS NULL')
      .andWhere(
        '(document.ownerCompanyId = :companyId OR document.visibility = :shared)',
        {
          companyId: requireCompanyId(scope),
          shared: EDocumentVisibility.PUBLIC,
        },
      );
  }

  findByContract(scope: ICompanyScope, contractId: string) {
    return this.findAll(scope, {
      where: { contractId } as FindOptionsWhere<Document>,
      order: { createdAt: 'DESC' } satisfies FindOptionsOrder<Document>,
    });
  }

  /** Company-level files: contract_id is null. */
  findCompanyLevel(scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.contractId IS NULL')
      .orderBy('e.createdAt', 'DESC')
      .getMany();
  }

  findByCategory(scope: ICompanyScope, category: Document['category']) {
    return this.findAll(scope, {
      where: { category } as FindOptionsWhere<Document>,
    });
  }

  findByStatus(scope: ICompanyScope, status: Document['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Document>,
    });
  }

  findByDocumentNumber(scope: ICompanyScope, documentNumber: string) {
    return this.findOne(scope, {
      where: { documentNumber } as FindOptionsWhere<Document>,
    });
  }
}
