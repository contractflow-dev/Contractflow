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

  it('sets the session cookie while returning only the user body', async () => {
    const body = Object.assign(new LoginAppUserDto(), {
      email: 'user@example.com',
      password: 'StrongPassword123!',
    });
    const request = {
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;

    const result = await controller.login(body, request, response);

    expect(result).toEqual({ user: { id: 'user-id' } });
    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringMatching(
        /^contractflow_session=session-token; HttpOnly; Path=\/; SameSite=Lax; Max-Age=\d+; Secure$/,
      ),
    );
  });

  it('revokes the request session and clears its cookie on logout', async () => {
    const request = {
      headers: { cookie: 'other=value; contractflow_session=session-token' },
    } as Request;
    const response = { setHeader } as unknown as Response;

    await expect(controller.logout(request, response)).resolves.toEqual({
      success: true,
      message: 'You have been signed out.',
    });

    expect(authService.logout).toHaveBeenCalledWith('session-token');
    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      'contractflow_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure',
    );
  });
});
