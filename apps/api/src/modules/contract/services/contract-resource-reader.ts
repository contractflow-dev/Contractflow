import { NotFoundException } from '@nestjs/common';
import type { IPaginatedResponse } from '@contractflow/contracts-schema';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import type { IContractScopedEntity } from '../../../common/database/repositories/contract-scope.interface';
import type { IContractResourceRepository } from '../interfaces/contract-resource-repository.interface';
import type { ContractAccessService } from './contract-access.service';
import type { ContractWorkspace } from './contract-workspace';

/** Read-only list/get of one contract-scoped resource, behind the access gate. */
export class ContractResourceReader<
  Entity extends IContractScopedEntity & { createdAt: Date },
> {
  constructor(
    private readonly access: ContractAccessService,
    private readonly repository: IContractResourceRepository<Entity>,
    private readonly workspace: ContractWorkspace,
    private readonly label: string,
  ) {}

  async list(
    userId: string,
    companyId: string,
    contractId: string,
    query: IPageQuery,
  ): Promise<IPaginatedResponse<Entity>> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      this.workspace,
    );
    const page = await this.repository.findPage(scope, {
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: pageOffset(query),
      take: query.limit,
    });
    return toPaginatedResponse(page, query);
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
    const record = await this.repository.findById(scope, id);
    if (!record) {
      throw new NotFoundException(`${this.label} was not found`);
    }
    return record;
  }
}
