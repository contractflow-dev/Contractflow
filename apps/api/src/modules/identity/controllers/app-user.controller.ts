import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { IGetAppUserResponse } from '@contractflow/contracts-schema';
import { AppUserService } from '../services/app-user.service';
import { GetAppUserDto } from '../dto/app-user/requests/get-app-user-request.dto';
// import { CurrentUser } from '../../../common/decorators/current-user.decorator';
// import { jwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('users')
// @UseGuards(jwtAuthGuard)
export class AppUserController {
  constructor(private readonly appUserService: AppUserService) {}

  @Get('me')
  getMyProfile(
    @Query() query: GetAppUserDto,
    // @CurrentUser() user: { id: string },
  ): Promise<IGetAppUserResponse> {
    return this.appUserService.findById(query.id);
  }
}

// interceptor to get the current user from the request and attach it to the request object
// middleware to get the current user from the request and attach it to the request object
// guards
// types
// have legend for user stories
// import decorators and guards from common module
