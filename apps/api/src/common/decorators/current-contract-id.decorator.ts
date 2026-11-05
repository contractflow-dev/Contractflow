import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/session-auth.guard';

export const CurrentContractId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.contractId) {
      throw new InternalServerErrorException(
        'Contract context guard did not populate the request context.',
      );
    }
    return request.contractId;
  },
);
