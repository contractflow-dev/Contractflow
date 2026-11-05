import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (!request.user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Platform administrator privileges required.',
      );
    }

    return true;
  }
}
