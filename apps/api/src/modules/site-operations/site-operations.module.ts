import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract-module';
import { SiteOperationsController } from './controllers/site-operations.controller';
import { ContractSite } from './entities/contract-site.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { SiteDailyLog } from './entities/site-daily-log.entity';
import { ContractSiteRepository } from './repositories/contract-site.repository';
import { InventoryItemRepository } from './repositories/inventory-item.repository';
import { InventoryTransactionRepository } from './repositories/inventory-transaction.repository';
import { SiteDailyLogRepository } from './repositories/site-daily-log.repository';
import { SiteOperationsService } from './services/site-operations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractSite,
      SiteDailyLog,
      InventoryItem,
      InventoryTransaction,
    ]),
    ContractModule,
  ],
  controllers: [SiteOperationsController],
  providers: [
    SiteOperationsService,
    ContractSiteRepository,
    SiteDailyLogRepository,
    InventoryItemRepository,
    InventoryTransactionRepository,
  ],
  exports: [SiteOperationsService],
})
export class SiteOperationsModule {}
