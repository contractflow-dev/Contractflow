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
