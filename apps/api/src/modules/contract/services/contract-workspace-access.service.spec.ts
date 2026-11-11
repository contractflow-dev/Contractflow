import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ECompanyRole,
  EContractorContractRole,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IContractRoleAssignmentRepositories } from '../interfaces/contract-role-assignment-persistence.interface';
import type { ContractAccessService } from './contract-access.service';
import { ContractWorkspaceAccessService } from './contract-workspace-access.service';

describe('ContractWorkspaceAccessService', () => {
  let access: { authorize: ReturnType<typeof vi.fn> };
  let persistence: {
    memberships: { findActiveMember: ReturnType<typeof vi.fn> };
    parties: { findByContractAndCompany: ReturnType<typeof vi.fn> };
    contracts: { findActive: ReturnType<typeof vi.fn> };
    workspaces: { listEnabled: ReturnType<typeof vi.fn> };
    assignments: { listActiveForMember: ReturnType<typeof vi.fn> };
  };
  let service: ContractWorkspaceAccessService;
  const member = {
    id: 'm1',
    userId: 'u1',
    companyId: 'co1',
    companyRole: ECompanyRole.MEMBER,
  };

  beforeEach(() => {
    access = {
      authorize: vi
        .fn()
        .mockResolvedValue({ contractId: 'c1', companyId: 'co1' }),
    };
    persistence = {
      memberships: { findActiveMember: vi.fn().mockResolvedValue(member) },
      parties: {
        findByContractAndCompany: vi.fn().mockResolvedValue({ id: 'p1' }),
      },
      contracts: { findActive: vi.fn().mockResolvedValue({ id: 'c1' }) },
      workspaces: {
        listEnabled: vi.fn().mockResolvedValue(['finance', 'project']),
      },
      assignments: {
        listActiveForMember: vi
          .fn()
          .mockResolvedValue([
            {
              role: EContractorContractRole.FINANCE_OFFICER,
              isWorkspaceAdmin: true,
            },
          ]),
      },
    };
    service = new ContractWorkspaceAccessService(
      access as unknown as ContractAccessService,
      persistence as unknown as IContractRoleAssignmentRepositories,
    );
  });

  it('lists enabled workspaces in a fixed order with the caller’s own roles', async () => {
    await expect(service.listForUser('u1', 'co1', 'c1')).resolves.toEqual({
      workspaces: [
        {
          workspace: 'project',
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
        {
          workspace: 'finance',
          hasAccess: true,
          roles: [EContractorContractRole.FINANCE_OFFICER],
          isWorkspaceAdmin: true,
          canManageTeam: true,
        },
      ],
    });
    expect(persistence.assignments.listActiveForMember).toHaveBeenCalledWith(
      'co1',
      'p1',
      'm1',
    );
  });

  it('refuses a non-member before reading anything else', async () => {
    persistence.memberships.findActiveMember.mockResolvedValue(null);
    await expect(service.listForUser('u1', 'co1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(persistence.parties.findByContractAndCompany).not.toHaveBeenCalled();
    expect(persistence.assignments.listActiveForMember).not.toHaveBeenCalled();
  });

  it('treats a missing party or archived contract as not found', async () => {
    persistence.parties.findByContractAndCompany.mockResolvedValue(null);
    await expect(service.listForUser('u1', 'co1', 'c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    persistence.parties.findByContractAndCompany.mockResolvedValue({
      id: 'p1',
    });
    persistence.contracts.findActive.mockResolvedValue(null);
    await expect(service.listForUser('u1', 'co1', 'c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('opens one workspace only through ContractAccessService.authorize', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());
    await expect(
      service.getForUser('u1', 'co1', 'c1', 'hse'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.authorize).toHaveBeenCalledWith('u1', 'co1', 'c1', 'hse');
    expect(persistence.assignments.listActiveForMember).not.toHaveBeenCalled();
  });

  it('never lets Company Administrator rights stand in for a role', async () => {
    persistence.memberships.findActiveMember.mockResolvedValue({
      ...member,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    persistence.assignments.listActiveForMember.mockResolvedValue([]);
    const { workspaces } = await service.listForUser('u1', 'co1', 'c1');
    expect(
      workspaces.every((entry) => !entry.hasAccess && !entry.canManageTeam),
    ).toBe(true);
  });
});
