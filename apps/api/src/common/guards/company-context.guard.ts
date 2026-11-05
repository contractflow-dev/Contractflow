import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard';
import { CompanyScopeService } from '../../modules/identity/services/company/company-scope.service';

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

@Injectable()
export class CompanyContextGuard implements CanActivate {
  constructor(private readonly companyScope: CompanyScopeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const header = request.headers['x-company-id'];
    if (typeof header !== 'string' || !header.trim()) {
      throw new BadRequestException('X-Company-Id header is required.');
    }
    const companyId = header.trim();
    if (!ULID_PATTERN.test(companyId)) {
      throw new BadRequestException('X-Company-Id must be a valid ULID.');
    }

    if (
      request.query.companyId !== undefined ||
      request.params.companyId !== undefined
    ) {
      throw new BadRequestException(
        'Company context must be supplied through the X-Company-Id header.',
      );
    }

    request.companyContext = await this.companyScope.contextForUser(
      request.user.id,
      companyId,
    );
    return true;
  }
}
