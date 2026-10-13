import { Controller, Get } from '@nestjs/common';
import type { IGetAppUserResponse } from '@contractflow/contracts-schema';
import { AppUserService } from '../services/app-user.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../../common/guards/session-auth.guard';

@Controller('users')
export class AppUserController {
  constructor(private readonly appUserService: AppUserService) {}

  @Get('me')
  getMyProfile(
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<IGetAppUserResponse> {
    return this.appUserService.findById(user.id);
  }
}
