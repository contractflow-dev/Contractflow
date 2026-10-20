import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../services/auth.service';
import { RespondCompanyInvitationRequestDto } from '../dto/company/requests/respond-company-invitation-request.dto';
import { CompanyInvitationTokenRequestDto } from '../dto/company/requests/company-invitation-token-request.dto';
import { CompanyAdminService } from '../services/company-admin.service';

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
}
