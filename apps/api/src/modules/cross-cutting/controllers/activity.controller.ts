import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { ListContractActivityRequestDto } from '../dto/activity-request.dto';
import { ActivityService } from '../services/activity.service';

@Controller('contract/activity')
@UseGuards(CompanyContextGuard, ContractContextGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** The caller company's entries, newest first, optionally filtered. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractActivityRequestDto,
  ) {
    return this.activity.listForContract(user.id, companyId, contractId, query);
  }

  /** Members of the caller's company with activity here: the actor filter's options. */
  @Get('actors')
  listActors(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.activity.listActors(user.id, companyId, contractId);
  }
}
