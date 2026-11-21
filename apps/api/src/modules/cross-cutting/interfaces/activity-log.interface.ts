export interface IActivityLogEntity {
  contractId: string;
  companyId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  workspace: 'project' | 'hse' | 'finance' | null;
  reason: string | null;
  summary: string;
  changes: Record<string, any>;
  metadata: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  occurredAt: Date;
}
