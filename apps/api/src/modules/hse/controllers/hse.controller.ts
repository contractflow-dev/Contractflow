import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import { HseService } from '../services/hse.service';

@Controller('companies/:companyId/contracts/:contractId/hse')
export class HseController {
  constructor(private readonly hse: HseService) {}

  @Get('incidents')
  listIncidents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.hse.incidents.list(user.id, companyId, contractId, query);
  }

  @Get('incidents/:incidentId')
  getIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.hse.incidents.get(user.id, companyId, contractId, incidentId);
  }

  @Get('inspections')
  listInspections(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.hse.inspections.list(user.id, companyId, contractId, query);
  }

  @Get('inspections/:inspectionId')
  getInspection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('inspectionId') inspectionId: string,
  ) {
    return this.hse.inspections.get(user.id, companyId, contractId, inspectionId);
  }

  @Get('corrective-actions')
  listCorrectiveActions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.hse.correctiveActions.list(user.id, companyId, contractId, query);
  }

  @Get('corrective-actions/:actionId')
  getCorrectiveAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.hse.correctiveActions.get(user.id, companyId, contractId, actionId);
  }
}
