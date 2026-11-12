import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/session-auth.guard';

/** The id of the session the request was authenticated with (SessionAuthGuard). */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().sessionId,
);
