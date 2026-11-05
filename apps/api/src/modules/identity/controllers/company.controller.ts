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
import type { AuthenticatedUser } from '../interface/auth-context.interface';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import { CompanyService } from '../services/company/company.service';
import { CompanyAdminService } from '../services/company/company-admin.service';
import { ListCompanyMembersRequestDto } from '../dto/company/requests/list-company-members-request.dto';
import { InviteCompanyMemberRequestDto } from '../dto/company/requests/invite-company-member-request.dto';
import { UpdateCompanyMemberRoleRequestDto } from '../dto/company/requests/update-company-member-role-request.dto';
import { UpdateCompanyProfileRequestDto } from '../dto/company/requests/update-company-profile-request.dto';
import { ListCompanyInvitationsRequestDto } from '../dto/company/requests/list-company-invitations-request.dto';

@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly companyAdminService: CompanyAdminService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompanyRequestDto,
  ) {
    return this.companyService.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.listForUser(user.id);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getCurrent(user.id);
  }

  @Get(':companyId/membership')
  @UseGuards(CompanyContextGuard)
  getMembership(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.companyService.getMembership(user.id, companyId);
  }

  @Get(':companyId/dashboard')
  @UseGuards(CompanyContextGuard)
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.companyService.getDashboard(user.id, companyId);
  }

  @Patch(':companyId/profile')
  @UseGuards(CompanyContextGuard)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: UpdateCompanyProfileRequestDto,
  ) {
    return this.companyAdminService.updateCompanyProfile(
      user.id,
      companyId,
      body,
    );
  }

  @Get(':companyId/members')
  @UseGuards(CompanyContextGuard)
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListCompanyMembersRequestDto,
  ) {
    return this.companyAdminService.listMembers(user.id, companyId, query);
  }

  @Patch(':companyId/members/:membershipId/role')
  @UseGuards(CompanyContextGuard)
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateCompanyMemberRoleRequestDto,
  ) {
    return this.companyAdminService.updateMemberRole(
      user.id,
      companyId,
      membershipId,
      body,
    );
  }

  @Delete(':companyId/members/:membershipId')
  @UseGuards(CompanyContextGuard)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.companyAdminService.removeMember(
      user.id,
      companyId,
      membershipId,
    );
  }

  @Get(':companyId/invitations')
  @UseGuards(CompanyContextGuard)
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListCompanyInvitationsRequestDto,
  ) {
    return this.companyAdminService.listInvitations(user.id, companyId, query);
  }

  @Post(':companyId/invitations')
  @UseGuards(CompanyContextGuard)
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: InviteCompanyMemberRequestDto,
  ) {
    return this.companyAdminService.inviteMember(user.id, companyId, body);
  }

  @Post(':companyId/invitations/:invitationId/revoke')
  @UseGuards(CompanyContextGuard)
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.companyAdminService.revokeInvitation(
      user.id,
      companyId,
      invitationId,
    );
  }
}
