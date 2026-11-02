import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/session-auth.guard';

export const CurrentCompanyId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.companyContext) {
      throw new InternalServerErrorException(
        'Company context guard did not populate the request context.',
      );
    }
    return request.companyContext.companyId;
  },
);
