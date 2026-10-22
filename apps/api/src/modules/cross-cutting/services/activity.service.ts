import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ActivityLogRepository } from '../repositories/activity-log.repository';

export interface ActivityFeedItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUserId: string;
  occurredAt: Date;
}

/** Contract activity visible to the caller's own company only. */
@Injectable()
export class ActivityService {
  constructor(
    private readonly access: ContractAccessService,
    private readonly activityLogs: ActivityLogRepository,
  ) {}

  async listForContract(
    userId: string,
    companyId: string,
    contractId: string,
    query: { page: number; limit: number },
  ): Promise<{ items: ActivityFeedItem[]; page: number; limit: number }> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      'general',
    );
    const rows = await this.activityLogs.findPage(scope, {
      order: { occurredAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    // IP address, user agent, request id and raw change sets stay internal.
    const items = rows.items.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      actorUserId: row.actorUserId,
      occurredAt: row.occurredAt,
    }));
    return { items, page: query.page, limit: query.limit };
  }
}
