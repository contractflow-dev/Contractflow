import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { InventoryTransaction } from '../entities/inventory-transaction.entity';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { sumBigint } from '../../../common/database/utils/sum-bigint';

@Injectable()
export class InventoryTransactionRepository extends AppendOnlyContractScopedRepository<InventoryTransaction> {
  constructor(
    @InjectRepository(InventoryTransaction)
    repository: Repository<InventoryTransaction>,
  ) {
    super(repository);
  }

  findByItem(inventoryItemId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { inventoryItemId } as FindOptionsWhere<InventoryTransaction>,
      order: { transactionAt: 'DESC' } as any,
    });
  }

  findByDailyLog(siteDailyLogId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { siteDailyLogId } as FindOptionsWhere<InventoryTransaction>,
    });
  }

  findByReference(referenceNumber: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { referenceNumber } as FindOptionsWhere<InventoryTransaction>,
    });
  }

  /** The ledger is the truth: reconcile inventory_item.quantity_on_hand_milli against this. */
  ledgerQuantityMilli(
    inventoryItemId: string,
    scope: IContractScope,
  ): Promise<bigint> {
    return sumBigint(
      this.scopedQuery(scope).andWhere('e.inventoryItemId = :inventoryItemId', {
        inventoryItemId,
      }),
      'e.quantityMilli',
    );
  }
}
