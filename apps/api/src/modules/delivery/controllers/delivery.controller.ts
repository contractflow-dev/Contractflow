import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { DeliveryService } from '../services/delivery.service';

@Controller('companies/:companyId/contracts/:contractId')
@UseGuards(CompanyContextGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('stages')
  listStages(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.delivery.stages.list(user.id, companyId, contractId, query);
  }

  @Get('stages/:stageId')
  getStage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.delivery.stages.get(user.id, companyId, contractId, stageId);
  }

  @Get('milestones')
  listMilestones(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.delivery.milestones.list(user.id, companyId, contractId, query);
  }

  @Get('milestones/:milestoneId')
  getMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.delivery.milestones.get(
      user.id,
      companyId,
      contractId,
      milestoneId,
    );
  }

  @Get('variations')
  listVariations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.delivery.variations.list(user.id, companyId, contractId, query);
  }

  @Get('variations/:variationId')
  getVariation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('contractId') contractId: string,
    @Param('variationId') variationId: string,
  ) {
    return this.delivery.variations.get(
      user.id,
      companyId,
      contractId,
      variationId,
    );
  }
}
