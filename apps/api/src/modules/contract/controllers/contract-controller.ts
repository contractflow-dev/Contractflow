import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import {
  CreateContractRoleAssignmentRequestDto,
  CreateContractRoleInvitationRequestDto,
  ListCompanyRoleAssignmentsRequestDto,
  ListContractRoleAssignmentsRequestDto,
  SetWorkspaceAdminRequestDto,
} from '../dto/contract-role-assignment.dto';
import { CreateContractRequestDto } from '../dto/create-contract-request.dto';
import { CreateContractPartyInvitationRequestDto } from '../dto/contract-party-invitation.dto';
import { RecordContractSignatoryRequestDto } from '../dto/record-contract-signatory-request.dto';
import {
  CreateContractSiteRequestDto,
  UpdateContractSiteRequestDto,
} from '../dto/contract-site-request.dto';
import {
  ListContractStatusHistoryRequestDto,
  ListContractsRequestDto,
} from '../dto/list-contracts-request.dto';
import { TransitionContractRequestDto } from '../dto/transition-contract-request.dto';
import { UpdateContractRequestDto } from '../dto/update-contract-request.dto';
import { UpdateContractWorkspacesRequestDto } from '../dto/update-contract-workspaces-request.dto';
import { ContractService } from '../services/contract.service';
import { ContractLifecycleService } from '../services/contract-lifecycle.service';
import { ContractRoleAssignmentService } from '../services/contract-role-assignment.service';

