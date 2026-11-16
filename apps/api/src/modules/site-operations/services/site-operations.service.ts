import { Injectable } from '@nestjs/common';
import type {
  ContractSite as ContractSiteResponse,
  InventoryItem as InventoryItemResponse,
  InventoryTransaction as InventoryTransactionResponse,
  SiteDailyLog as SiteDailyLogResponse,
} from '@contractflow/contracts-schema';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import {
  toContractSiteResponse,
  toInventoryItemResponse,
  toInventoryTransactionResponse,
  toSiteDailyLogResponse,
} from '../dto/site-operations-response.dto';
import type { ContractSite } from '../entities/contract-site.entity';
import type { InventoryItem } from '../entities/inventory-item.entity';
import type { InventoryTransaction } from '../entities/inventory-transaction.entity';
import type { SiteDailyLog } from '../entities/site-daily-log.entity';
import { ContractSiteRepository } from '../repositories/contract-site.repository';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { InventoryTransactionRepository } from '../repositories/inventory-transaction.repository';
import { SiteDailyLogRepository } from '../repositories/site-daily-log.repository';

@Injectable()
export class SiteOperationsService {
  readonly sites: ContractResourceReader<ContractSite, ContractSiteResponse>;
  readonly dailyLogs: ContractResourceReader<
    SiteDailyLog,
    SiteDailyLogResponse
  >;
  readonly inventoryItems: ContractResourceReader<
    InventoryItem,
    InventoryItemResponse
  >;
  readonly inventoryTransactions: ContractResourceReader<
    InventoryTransaction,
    InventoryTransactionResponse
  >;

  constructor(
    access: ContractAccessService,
    sites: ContractSiteRepository,
    dailyLogs: SiteDailyLogRepository,
    inventoryItems: InventoryItemRepository,
    inventoryTransactions: InventoryTransactionRepository,
  ) {
    this.sites = new ContractResourceReader(
      access,
      sites,
      'project',
      'Site',
      toContractSiteResponse,
    );
    this.dailyLogs = new ContractResourceReader(
      access,
      dailyLogs,
      'project',
      'Daily log',
      toSiteDailyLogResponse,
    );
    this.inventoryItems = new ContractResourceReader(
      access,
      inventoryItems,
      'project',
      'Inventory item',
      toInventoryItemResponse,
    );
    this.inventoryTransactions = new ContractResourceReader(
      access,
      inventoryTransactions,
      'project',
      'Inventory transaction',
      toInventoryTransactionResponse,
    );
  }
}
