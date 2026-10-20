import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { InventoryTransaction } from '../entities/inventory-transaction.entity';

@Injectable()
export class InventoryTransactionRepository extends ContractScopedRepository<InventoryTransaction> {
  constructor(
    @InjectRepository(InventoryTransaction)
    repository: Repository<InventoryTransaction>,
  ) {
    super(repository);
  }
}
