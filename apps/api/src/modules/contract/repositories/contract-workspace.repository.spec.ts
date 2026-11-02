import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractWorkspaceRepository } from './contract-workspace.repository';

describe('ContractWorkspaceRepository', () => {
  const workspaces = { exists: vi.fn() };
  const parties = { exists: vi.fn() };
  let repository: ContractWorkspaceRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    parties.exists.mockResolvedValue(true);
    workspaces.exists.mockResolvedValue(true);
    repository = new ContractWorkspaceRepository(
      workspaces as never,
      parties as never,
    );
  });

  it('requires explicit company and contract scope', async () => {
    await expect(
      repository.exists({ contractId: 'c1' }, 'finance'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(parties.exists).not.toHaveBeenCalled();
  });

  it('checks party membership before querying the workspace', async () => {
    parties.exists.mockResolvedValue(false);

    await expect(
      repository.exists(
        { contractId: 'c1', companyId: 'co1' },
        'finance',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(workspaces.exists).not.toHaveBeenCalled();
  });

  it('queries a workspace only within the validated contract scope', async () => {
    await expect(
      repository.exists(
        { contractId: 'c1', companyId: 'co1' },
        'finance',
      ),
    ).resolves.toBe(true);
    expect(parties.exists).toHaveBeenCalledWith({
      where: { contractId: 'c1', companyId: 'co1' },
    });
    expect(workspaces.exists).toHaveBeenCalledWith({
      where: { contractId: 'c1', workspace: 'finance' },
    });
  });
});
