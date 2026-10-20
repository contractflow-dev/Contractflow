import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import { ComplianceService } from '../services/compliance-service';

@Controller('companies/:companyId/contracts/:contractId/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('requirements')
  listRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.compliance.requirements.list(user.id, companyId, contractId, query);
  }

  @Get('requirements/:requirementId')
  getRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.compliance.requirements.get(user.id, companyId, contractId, requirementId);
  }

  @Get('records')
  listRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.compliance.records.list(user.id, companyId, contractId, query);
  }

  @Get('records/:recordId')
  getRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.compliance.records.get(user.id, companyId, contractId, recordId);
  }
}
