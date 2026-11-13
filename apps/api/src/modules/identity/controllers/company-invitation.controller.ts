import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../interface/auth-context.interface';
import { RespondCompanyInvitationRequestDto } from '../dto/company/requests/respond-company-invitation-request.dto';
import { RespondMyCompanyInvitationRequestDto } from '../dto/company/requests/respond-my-company-invitation-request.dto';
import { CompanyInvitationTokenRequestDto } from '../dto/company/requests/company-invitation-token-request.dto';
import { CompanyAdminService } from '../services/company/company-admin.service';

/**
 * The invitee's side of company invitations. None of these routes use
 * CompanyContextGuard: an invitee isn't a member of the inviting company yet,
 * and the invitation itself names the company and role.
 */
@Controller('invitations')
export class CompanyInvitationController {
  constructor(private readonly companyAdminService: CompanyAdminService) {}

  @Public()
  @Post('preview')
  getInvitation(@Body() body: CompanyInvitationTokenRequestDto) {
    return this.companyAdminService.getInvitationByToken(body.token);
  }

  @Post('respond')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RespondCompanyInvitationRequestDto,
  ) {
    return this.companyAdminService.respondToInvitation(
      user.id,
      user.email,
      Boolean(user.emailVerifiedAt),
      body.token,
      body.decision,
    );
  }

  /** The signed-in user's pending invitations, by their verified email. */
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.companyAdminService.listMyInvitations(
      user.email,
      Boolean(user.emailVerifiedAt),
    );
  }

  @Post(':invitationId/respond')
  respondToMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId') invitationId: string,
    @Body() body: RespondMyCompanyInvitationRequestDto,
  ) {
    return this.companyAdminService.respondToMyInvitation(
      user.id,
      user.email,
      Boolean(user.emailVerifiedAt),
      invitationId,
      body.decision,
    );
  }
}
