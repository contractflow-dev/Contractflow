import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from './session-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  function createContext(user?: AuthenticatedRequest['user']): ExecutionContext {
    const request = { user } as AuthenticatedRequest;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('rejects unauthenticated requests with UnauthorizedException', () => {
    const context = createContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Authentication required.');
  });

  it('rejects non-platform-admin users with ForbiddenException', () => {
    const context = createContext({
      id: '01JUSER0000000000000000000',
      email: 'member@company.com',
      emailVerifiedAt: new Date(),
      isPlatformAdmin: false,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Platform administrator privileges required.');
  });

  it('rejects company administrators if they lack platform admin privileges', () => {
    const context = createContext({
      id: '01JUSERCOMPANYADMIN0000000',
      email: 'admin@company.com',
      emailVerifiedAt: new Date(),
      isPlatformAdmin: false,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Platform administrator privileges required.');
  });

  it('grants access to authorized platform administrators', () => {
    const context = createContext({
      id: '01JPLATFORMADMIN0000000000',
      email: 'platform.admin@contractflow.com',
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