@Controller()
@UseGuards(CompanyContextGuard)
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly roleAssignments: ContractRoleAssignmentService,
    private readonly lifecycle: ContractLifecycleService,
  ) {}

  @Post('contracts')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: CreateContractRequestDto,
  ) {
    return this.lifecycle.create(user.id, companyId, body);
  }

  @Get('contracts')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListContractsRequestDto,
  ) {
    return this.contractService.list(user.id, companyId, query);
  }

  @Get('contract/workspaces')
  @UseGuards(ContractContextGuard)
  listWorkspaces(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.contractService.listWorkspaces(user.id, companyId, contractId);
  }

  @Get('contract/lifecycle-permissions')
  @UseGuards(ContractContextGuard)
  lifecyclePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.managementPermissions(user.id, companyId, contractId);
  }

  @Patch('contract')
  @UseGuards(ContractContextGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: UpdateContractRequestDto,
  ) {
    return this.lifecycle.update(user.id, companyId, contractId, body);
  }

  @Patch('contract/workspaces')
  @UseGuards(ContractContextGuard)
  updateWorkspaces(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: UpdateContractWorkspacesRequestDto,
  ) {
    return this.lifecycle.updateWorkspaces(
      user.id,
      companyId,
      contractId,
      body,
    );
  }

  @Post('contract/transitions')
  @UseGuards(ContractContextGuard)
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: TransitionContractRequestDto,
  ) {
    return this.lifecycle.transition(user.id, companyId, contractId, body);
  }

  @Delete('contract')
  @UseGuards(ContractContextGuard)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.archive(user.id, companyId, contractId);
  }

  @Post('contract/restore')
  @UseGuards(ContractContextGuard)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.restore(user.id, companyId, contractId);
  }

  @Get('contract')
  @UseGuards(ContractContextGuard)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.contractService.get(user.id, companyId, contractId);
  }

  @Get('contract/parties')
  @UseGuards(ContractContextGuard)
  listParties(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.contractService.listParties(user.id, companyId, contractId);
  }

  @Get('contract/site-management')
  @UseGuards(ContractContextGuard)
  listManagedSites(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.listSites(user.id, companyId, contractId);
  }

  @Post('contract/sites')
  @UseGuards(ContractContextGuard)
  createSite(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: CreateContractSiteRequestDto,
  ) {
    return this.lifecycle.createSite(user.id, companyId, contractId, body);
  }

  @Patch('contract/sites/:siteId')
  @UseGuards(ContractContextGuard)
  updateSite(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('siteId') siteId: string,
    @Body() body: UpdateContractSiteRequestDto,
  ) {
    return this.lifecycle.updateSite(
      user.id,
      companyId,
      contractId,
      siteId,
      body,
    );
  }

  @Get('contract/parties/signatory')
  @UseGuards(ContractContextGuard)
  getSignatory(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.getSignatory(user.id, companyId, contractId);
  }

  @Patch('contract/parties/signatory')
  @UseGuards(ContractContextGuard)
  recordSignatory(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: RecordContractSignatoryRequestDto,
  ) {
    return this.lifecycle.recordSignatory(user.id, companyId, contractId, body);
  }

  @Get('contract/status-history')
  @UseGuards(ContractContextGuard)
  listStatusHistory(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractStatusHistoryRequestDto,
  ) {
    return this.contractService.listStatusHistory(
      user.id,
      companyId,
      contractId,
      query,
    );
  }

  @Get('contract/party-invitations')
  @UseGuards(ContractContextGuard)
  listPartyInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
  ) {
    return this.lifecycle.listPartyInvitations(user.id, companyId, contractId);
  }

  @Post('contract/party-invitations')
  @UseGuards(ContractContextGuard)
  inviteCompany(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: CreateContractPartyInvitationRequestDto,
  ) {
    return this.lifecycle.inviteCompany(user.id, companyId, contractId, body);
  }

  @Delete('contract/party-invitations/:invitationId')
  @UseGuards(ContractContextGuard)
  revokeCompanyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.lifecycle.revokeCompanyInvitation(
      user.id,
      companyId,
      contractId,
      invitationId,
    );
  }

  /** Contract roles held across the header company. Administrators only. */
  @Get('company/role-assignments')
  listCompanyRoleAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListCompanyRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.listForCompany(user.id, companyId, query);
  }

  @Get('contract/role-assignments')
  @UseGuards(ContractContextGuard)
  listRoleAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.list(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Get('contract/role-management')
  @UseGuards(ContractContextGuard)
  roleManagementPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.managementPermissions(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Get('contract/role-assignment-members')
  @UseGuards(ContractContextGuard)
  listRoleAssignmentMembers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.listEligibleMembers(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Post('contract/role-assignments')
  @UseGuards(ContractContextGuard)
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
    @Body() body: CreateContractRoleAssignmentRequestDto,
  ) {
    return this.roleAssignments.assign(
      user.id,
      companyId,
      contractId,
      query.workspace,
      body.companyUserId,
      body.role,
      body.isWorkspaceAdmin ?? false,
    );
  }

  @Delete('contract/role-assignments/:assignmentId')
  @UseGuards(ContractContextGuard)
  revokeRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.roleAssignments.revoke(
      user.id,
      companyId,
      contractId,
      assignmentId,
    );
  }

  @Patch('contract/role-assignments/:assignmentId/workspace-admin')
  @UseGuards(ContractContextGuard)
  setWorkspaceAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: SetWorkspaceAdminRequestDto,
  ) {
    return this.roleAssignments.setWorkspaceAdmin(
      user.id,
      companyId,
      contractId,
      assignmentId,
      body.isWorkspaceAdmin,
    );
  }

  @Get('contract/role-invitations')
  @UseGuards(ContractContextGuard)
  listRoleInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.listInvitations(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Post('contract/role-invitations')
  @UseGuards(ContractContextGuard)
  inviteContractRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
    @Body() body: CreateContractRoleInvitationRequestDto,
  ) {
    return this.roleAssignments.invite(
      user.id,
      companyId,
      contractId,
      query.workspace,
      body.email,
      body.role,
      body.isWorkspaceAdmin ?? false,
    );
  }

  @Delete('contract/role-invitations/:invitationId')
  @UseGuards(ContractContextGuard)
  revokeRoleInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.roleAssignments.revokeInvitation(
      user.id,
      companyId,
      contractId,
      invitationId,
    );
  }
}
