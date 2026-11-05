import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import { ContractSite } from '../entities/contract-site.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryTransaction } from '../entities/inventory-transaction.entity';
import { SiteDailyLog } from '../entities/site-daily-log.entity';
import { ContractSiteRepository } from '../repositories/contract-site.repository';
import { InventoryItemRepository } from '../repositories/inventory-item.repository';
import { InventoryTransactionRepository } from '../repositories/inventory-transaction.repository';
import { SiteDailyLogRepository } from '../repositories/site-daily-log.repository';

@Injectable()
export class SiteOperationsService {
  readonly sites: ContractResourceReader<ContractSite>;
  readonly dailyLogs: ContractResourceReader<SiteDailyLog>;
  readonly inventoryItems: ContractResourceReader<InventoryItem>;
  readonly inventoryTransactions: ContractResourceReader<InventoryTransaction>;

  constructor(
    access: ContractAccessService,
    sites: ContractSiteRepository,
    dailyLogs: SiteDailyLogRepository,
    inventoryItems: InventoryItemRepository,
    inventoryTransactions: InventoryTransactionRepository,
  ) {
    this.sites = new ContractResourceReader(access, sites, 'project', 'Site');
    this.dailyLogs = new ContractResourceReader(access, dailyLogs, 'project', 'Daily log');
    this.inventoryItems = new ContractResourceReader(access, inventoryItems, 'project', 'Inventory item');
    this.inventoryTransactions = new ContractResourceReader(access, inventoryTransactions, 'project', 'Inventory transaction');
  }
}
