import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import {
  ContractPartyInvitationTokenRequestDto,
  RespondContractPartyInvitationRequestDto,
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

  @Post('companies/:companyId/contract-party-invitations/respond')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Body() body: RespondContractPartyInvitationRequestDto,
  ) {
    return this.lifecycle.respondToCompanyInvitation(
      user.id,
      companyId,
      body.token,
      body.decision,
    );
  }
}
