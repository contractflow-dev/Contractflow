import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ContractActivityActor,
  ContractActivityAction,
  ContractActivityTarget,
  ContractActivityFilters,
  IPaginatedResponse,
} from '@contractflow/contracts-schema';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import type {
  ActivityFeedItem,
  ActivityLogFilter,
} from '../interfaces/activity-feed-item.interface';
import type { ActivityLog } from '../entities/activity-log.entity';
import { ActivityLogRepository } from '../repositories/activity-log.repository';

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

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
    query: IPageQuery & ContractActivityFilters,
  ): Promise<IPaginatedResponse<ActivityFeedItem>> {
    const filter = toFilter(query);
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      'general',
    );
    const rows = await this.activityLogs.findPageWithActorNames(scope, {
      ...filter,
      skip: pageOffset(query),
      take: query.limit,
    });

    // IP address, user agent, request id and raw change sets stay internal;
    // of the actor, only the name is returned.
    const items = rows.items.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      actorUserId: row.actorUserId,
      actorName: actorName(row.actorUser?.user),
      target: this.activityTarget(row),
      occurredAt: row.occurredAt,
    }));
    return toPaginatedResponse({ items, total: rows.total }, query);
  }

  private readonly targetDefinitions: Partial<
    Record<
      ContractActivityAction,
      {
        entityType: string;
        type: ContractActivityTarget['type'];
        section: ContractActivityTarget['section'];
        idKey: string;
        idInAfter?: boolean;
        versionIdKey?: string;
        workspaceKey?: string;
      }
    >
  > = {
    'contract.site_created': {
      entityType: 'contract',
      type: 'contract_site',
      section: 'sites',
      idKey: 'siteId',
      idInAfter: true,
    },
    'contract.site_updated': {
      entityType: 'contract',
      type: 'contract_site',
      section: 'sites',
      idKey: 'siteId',
      idInAfter: true,
    },
    'contract.signatory_recorded': {
      entityType: 'contract',
      type: 'contract_party',
      section: 'signatories',
      idKey: 'contractPartyId',
      idInAfter: true,
    },
    'contract.party_invitation_created': {
      entityType: 'contract',
      type: 'contract_party_invitation',
      section: 'parties',
      idKey: 'invitationId',
      idInAfter: true,
    },
    'contract.party_invitation_revoked': {
      entityType: 'contract',
      type: 'contract_party_invitation',
      section: 'parties',
      idKey: 'invitationId',
      idInAfter: true,
    },
    'contract.party_invitation_accepted': {
      entityType: 'contract',
      type: 'contract_party_invitation',
      section: 'parties',
      idKey: 'invitationId',
      idInAfter: true,
    },
    'contract.party_invitation_rejected': {
      entityType: 'contract',
      type: 'contract_party_invitation',
      section: 'parties',
      idKey: 'invitationId',
      idInAfter: true,
    },
    'contract.role_assigned': {
      entityType: 'contract_role_assignment',
      type: 'contract_role_assignment',
      section: 'roles',
      idKey: 'assignmentId',
      workspaceKey: 'workspace',
    },
    'contract.role_revoked': {
      entityType: 'contract_role_assignment',
      type: 'contract_role_assignment',
      section: 'roles',
      idKey: 'assignmentId',
      workspaceKey: 'workspace',
    },
    'contract.role_invitation_created': {
      entityType: 'contract_role_invitation',
      type: 'contract_role_invitation',
      section: 'roles',
      idKey: 'invitationId',
      workspaceKey: 'workspace',
    },
    'contract.role_invitation_revoked': {
      entityType: 'contract_role_invitation',
      type: 'contract_role_invitation',
      section: 'roles',
      idKey: 'invitationId',
      workspaceKey: 'workspace',
    },
    'contract.workspace_admin_granted': {
      entityType: 'contract_role_assignment',
      type: 'contract_role_assignment',
      section: 'roles',
      idKey: 'assignmentId',
      workspaceKey: 'workspace',
    },
    'contract.workspace_admin_revoked': {
      entityType: 'contract_role_assignment',
      type: 'contract_role_assignment',
      section: 'roles',
      idKey: 'assignmentId',
      workspaceKey: 'workspace',
    },
    'document.upload_initiated': {
      entityType: 'document',
      type: 'document',
      section: 'documents',
      idKey: 'documentId',
      versionIdKey: 'versionId',
    },
    'document.upload_completed': {
      entityType: 'document',
      type: 'document',
      section: 'documents',
      idKey: 'documentId',
      versionIdKey: 'versionId',
    },
    'document.upload_failed': {
      entityType: 'document',
      type: 'document',
      section: 'documents',
      idKey: 'documentId',
      versionIdKey: 'versionId',
    },
    'document.version_added': {
      entityType: 'document',
      type: 'document',
      section: 'documents',
      idKey: 'documentId',
      versionIdKey: 'versionId',
    },
    'document.downloaded': {
      entityType: 'document',
      type: 'document',
      section: 'documents',
      idKey: 'documentId',
      versionIdKey: 'versionId',
    },
  };

  private activityTarget(row: ActivityLog): ContractActivityTarget | null {
    const definition =
      this.targetDefinitions[row.action as ContractActivityAction];
    if (!definition || row.entityType !== definition.entityType) return null;

    // `changes.after` is an object (the stored change set), so it is read as
    // one; only the named id inside it is ever taken.
    const source = definition.idInAfter
      ? this.recordValue(
          this.recordObject(row.changes, 'after'),
          definition.idKey,
        )
      : this.recordValue(row.metadata, definition.idKey);
    if (!source) return null;

    const versionId = definition.versionIdKey
      ? this.recordValue(row.metadata, definition.versionIdKey)
      : undefined;
    const workspace = definition.workspaceKey
      ? this.recordValue(row.metadata, definition.workspaceKey)
      : undefined;

    return {
      type: definition.type,
      id: source,
      section: definition.section,
      ...(versionId ? { versionId } : {}),
      ...(this.isWorkspace(workspace) ? { workspace } : {}),
    };
  }

  private recordObject(
    value: unknown,
    key: string,
  ): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = (value as Record<string, unknown>)[key];
    return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : undefined;
  }

  private recordValue(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : undefined;
  }

  private isWorkspace(
    value: string | undefined,
  ): value is 'project' | 'hse' | 'finance' {
    return value === 'project' || value === 'hse' || value === 'finance';
  }

  /**
   * The actor filter's options: members of the caller's own company who have
   * activity on this contract, by name. Nobody from another company.
   */
  async listActors(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractActivityActor[]> {
    const scope = await this.access.authorize(
      userId,
      companyId,
      contractId,
      'general',
    );
    const actors = await this.activityLogs.findActors(scope);
    return actors.map((actor) => ({
      actorUserId: actor.actorUserId,
      actorName: actorName(actor),
    }));
  }
}

