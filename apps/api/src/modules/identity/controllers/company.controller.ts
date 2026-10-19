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
import type { AuthenticatedUser } from '../services/auth.service';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import { CompanyService } from '../services/company.service';
import { CompanyAdminService } from '../services/company-admin.service';
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
  getMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ) {
    return this.companyService.getMembership(user.id, companyId);
  }

  @Get(':companyId/dashboard')
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ) {
    return this.companyService.getDashboard(user.id, companyId);
  }

  @Patch(':companyId/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Body() body: UpdateCompanyProfileRequestDto,
  ) {
    return this.companyAdminService.updateCompanyProfile(
      user.id,
      companyId,
      body,
    );
  }

  @Get(':companyId/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Query() query: ListCompanyMembersRequestDto,
  ) {
    return this.companyAdminService.listMembers(user.id, companyId, query);
  }

  @Patch(':companyId/members/:membershipId/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
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
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.companyAdminService.removeMember(
      user.id,
      companyId,
      membershipId,
    );
  }

  @Get(':companyId/invitations')
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Query() query: ListCompanyInvitationsRequestDto,
  ) {
    return this.companyAdminService.listInvitations(
      user.id,
      companyId,
      query.page,
      query.limit,
    );
  }

  @Post(':companyId/invitations')
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Body() body: InviteCompanyMemberRequestDto,
  ) {
    return this.companyAdminService.inviteMember(user.id, companyId, body);
  }

  @Post(':companyId/invitations/:invitationId/revoke')
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.companyAdminService.revokeInvitation(
      user.id,
      companyId,
      invitationId,
    );
  }
}
