import { BadRequestException } from '@nestjs/common';
import { EMilestoneStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractAccessService } from '../../contract/services/contract-access.service';
import type { IMilestoneWorkflowReader } from '../interface/milestone-workflow-persistence.interface';
import { MilestoneReadService } from './milestone-read.service';

const SCOPE = { contractId: 'scoped-contract', companyId: 'scoped-company' };
const CALLER = {
  userId: 'u1',
  companyId: 'header-company',
  contractId: 'header-contract',
};
const PAGE = { page: 2, limit: 10 };

describe('MilestoneReadService.listMilestones', () => {
  let access: { authorize: ReturnType<typeof vi.fn> };
  let reader: {
    listMilestones: ReturnType<typeof vi.fn>;
    contractTimezone: ReturnType<typeof vi.fn>;
  };
  let service: MilestoneReadService;

  beforeEach(() => {
    access = { authorize: vi.fn().mockResolvedValue(SCOPE) };
    reader = {
      listMilestones: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      contractTimezone: vi.fn().mockResolvedValue('UTC'),
    };
    service = new MilestoneReadService(
      access as unknown as ContractAccessService,
      reader as unknown as IMilestoneWorkflowReader,
    );
  });

  const filtersSent = () => reader.listMilestones.mock.calls[0][1];

  it('reads submission days as whole UTC days, both ends inclusive, within the authorized scope', async () => {
    await service.listMilestones(CALLER, {
      ...PAGE,
      submittedFrom: '2026-11-01',
      submittedTo: '2026-11-10',
    });

    expect(access.authorize).toHaveBeenCalledWith(
      'u1',
      'header-company',
      'header-contract',
      'project',
    );
    const [scope, filters, page] = reader.listMilestones.mock.calls[0];
    expect(scope).toEqual(SCOPE);
    expect(filters).toMatchObject({
      submittedFrom: new Date('2026-11-01T00:00:00.000Z'),
      submittedTo: new Date('2026-11-10T23:59:59.999Z'),
    });
    expect(page).toEqual({ skip: 10, take: 10 });
  });

  it('uses zoned instants exactly, and leaves out bounds that weren’t given', async () => {
    await service.listMilestones(CALLER, {
      ...PAGE,
      submittedFrom: '2026-11-10T09:00:00+01:00',
    });
    expect(filtersSent()).toMatchObject({
      submittedFrom: new Date('2026-11-10T08:00:00.000Z'),
      submittedTo: undefined,
    });
  });

  it('allows a single day and refuses a reversed range before checking access', async () => {
    await service.listMilestones(CALLER, {
      ...PAGE,
      submittedFrom: '2026-11-10',
      submittedTo: '2026-11-10',
    });
    expect(reader.listMilestones).toHaveBeenCalledOnce();

    await expect(
      service.listMilestones(CALLER, {
        ...PAGE,
        submittedFrom: '2026-11-11',
        submittedTo: '2026-11-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listMilestones(CALLER, {
        ...PAGE,
        dueFrom: '2027-02-01',
        dueTo: '2027-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(access.authorize).toHaveBeenCalledOnce();
    expect(reader.listMilestones).toHaveBeenCalledOnce();
  });

  it('refuses an instant without a time zone', async () => {
    await expect(
      service.listMilestones(CALLER, {
        ...PAGE,
        submittedFrom: '2026-11-10T09:00:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reader.listMilestones).not.toHaveBeenCalled();
  });

  it('combines submission dates with the other filters', async () => {
    await service.listMilestones(CALLER, {
      ...PAGE,
      pendingReview: true,
      contractStageId: '01J0000000000000000000STG1',
      submittedTo: '2026-11-30',
    });
    expect(filtersSent()).toMatchObject({
      statuses: [EMilestoneStatus.PENDING_APPROVAL],
      contractStageId: '01J0000000000000000000STG1',
      submittedTo: new Date('2026-11-30T23:59:59.999Z'),
    });
  });
});

describe('MilestoneReadService.getProgress', () => {
  const stage = (
    id: string,
    weightBps: number,
    status: string,
    isApplicable = true,
  ) => ({ id, weightBps, status, isApplicable });

  async function progressOf(
    stages: ReturnType<typeof stage>[],
    approved: Record<string, number>,
  ) {
    const access = { authorize: vi.fn().mockResolvedValue(SCOPE) };
    const reader = {
      allStages: vi.fn().mockResolvedValue(stages),
      stageProgress: vi
        .fn()
        .mockResolvedValue(new Map(Object.entries(approved))),
    };
    const service = new MilestoneReadService(
      access as unknown as ContractAccessService,
      reader as unknown as IMilestoneWorkflowReader,
    );
    const result = await service.getProgress(CALLER);
    expect(reader.allStages).toHaveBeenCalledWith(SCOPE);
    return result;
  }

  it('weights each stage by its share, counting a completed stage in full', async () => {
    const result = await progressOf(
      [
        stage('award', 0, 'completed'),
        stage('build', 6000, 'in_progress'),
        stage('test', 4000, 'completed'),
      ],
      // A completed stage counts in full whatever its milestones say.
      { build: 5000, test: 2500 },
    );
    // 6000 x 50% + 4000 x 100% = 7000 of 10000.
    expect(result.lifecycleProgressBps).toBe(7000);
    expect(result.countedWeightBps).toBe(10000);
  });

  it('leaves out stages that don’t apply or were cancelled, and reweights the rest', async () => {
    const result = await progressOf(
      [
        stage('build', 6000, 'completed'),
        stage('test', 3000, 'planned', false),
        stage('handover', 1000, 'cancelled'),
      ],
      {},
    );
    // Only the build stage counts, and it is complete.
    expect(result.lifecycleProgressBps).toBe(10000);
    expect(result.countedWeightBps).toBe(6000);
    expect(
      result.stages.map(({ stageId, counted }) => [stageId, counted]),
    ).toEqual([
      ['build', true],
      ['test', false],
      ['handover', false],
    ]);
  });

  it('reports no progress when no stage counts', async () => {
    await expect(progressOf([], {})).resolves.toEqual({
      lifecycleProgressBps: 0,
      countedWeightBps: 0,
      stages: [],
    });
  });
});
