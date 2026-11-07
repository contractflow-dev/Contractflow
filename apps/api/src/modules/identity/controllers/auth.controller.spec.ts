import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginAppUserDto } from '../dto/app-user/requests/login-app-user-request.dto';
import { AppUserResponseDto } from '../dto/app-user/responses/app-user-response.dto';
import type { AuthService } from '../services/auth/auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, ReturnType<typeof vi.fn>>;
  let config: { get: ReturnType<typeof vi.fn> };
  let setHeader: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authService = {
      login: vi.fn().mockResolvedValue({
        user: { id: 'user-id' } as AppUserResponseDto,
        sessionToken: 'session-token',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      sessionCookieName: vi.fn().mockReturnValue('contractflow_session'),
    };
    config = { get: vi.fn(() => 'production') };
    controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService,
    );
    setHeader = vi.fn();
  });

  function login() {
    const body = Object.assign(new LoginAppUserDto(), {
      email: 'user@example.com',
      password: 'StrongPassword123!',
    });
    const request = {
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
    } as unknown as Request;
    return controller.login(body, request, {
      setHeader,
    } as unknown as Response);
  }

  function logout() {
    const request = {
      headers: { cookie: 'other=value; contractflow_session=session-token' },
    } as Request;
    return controller.logout(request, { setHeader } as unknown as Response);
  }

  function useEnvironment(nodeEnv: string) {
    config.get.mockImplementation((key: string) =>
      key === 'NODE_ENV' ? nodeEnv : undefined,
    );
  }

  it('sets the session cookie while returning only the user body', async () => {
    const result = await login();

    expect(result).toEqual({ user: { id: 'user-id' } });
    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringMatching(/^contractflow_session=session-token; HttpOnly; /),
    );
  });

  it('revokes the request session and clears its cookie on logout', async () => {
    await expect(logout()).resolves.toEqual({
      success: true,
      message: 'You have been signed out.',
    });

    expect(authService.logout).toHaveBeenCalledWith('session-token');
    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringMatching(/^contractflow_session=; HttpOnly; .*Max-Age=0/),
    );
  });

  describe('in production, where the web app and API are different sites', () => {
    beforeEach(() => useEnvironment('production'));

    it('sends the session cookie cross-site, and only over HTTPS', async () => {
      await login();

      expect(setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringMatching(
          /^contractflow_session=session-token; HttpOnly; Path=\/; SameSite=None; Max-Age=\d+; Secure$/,
        ),
      );
    });

    it('clears the cookie with the same attributes it was set with', async () => {
      await logout();

      expect(setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        'contractflow_session=; HttpOnly; Path=/; SameSite=None; Max-Age=0; Secure',
      );
    });
  });

  describe.each(['development', 'test'])(
    'in %s, where the web app and API share localhost over HTTP',
    (nodeEnv) => {
      beforeEach(() => useEnvironment(nodeEnv));

      it('keeps the session cookie same-site and usable without HTTPS', async () => {
        await login();

        expect(setHeader).toHaveBeenCalledWith(
          'Set-Cookie',
          expect.stringMatching(
            /^contractflow_session=session-token; HttpOnly; Path=\/; SameSite=Lax; Max-Age=\d+$/,
          ),
        );
      });

      it('clears the cookie with the same attributes it was set with', async () => {
        await logout();

        expect(setHeader).toHaveBeenCalledWith(
          'Set-Cookie',
          'contractflow_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
        );
      });
    },
  );

  it.each(['production', 'development'])(
    'never sends SameSite=None without Secure (%s)',
    async (nodeEnv) => {
      useEnvironment(nodeEnv);
      await login();
      await logout();

      for (const [, cookie] of setHeader.mock.calls as [string, string][]) {
        if (cookie.includes('SameSite=None')) {
          expect(cookie).toMatch(/; Secure$/);
        }
      }
    },
  );
});