/**
 * The repository filter for a validated query. A calendar day starts at its
 * first UTC millisecond and ends at its last; an instant (which always names
 * its zone, see the DTO) is used as is. Both ends are inclusive.
 */
function toFilter(query: ContractActivityFilters): ActivityLogFilter {
  const fromDate = query.fromDate
    ? instant(query.fromDate, 'start')
    : undefined;
  const toDate = query.toDate ? instant(query.toDate, 'end') : undefined;
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new BadRequestException(
      'The activity start date must not be after the end date.',
    );
  }
  return {
    fromDate,
    toDate,
    actorUserId: query.actorUserId,
    action: query.action,
  };
}

function instant(value: string, edge: 'start' | 'end'): Date {
  const date = new Date(
    CALENDAR_DAY.test(value) ? `${value}T00:00:00.000Z` : value,
  );
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('The activity date is not a valid date.');
  }
  return CALENDAR_DAY.test(value) && edge === 'end'
    ? new Date(date.getTime() + DAY_MS - 1)
    : date;
}

/**
 * "First Last", as the admin activity feed formats it. Null when the actor
 * could not be resolved within the caller's company or has no name.
 */
function actorName(
  person: { firstName?: string | null; lastName?: string | null } | undefined,
): string | null {
  if (!person) return null;
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || null;
}
