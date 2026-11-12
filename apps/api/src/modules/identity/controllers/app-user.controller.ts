import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import type {
  AuthMessageResponse,
  IGetAppUserResponse,
} from '@contractflow/contracts-schema';
import { AppUserService } from '../services/app-user/app-user.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentSessionId } from '../../../common/decorators/current-session-id.decorator';
import type { AuthenticatedRequest } from '../../../common/guards/session-auth.guard';
import { UpdateAppUserRequestDto } from '../dto/app-user/requests/update-app-user-request.dto';
import { ChangePasswordRequestDto } from '../dto/app-user/requests/change-password-request.dto';

/** The signed-in user's own account. Nobody else's account is reachable here. */
@Controller('users')
export class AppUserController {
  constructor(private readonly appUserService: AppUserService) {}

  @Get('me')
  getMyProfile(
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<IGetAppUserResponse> {
    return this.appUserService.getProfile(user.id);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: UpdateAppUserRequestDto,
  ): Promise<IGetAppUserResponse> {
    return this.appUserService.updateProfile(user.id, body);
  }

  @Post('me/password')
  @HttpCode(200)
  changeMyPassword(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @CurrentSessionId() sessionId: string,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<AuthMessageResponse> {
    return this.appUserService.changePassword(user.id, sessionId, body);
  }
}
