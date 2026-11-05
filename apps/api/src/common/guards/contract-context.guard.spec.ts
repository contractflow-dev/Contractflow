import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContractContextGuard } from './contract-context.guard';
import type { AuthenticatedRequest } from './session-auth.guard';

const contractId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('ContractContextGuard', () => {
  const guard = new ContractContextGuard();
  let request: Partial<AuthenticatedRequest>;

  function executionContext(): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    request = {
      headers: { 'x-contract-id': contractId },
      params: {},
      query: {},
    };
  });

  it('accepts the header and stores the contract id', () => {
    expect(guard.canActivate(executionContext())).toBe(true);
    expect(request.contractId).toBe(contractId);
  });

  it('trims the header value', () => {
    request.headers = { 'x-contract-id': `  ${contractId} ` };
    expect(guard.canActivate(executionContext())).toBe(true);
    expect(request.contractId).toBe(contractId);
  });

  it('rejects a contractId query parameter', () => {
    request.query = { contractId };
    expect(() => guard.canActivate(executionContext())).toThrow(
      BadRequestException,
    );
  });

  it('rejects a contractId route parameter', () => {
    request.params = { contractId };
    expect(() => guard.canActivate(executionContext())).toThrow(
      'Contract context must be supplied through the X-Contract-Id header.',
    );
  });

  it('requires the header', () => {
    request.headers = {};
    expect(() => guard.canActivate(executionContext())).toThrow(
      'X-Contract-Id header is required.',
    );
  });

  it('rejects a header that is not a ULID', () => {
    request.headers = { 'x-contract-id': 'contract-1' };
    expect(() => guard.canActivate(executionContext())).toThrow(
      'X-Contract-Id must be a valid ULID.',
    );
  });
});
