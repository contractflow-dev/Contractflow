import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ICompanyRequestContext } from '../../modules/identity/interface/company-request-context.interface';
import { CompanyScopeService } from '../../modules/identity/services/company/company-scope.service';
import { CompanyContextGuard } from './company-context.guard';
import type { AuthenticatedRequest } from './session-auth.guard';

const companyId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const context: ICompanyRequestContext = {
  companyId,
  companyStatus: ECompanyStatus.ACTIVE,
  membership: {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    companyId,
    companyRole: ECompanyRole.COMPANY_ADMIN,
    status: ECompanyUserStatus.ACTIVE,
  },
};

describe('CompanyContextGuard', () => {
  const companyScope = {
    contextForUser: vi.fn(),
  };
  let guard: CompanyContextGuard;
  let request: Partial<AuthenticatedRequest>;

  function executionContext(): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    companyScope.contextForUser.mockResolvedValue(context);
    request = {
      user: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        email: 'admin@example.com',
        emailVerifiedAt: new Date(),
        isPlatformAdmin: false,
      },
      headers: { 'x-company-id': companyId },
      params: {},
      query: {},
    };
    guard = new CompanyContextGuard(
      companyScope as unknown as CompanyScopeService,
    );
  });

  it('requires an authenticated request and company header', async () => {
    request.user = undefined;
    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    request.user = {
      id: context.membership.id,
      email: 'admin@example.com',
      emailVerifiedAt: new Date(),
      isPlatformAdmin: false,
    };
    request.headers = {};
    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects malformed or conflicting company context', async () => {
    request.headers = { 'x-company-id': 'not-a-ulid' };
    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    request.headers = { 'x-company-id': companyId };
    request.params = { companyId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' };
    request.query = { companyId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' };
    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // Company IDs never travel in the path, even when they match the header.
    request.query = {};
    request.params = { companyId };
    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(companyScope.contextForUser).not.toHaveBeenCalled();
  });

  it('authorizes through membership scope and attaches the validated context', async () => {
    request.params = {};

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);

    expect(companyScope.contextForUser).toHaveBeenCalledWith(
      context.membership.id,
      companyId,
    );
    expect(request.companyContext).toBe(context);
  });

  it('propagates denied membership authorization', async () => {
    companyScope.contextForUser.mockRejectedValue(
      new ForbiddenException('Active company membership is required'),
    );

    await expect(guard.canActivate(executionContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request.companyContext).toBeUndefined();
  });
});
