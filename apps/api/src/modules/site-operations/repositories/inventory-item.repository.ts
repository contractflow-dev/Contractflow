import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { InventoryItem } from '../entities/inventory-item.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class InventoryItemRepository extends ContractScopedRepository<InventoryItem> {
  constructor(
    @InjectRepository(InventoryItem) repository: Repository<InventoryItem>,
  ) {
    super(repository);
  }

  findByItemCode(itemCode: string, scope: IContractScope) {
    return this.findOne(
      { where: { itemCode } as FindOptionsWhere<InventoryItem> },
      scope,
    );
  }

  findBySite(contractSiteId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { contractSiteId } as FindOptionsWhere<InventoryItem>,
    });
  }

  findByOwner(contractPartyId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { contractPartyId } as FindOptionsWhere<InventoryItem>,
    });
  }

  /** At or below reorder level (items with no level set are ignored). */
  findBelowReorderLevel(scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.reorderLevelMilli IS NOT NULL')
      .andWhere('e.quantityOnHandMilli <= e.reorderLevelMilli')
      .getMany();
  }
}
