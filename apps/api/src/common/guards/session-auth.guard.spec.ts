import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService, AuthenticatedUser } from '../../modules/identity/services/auth.service';
import type { AuthenticatedRequest } from './session-auth.guard';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  const user: AuthenticatedUser = {
    id: '01JUSER0000000000000000000',
    email: 'user@example.com',
    emailVerifiedAt: new Date(),
  };
  const reflector = {
    getAllAndOverride: vi.fn<
      (key: string, targets: unknown[]) => boolean
    >(),
  };
  const authService = {
    sessionCookieName: vi.fn(() => 'contractflow_session'),
    authenticate: vi.fn(),
  };
  const guard = new SessionAuthGuard(
    authService as unknown as AuthService,
    reflector as unknown as Reflector,
  );

  function contextWithCookie(cookie?: string): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request = { headers: { cookie } } as AuthenticatedRequest;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset().mockReturnValue(false);
    authService.authenticate.mockReset();
  });

  it('allows routes marked public without requiring a session cookie', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = contextWithCookie();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('rejects requests without a session cookie', async () => {
    const { context } = contextWithCookie();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('authenticates the session and attaches its user to the request', async () => {
    authService.authenticate.mockResolvedValue({
      user,
      sessionId: '01JSESSION000000000000000000',
    });
    const { context, request } = contextWithCookie(
      'other=value; contractflow_session=session-token',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.authenticate).toHaveBeenCalledWith('session-token');
    expect(request.user).toEqual(user);
    expect(request.sessionId).toBe('01JSESSION000000000000000000');
  });
});
