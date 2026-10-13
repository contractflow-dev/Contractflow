import {
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, RequestMetadata } from '../services/auth.service';
import { AppUserResponseDto } from '../dto/app-user/responses/app-user-resonse.dto';
import { CreateAppUserRequestDto } from '../dto/app-user/requests/create-app-user-request.dto';
import { LoginAppUserDto } from '../dto/app-user/requests/login-app-user-request.dto';
import { VerifyEmailRequestDto } from '../dto/auth/verify-email-request.dto';
import { ResendVerificationRequestDto } from '../dto/auth/resend-verification-request.dto';
import { Public } from '../../../common/decorators/public.decorator';

function requestMetadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? '',
  };
}

function sessionToken(request: Request, cookieName: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  const cookie = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1);
}

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: CreateAppUserRequestDto): Promise<{ message: string }> {
    return this.authService.register(body);
  }

  @Post('login')
  async login(
    @Body() body: LoginAppUserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AppUserResponseDto }> {
    const result = await this.authService.login(body, requestMetadata(request));
    response.setHeader('Set-Cookie', result.cookie);
    return { user: result.user };
  }

  @Post('verify-email')
  verifyEmail(
    @Body() body: VerifyEmailRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  resendVerification(
    @Body() body: ResendVerificationRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerification(body.email);
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true; message: string }> {
    const cookieName = this.authService.sessionCookieName();
    await this.authService.logout(sessionToken(request, cookieName));
    response.setHeader('Set-Cookie', this.authService.clearSessionCookie());
    return { success: true, message: 'You have been signed out.' };
  }
}
