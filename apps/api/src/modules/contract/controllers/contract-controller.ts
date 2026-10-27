import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import {
  CreateContractRoleAssignmentRequestDto,
  CreateContractRoleInvitationRequestDto,
  ListContractRoleAssignmentsRequestDto,
  SetWorkspaceAdminRequestDto,
} from '../dto/contract-role-assignment.dto';
import { CreateContractRequestDto } from '../dto/create-contract-request.dto';
import {
  CreateContractPartyInvitationRequestDto,
} from '../dto/contract-party-invitation.dto';
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

@Controller('companies/:companyId/contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly roleAssignments: ContractRoleAssignmentService,
    private readonly lifecycle: ContractLifecycleService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Body() body: CreateContractRequestDto,
  ) {
    return this.lifecycle.create(user.id, companyId, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Query() query: ListContractsRequestDto,
  ) {
    return this.contractService.list(user.id, companyId, query);
  }

  @Get(':contractId/workspaces')
  listWorkspaces(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.contractService.listWorkspaces(
      user.id,
      companyId,
      contractId,
    );
  }

  @Get(':contractId/lifecycle-permissions')
  lifecyclePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.lifecycle.managementPermissions(
      user.id,
      companyId,
      contractId,
    );
  }

  @Patch(':contractId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: UpdateContractRequestDto,
  ) {
    return this.lifecycle.update(user.id, companyId, contractId, body);
  }

  @Patch(':contractId/workspaces')
  updateWorkspaces(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: UpdateContractWorkspacesRequestDto,
  ) {
    return this.lifecycle.updateWorkspaces(
      user.id,
      companyId,
      contractId,
      body,
    );
  }

  @Post(':contractId/transitions')
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: TransitionContractRequestDto,
  ) {
    return this.lifecycle.transition(user.id, companyId, contractId, body);
  }

  @Delete(':contractId')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.lifecycle.archive(user.id, companyId, contractId);
  }

  @Post(':contractId/restore')
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.lifecycle.restore(user.id, companyId, contractId);
  }

  @Get(':contractId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.contractService.get(user.id, companyId, contractId);
  }

  @Get(':contractId/parties')
  listParties(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.contractService.listParties(user.id, companyId, contractId);
  }

  @Get(':contractId/status-history')
  listStatusHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractStatusHistoryRequestDto,
  ) {
    return this.contractService.listStatusHistory(
      user.id,
      companyId,
      contractId,
      query,
    );
  }

  @Get(':contractId/party-invitations')
  listPartyInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.lifecycle.listPartyInvitations(
      user.id,
      companyId,
      contractId,
    );
  }

  @Post(':contractId/party-invitations')
  inviteCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: CreateContractPartyInvitationRequestDto,
  ) {
    return this.lifecycle.inviteCompany(
      user.id,
      companyId,
      contractId,
      body,
    );
  }

  @Delete(':contractId/party-invitations/:invitationId')
  revokeCompanyInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.lifecycle.revokeCompanyInvitation(
      user.id,
      companyId,
      contractId,
      invitationId,
    );
  }

  @Get(':contractId/role-assignments')
  listRoleAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.list(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Get(':contractId/role-management')
  roleManagementPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.managementPermissions(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Get(':contractId/role-assignment-members')
  listRoleAssignmentMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.listEligibleMembers(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Post(':contractId/role-assignments')
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
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

  @Delete(':contractId/role-assignments/:assignmentId')
  revokeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.roleAssignments.revoke(
      user.id,
      companyId,
      contractId,
      assignmentId,
    );
  }

  @Patch(':contractId/role-assignments/:assignmentId/workspace-admin')
  setWorkspaceAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
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

  @Get(':contractId/role-invitations')
  listRoleInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractRoleAssignmentsRequestDto,
  ) {
    return this.roleAssignments.listInvitations(
      user.id,
      companyId,
      contractId,
      query.workspace,
    );
  }

  @Post(':contractId/role-invitations')
  inviteContractRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
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

  @Delete(':contractId/role-invitations/:invitationId')
  revokeRoleInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
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
