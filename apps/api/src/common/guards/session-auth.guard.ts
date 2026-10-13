import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../../modules/identity/services/auth.service';
import type { AuthenticatedUser } from '../../modules/identity/services/auth.service';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  sessionId: string;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieHeader = request.headers.cookie;
    const cookieName = this.authService.sessionCookieName();
    const sessionCookie = cookieHeader
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${cookieName}=`));
    const sessionToken = sessionCookie?.slice(cookieName.length + 1);

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication required.');
    }

    const session = await this.authService.authenticate(sessionToken);
    request.user = session.user;
    request.sessionId = session.sessionId;
    return true;
  }
}
