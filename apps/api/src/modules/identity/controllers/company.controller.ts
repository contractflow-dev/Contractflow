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
import { Public } from '../../../common/decorators/public.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import type { AuthenticatedUser } from '../interface/auth-context.interface';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import { CompanyService } from '../services/company/company.service';
import { CompanyAdminService } from '../services/company/company-admin.service';
import { CompanyVerificationService } from '../services/company/company-verification.service';
import { VerifyCompanyEmailRequestDto } from '../dto/company/requests/verify-company-email-request.dto';
import { ListCompanyMembersRequestDto } from '../dto/company/requests/list-company-members-request.dto';
import { InviteCompanyMemberRequestDto } from '../dto/company/requests/invite-company-member-request.dto';
import { UpdateCompanyMemberRoleRequestDto } from '../dto/company/requests/update-company-member-role-request.dto';
import { UpdateCompanyProfileRequestDto } from '../dto/company/requests/update-company-profile-request.dto';
import { ListCompanyInvitationsRequestDto } from '../dto/company/requests/list-company-invitations-request.dto';

@Controller()
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly companyAdminService: CompanyAdminService,
    private readonly companyVerification: CompanyVerificationService,
  ) {}

  @Post('companies')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompanyRequestDto,
  ) {
    return this.companyService.create(user.id, body);
  }

  @Get('companies')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.listForUser(user.id);
  }

  @Get('companies/access-summary')
  getAccessSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getAccessSummary(
      user.id,
      user.email,
      Boolean(user.emailVerifiedAt),
    );
  }

  // Public: the link may be opened by whoever reads the company inbox, in a
  // browser that isn't signed in. The one-time token is the proof.
  @Public()
  @Post('companies/verify-email')
  verifyEmail(@Body() body: VerifyCompanyEmailRequestDto) {
    return this.companyVerification.verify(body.token);
  }

  @Get('companies/current')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getCurrent(user.id);
  }

  @Get('company/membership')
  @UseGuards(CompanyContextGuard)
  getMembership(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.companyService.getMembership(user.id, companyId);
  }

  @Get('company/dashboard')
  @UseGuards(CompanyContextGuard)
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.companyService.getDashboard(user.id, companyId);
  }

  @Patch('company/profile')
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

  @Post('company/verification-email')
  @UseGuards(CompanyContextGuard)
  resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.companyVerification.resend(user.id, companyId);
  }

  @Get('company/members')
  @UseGuards(CompanyContextGuard)
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListCompanyMembersRequestDto,
  ) {
    return this.companyAdminService.listMembers(user.id, companyId, query);
  }

  @Patch('company/members/:membershipId/role')
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

  @Delete('company/members/:membershipId')
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

  @Get('company/invitations')
  @UseGuards(CompanyContextGuard)
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: ListCompanyInvitationsRequestDto,
  ) {
    return this.companyAdminService.listInvitations(user.id, companyId, query);
  }

  @Post('company/invitations')
  @UseGuards(CompanyContextGuard)
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: InviteCompanyMemberRequestDto,
  ) {
    return this.companyAdminService.inviteMember(user.id, companyId, body);
  }

  @Post('company/invitations/:invitationId/revoke')
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

  @Post('company/invitations/:invitationId/resend')
  @UseGuards(CompanyContextGuard)
  resendInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.companyAdminService.resendInvitation(
      user.id,
      companyId,
      invitationId,
    );
  }
}
