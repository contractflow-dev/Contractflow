import { Injectable } from '@nestjs/common';
import type { IPaginatedResponse } from '@contractflow/contracts-schema';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import type { ActivityFeedItem } from '../interfaces/activity-feed-item.interface';
import { ActivityLogRepository } from '../repositories/activity-log.repository';

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
    query: IPageQuery,
  ): Promise<IPaginatedResponse<ActivityFeedItem>> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      'general',
    );
    const rows = await this.activityLogs.findPage(scope, {
      order: { occurredAt: 'DESC', id: 'ASC' },
      skip: pageOffset(query),
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
    return toPaginatedResponse({ items, total: rows.total }, query);
  }
}
