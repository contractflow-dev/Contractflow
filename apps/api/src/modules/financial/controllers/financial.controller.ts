import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { FinancialService } from '../services/financial.service';

@Controller('companies/:companyId/contracts/:contractId')
@UseGuards(CompanyContextGuard)
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('invoices')
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financial.invoices.list(user.id, companyId, contractId, query);
  }

  @Get('invoices/:invoiceId')
  getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.financial.invoices.get(
      user.id,
      companyId,
      contractId,
      invoiceId,
    );
  }

  @Get('payments')
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.financial.payments.list(user.id, companyId, contractId, query);
  }

  @Get('payments/:paymentId')
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.financial.payments.get(
      user.id,
      companyId,
      contractId,
      paymentId,
    );
  }
}
