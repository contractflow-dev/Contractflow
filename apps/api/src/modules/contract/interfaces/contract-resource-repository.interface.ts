import type { IPersistencePage } from '../../../common/application/pagination.interface';
import type {
  IContractScope,
  IContractScopedEntity,
} from '../../../common/database/repositories/contract-scope.interface';

/** Persistence a `ContractResourceReader` needs for one resource type. */
export interface IContractResourceRepository<
  Entity extends IContractScopedEntity,
> {
  findPage(
    scope: IContractScope,
    options: {
      order: { createdAt: 'DESC'; id: 'ASC' };
      skip: number;
      take: number;
    },
  ): Promise<IPersistencePage<Entity>>;
  findById(scope: IContractScope, id: string): Promise<Entity | null>;
}
