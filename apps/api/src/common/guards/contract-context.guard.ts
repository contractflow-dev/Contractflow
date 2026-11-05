import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard';

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/**
 * Requires contract context through the X-Contract-Id header. Apply it only to
 * routes that act on one contract, after CompanyContextGuard. This establishes
 * which contract is addressed; access is still decided by
 * ContractAccessService in the service layer.
 */
@Injectable()
export class ContractContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      request.query.contractId !== undefined ||
      request.params.contractId !== undefined
    ) {
      throw new BadRequestException(
        'Contract context must be supplied through the X-Contract-Id header.',
      );
    }

    const header = request.headers['x-contract-id'];
    if (typeof header !== 'string' || !header.trim()) {
      throw new BadRequestException('X-Contract-Id header is required.');
    }
    const contractId = header.trim();
    if (!ULID_PATTERN.test(contractId)) {
      throw new BadRequestException('X-Contract-Id must be a valid ULID.');
    }

    request.contractId = contractId;
    return true;
  }
}
