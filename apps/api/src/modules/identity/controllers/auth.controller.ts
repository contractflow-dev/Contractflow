import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth/auth.service';
import type { RequestMetadata } from '../interface/auth-context.interface';
import { CreateAppUserRequestDto } from '../dto/app-user/requests/create-app-user-request.dto';
import { LoginAppUserDto } from '../dto/app-user/requests/login-app-user-request.dto';
import { VerifyEmailRequestDto } from '../dto/auth/verify-email-request.dto';
import { ResendVerificationRequestDto } from '../dto/auth/resend-verification-request.dto';
import { Public } from '../../../common/decorators/public.decorator';
import type {
  AuthMessageResponse,
  AuthResponse,
  LogoutResponse,
} from '@contractflow/contracts-schema';

function requestMetadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? '',
  };
}

function sessionToken(
  request: Request,
  cookieName: string,
): string | undefined {
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
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(
    @Body() body: CreateAppUserRequestDto,
  ): Promise<AuthMessageResponse> {
    return this.authService.register(body);
  }

  @Post('login')
  async login(
    @Body() body: LoginAppUserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(body, requestMetadata(request));
    response.setHeader(
      'Set-Cookie',
      this.sessionCookie(result.sessionToken, result.expiresAt),
    );
    return { user: result.user };
  }

  @Post('verify-email')
  verifyEmail(
    @Body() body: VerifyEmailRequestDto,
  ): Promise<AuthMessageResponse> {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  resendVerification(
    @Body() body: ResendVerificationRequestDto,
  ): Promise<AuthMessageResponse> {
    return this.authService.resendVerification(body.email);
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponse> {
    const cookieName = this.authService.sessionCookieName();
    await this.authService.logout(sessionToken(request, cookieName));
    // Clearing only works when the attributes match the ones it was set with.
    response.setHeader(
      'Set-Cookie',
      this.sessionCookieHeader(cookieName, '', 0),
    );
    return { success: true, message: 'You have been signed out.' };
  }

  private sessionCookie(sessionToken: string, expiresAt: Date): string {
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return this.sessionCookieHeader(
      this.authService.sessionCookieName(),
      sessionToken,
      maxAge,
    );
  }

  /**
   * In production the web app and API are on different onrender.com
   * subdomains. onrender.com is a public suffix, so they are different sites
   * and the cookie must be SameSite=None, which browsers only accept with
   * Secure. Locally both run on localhost (the same site) over plain HTTP, so
   * Lax without Secure is used.
   */
  private sessionCookieHeader(
    name: string,
    value: string,
    maxAge: number,
  ): string {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const sameSite = production ? 'None' : 'Lax';
    const secure = production ? '; Secure' : '';
    return `${name}=${value}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`;
  }
}
