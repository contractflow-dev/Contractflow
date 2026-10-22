import { Column, Entity, Index } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';

@Entity('company_audit_log')
@Index('ix_company_audit_log_company_occurred', ['companyId', 'occurredAt'])
export class CompanyAuditLog extends BaseCustomEntity {
  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;

  @Column({
    name: 'actor_company_user_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  actorCompanyUserId!: string | null;

  @Column({ name: 'actor_user_id', type: 'varchar', length: 26 })
  actorUserId!: string;

  @Column({ name: 'action', type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 60 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 26, nullable: true })
  entityId!: string | null;

  @Column({ name: 'summary', type: 'varchar', length: 500 })
  summary!: string;

  @Column({ name: 'changes', type: 'jsonb', default: () => "'{}'::jsonb" })
  changes!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
