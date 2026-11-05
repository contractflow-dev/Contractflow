import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { ComplianceService } from '../services/compliance-service';

@Controller('contract/compliance')
@UseGuards(CompanyContextGuard, ContractContextGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('requirements')
  listRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.compliance.requirements.list(
      user.id,
      companyId,
      contractId,
      query,
    );
  }

  @Get('requirements/:requirementId')
  getRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.compliance.requirements.get(
      user.id,
      companyId,
      contractId,
      requirementId,
    );
  }

  @Get('records')
  listRecords(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.compliance.records.list(user.id, companyId, contractId, query);
  }

  @Get('records/:recordId')
  getRecord(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.compliance.records.get(
      user.id,
      companyId,
      contractId,
      recordId,
    );
  }
}
