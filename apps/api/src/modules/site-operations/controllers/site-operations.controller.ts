import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import { SiteOperationsService } from '../services/site-operations.service';

@Controller('companies/:companyId/contracts/:contractId')
export class SiteOperationsController {
  constructor(private readonly siteOperations: SiteOperationsService) {}

  @Get('sites')
  listSites(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.siteOperations.sites.list(user.id, companyId, contractId, query);
  }

  @Get('sites/:siteId')
  getSite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('siteId') siteId: string,
  ) {
    return this.siteOperations.sites.get(user.id, companyId, contractId, siteId);
  }

  @Get('daily-logs')
  listDailyLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.siteOperations.dailyLogs.list(user.id, companyId, contractId, query);
  }

  @Get('daily-logs/:logId')
  getDailyLog(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('logId') logId: string,
  ) {
    return this.siteOperations.dailyLogs.get(user.id, companyId, contractId, logId);
  }

  @Get('inventory-items')
  listInventoryItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.siteOperations.inventoryItems.list(user.id, companyId, contractId, query);
  }

  @Get('inventory-items/:itemId')
  getInventoryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.siteOperations.inventoryItems.get(user.id, companyId, contractId, itemId);
  }

  @Get('inventory-transactions')
  listInventoryTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.siteOperations.inventoryTransactions.list(user.id, companyId, contractId, query);
  }

  @Get('inventory-transactions/:transactionId')
  getInventoryTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.siteOperations.inventoryTransactions.get(user.id, companyId, contractId, transactionId);
  }
}
