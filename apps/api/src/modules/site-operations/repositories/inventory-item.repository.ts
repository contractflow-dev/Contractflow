import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { InventoryItem } from '../entities/inventory-item.entity';

@Injectable()
export class InventoryItemRepository extends ContractScopedRepository<InventoryItem> {
  constructor(
    @InjectRepository(InventoryItem) repository: Repository<InventoryItem>,
  ) {
    super(repository);
  }
}
