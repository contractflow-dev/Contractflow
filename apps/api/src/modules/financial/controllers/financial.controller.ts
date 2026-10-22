import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import { FinancialService } from '../services/financial.service';

@Controller('companies/:companyId/contracts/:contractId')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('invoices')
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financial.invoices.list(user.id, companyId, contractId, query);
  }

  @Get('invoices/:invoiceId')
  getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.financial.invoices.get(user.id, companyId, contractId, invoiceId);
  }

  @Get('payments')
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financial.payments.list(user.id, companyId, contractId, query);
  }

  @Get('payments/:paymentId')
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.financial.payments.get(user.id, companyId, contractId, paymentId);
  }
}
