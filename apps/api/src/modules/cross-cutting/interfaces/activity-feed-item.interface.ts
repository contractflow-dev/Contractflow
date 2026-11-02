export interface ActivityFeedItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUserId: string;
  occurredAt: Date;
}
