import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { ActivityService } from '../services/activity.service';

@Controller('companies/:companyId/contracts/:contractId/activity')
@UseGuards(CompanyContextGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activity.listForContract(user.id, companyId, contractId, query);
  }
}
