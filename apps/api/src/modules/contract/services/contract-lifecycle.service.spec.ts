import { ForbiddenException } from '@nestjs/common';
import {
  ECompanyStatus,
  ECompanyRole,
  ECompanyUserStatus,
  EContractType,
  EContractRole,
  EContractStatus,
  ECurrencyCode,
  EFromStatus,
  EPartyType,
  EToStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractLifecycleService } from './contract-lifecycle.service';

describe('ContractLifecycleService', () => {
  const contract = {
    id: 'contract-1',
    referenceNumber: 'CTR-001',
    status: EContractStatus.DRAFT,
    deletedAt: null,
  };
  const actor = {
    id: 'membership-1',
    userId: 'user-1',
    companyId: 'company-1',
    companyRole: ECompanyRole.FINANCE_OFFICER,
    status: ECompanyUserStatus.ACTIVE,
  };
  const party = {
    id: 'party-1',
    contractId: contract.id,
    companyId: actor.companyId,
    partyType: EPartyType.CONTRACTOR,
  };
  const repositories = new Map<
    unknown,
    Record<string, ReturnType<typeof vi.fn>>
  >();
  const assignmentQuery = {
    where: vi.fn(),
    andWhere: vi.fn(),
    setLock: vi.fn(),
    getOne: vi.fn(),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => repositories.get(entity)),
  };
  const dataSource = {
    manager,
    transaction: vi.fn(
      (callback: (transactionManager: typeof manager) => Promise<unknown>) =>
        callback(manager),
    ),
  };
  const mail = { sendContractPartyInvitationEmail: vi.fn() };
  let service: ContractLifecycleService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositories.clear();
    contract.status = EContractStatus.DRAFT;
    contract.deletedAt = null;
    manager.getRepository.mockImplementation((entity: unknown) =>
      repositories.get(entity),
    );
    assignmentQuery.where.mockReturnValue(assignmentQuery);
    assignmentQuery.andWhere.mockReturnValue(assignmentQuery);
    assignmentQuery.setLock.mockReturnValue(assignmentQuery);
    assignmentQuery.getOne.mockResolvedValue({
      id: 'assignment-1',
      role: EContractRole.CONTRACTOR_PROJECT_LEAD,
      revokedAt: null,
    });

    const contractRepository = {
      findOne: vi.fn().mockResolvedValue(contract),
      save: vi.fn(async (value) => value),
    };
    const companyUserRepository = {
      findOne: vi.fn().mockResolvedValue(actor),
    };
    const partyRepository = {
      findOne: vi.fn().mockResolvedValue(party),
    };
    const assignmentRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(assignmentQuery),
    };
    const historyRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    const activityRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };

    repositories.set(Contract, contractRepository);
    repositories.set(CompanyUser, companyUserRepository);
    repositories.set(ContractParty, partyRepository);
    repositories.set(ContractRoleAssignment, assignmentRepository);
    repositories.set(ContractStatusHistory, historyRepository);
    repositories.set(ActivityLog, activityRepository);

    service = new ContractLifecycleService(dataSource as never, mail as never);
  });

  it('writes the status history and activity audit atomically', async () => {
    const result = await service.transition(
      actor.userId,
      actor.companyId,
      contract.id,
      { transition: 'activate', reason: 'Execution approved.' },
    );

    const historyRepository = repositories.get(ContractStatusHistory)!;
    const activityRepository = repositories.get(ActivityLog)!;
    expect(result.status).toBe(EContractStatus.ACTIVE);
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: EFromStatus.DRAFT,
        toStatus: EToStatus.ACTIVE,
        reason: 'Execution approved.',
        changedById: actor.id,
      }),
    );
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.status_transitioned',
        changes: expect.objectContaining({
          after: expect.objectContaining({
            fromStatus: EContractStatus.DRAFT,
            toStatus: EContractStatus.ACTIVE,
            reason: 'Execution approved.',
          }),
        }),
      }),
    );
    expect(dataSource.transaction).toHaveBeenCalledOnce();
  });

  it('rejects lifecycle changes without an active project-lead assignment', async () => {
    assignmentQuery.getOne.mockResolvedValue(null);

    await expect(
      service.transition(actor.userId, actor.companyId, contract.id, {
        transition: 'activate',
        reason: 'Execution approved.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositories.get(ContractStatusHistory)!.save).not.toHaveBeenCalled();
    expect(repositories.get(ActivityLog)!.save).not.toHaveBeenCalled();
  });

  it('records the creating company separately from the acting membership and contract party', async () => {
    const creatorActor = {
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    };
    const newContract = {
      id: 'contract-created',
      createdByCompanyId: actor.companyId,
    };
    const companyRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: actor.companyId,
        status: ECompanyStatus.ACTIVE,
      }),
    };
    const companyUserRepository = {
      findOne: vi.fn().mockResolvedValue(creatorActor),
    };
    const contractRepository = {
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(newContract),
    };
    const partyRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    const workspaceRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    const historyRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    repositories.set(Company, companyRepository);
    repositories.set(CompanyUser, companyUserRepository);
    repositories.set(Contract, contractRepository);
    repositories.set(ContractParty, partyRepository);
    repositories.set(ContractWorkspaceEntity, workspaceRepository);
    repositories.set(ContractStatusHistory, historyRepository);

    const created = await service.create(actor.userId, actor.companyId, {
      referenceNumber: 'CTR-002',
      title: 'New contract',
      contractType: EContractType.SERVICE,
      partyType: EPartyType.CONTRACTOR,
      workspaces: ['project'],
      originalValueMinor: 1000,
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      paymentTermsDays: 30,
      awardDate: '2026-01-01',
      startDate: '2026-01-02',
      endDate: '2026-12-31',
      defectsLiabilityDays: 365,
      timezone: 'Africa/Lagos',
    });

    expect(created).toBe(newContract);
    expect(contractRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdByCompanyId: actor.companyId }),
    );
    expect(partyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: newContract.id,
        companyId: actor.companyId,
        partyType: EPartyType.CONTRACTOR,
      }),
    );
    expect(workspaceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: newContract.id,
        createdByCompanyUserId: creatorActor.id,
      }),
    );
    expect(dataSource.transaction).toHaveBeenCalledOnce();
  });

  it('keeps creator administration distinct from project-lead transition access', async () => {
    const permissions = await service.managementPermissions(
      actor.userId,
      actor.companyId,
      contract.id,
    );
    expect(permissions).toEqual({
      canManage: false,
      canTransition: true,
      canRestore: false,
    });

    repositories.get(CompanyUser)!.findOne.mockResolvedValue({
      ...actor,
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    repositories.get(Contract)!.findOne.mockResolvedValue({
      ...contract,
      createdByCompanyId: actor.companyId,
    });
    assignmentQuery.getOne.mockResolvedValue(null);

    await expect(
      service.managementPermissions(
        actor.userId,
        actor.companyId,
        contract.id,
      ),
    ).resolves.toEqual({
      canManage: true,
      canTransition: false,
      canRestore: false,
    });
  });
});
