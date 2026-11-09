import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import {
  ContractPartyInvitationTokenRequestDto,
  RespondContractPartyInvitationRequestDto,
  RespondIncomingContractInvitationRequestDto,
} from '../dto/contract-party-invitation.dto';
import { ContractLifecycleService } from '../services/contract-lifecycle.service';

@Controller()
export class ContractPartyInvitationController {
  constructor(private readonly lifecycle: ContractLifecycleService) {}

  @Public()
  @Post('contract-party-invitations/preview')
  preview(@Body() body: ContractPartyInvitationTokenRequestDto) {
    return this.lifecycle.getCompanyInvitationPreview(body.token);
  }

  @Post('contract-party-invitations/respond')
  @UseGuards(CompanyContextGuard)
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: RespondContractPartyInvitationRequestDto,
  ) {
    return this.lifecycle.respondToCompanyInvitation(
      user.id,
      companyId,
      body.token,
      body.decision,
    );
  }

  /**
   * Invitations for the header company to join other companies' contracts.
   * Company Administrators only; the service checks the role.
   */
  @Get('company/contract-invitations')
  @UseGuards(CompanyContextGuard)
  listIncoming(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.lifecycle.listIncomingInvitations(user.id, companyId);
  }

  @Post('company/contract-invitations/:invitationId/respond')
  @UseGuards(CompanyContextGuard)
  respondIncoming(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('invitationId') invitationId: string,
    @Body() body: RespondIncomingContractInvitationRequestDto,
  ) {
    return this.lifecycle.respondToIncomingInvitation(
      user.id,
      companyId,
      invitationId,
      body.decision,
    );
  }
}
