import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import {
  ContractRoleInvitationTokenRequestDto,
  RespondContractRoleInvitationRequestDto,
} from '../dto/contract-role-assignment.dto';
import { ContractRoleAssignmentService } from '../services/contract-role-assignment.service';

@Controller('contract-role-invitations')
export class ContractRoleInvitationController {
  constructor(
    private readonly roleAssignments: ContractRoleAssignmentService,
  ) {}

  @Public()
  @Post('preview')
  preview(@Body() body: ContractRoleInvitationTokenRequestDto) {
    return this.roleAssignments.previewInvitation(body.token);
  }

  @Post('respond')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RespondContractRoleInvitationRequestDto,
  ) {
    return this.roleAssignments.respondToInvitation(
      user.id,
      user.email,
      Boolean(user.emailVerifiedAt),
      body.token,
      body.decision,
    );
  }
}
