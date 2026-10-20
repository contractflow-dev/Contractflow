import { NotFoundException } from '@nestjs/common';
import type { FindOptionsOrder, ObjectLiteral } from 'typeorm';
import type {
  IContractScope,
  IContractScopedEntity,
} from '../../../common/database/repositories/contract-scope.interface';
import type { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type {
  ContractAccessService,
  ContractWorkspace,
} from './contract-access.service';

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Read-only list/get of one contract-scoped resource, behind the access gate. */
export class ContractResourceReader<
  Entity extends ObjectLiteral & IContractScopedEntity,
> {
  constructor(
    private readonly access: ContractAccessService,
    private readonly repository: ContractScopedRepository<Entity, IContractScope>,
    private readonly workspace: ContractWorkspace,
    private readonly label: string,
  ) {}

  async list(
    userId: string,
    companyId: string,
    contractId: string,
    query: { page: number; limit: number },
  ): Promise<PagedResult<Entity>> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      this.workspace,
    );
    const { items, total } = await this.repository.findPage(scope, {
      order: { createdAt: 'DESC', id: 'ASC' } as unknown as FindOptionsOrder<Entity>,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(
    userId: string,
    companyId: string,
    contractId: string,
    id: string,
  ): Promise<Entity> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      this.workspace,
    );
    const record = await this.repository.findById(id, scope);
    if (!record) {
      throw new NotFoundException(`${this.label} was not found`);
    }
    return record;
  }
}
