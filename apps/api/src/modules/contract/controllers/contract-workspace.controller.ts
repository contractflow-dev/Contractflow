import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import { ContractWorkspaceParamDto } from '../dto/contract-role-assignment.dto';
import { ContractWorkspaceAccessService } from '../services/contract-workspace-access.service';

/**
 * The signed-in member's access to the Project, HSE and Finance workspaces
 * of the contract in X-Contract-Id, for the company in X-Company-Id.
 */
@Controller('contract')
@UseGuards(CompanyContextGuard, ContractContextGuard)
export class ContractWorkspaceController {
  constructor(private readonly workspaces: ContractWorkspaceAccessService) {}

  /** Each enabled workspace and whether the caller can enter it. */
  @Get('workspace-access')
  listAccess(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.workspaces.listForUser(user.id, companyId, contractId);
  }

  /** One workspace's access, refused (403) without a role in it. */
  @Get('workspaces/:workspace')
  getAccess(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param() params: ContractWorkspaceParamDto,
  ) {
    return this.workspaces.getForUser(
      user.id,
      companyId,
      contractId,
      params.workspace,
    );
  }
}
