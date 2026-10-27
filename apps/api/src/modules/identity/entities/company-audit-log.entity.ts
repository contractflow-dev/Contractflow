import { Column, Entity, ForeignKey, Index } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { Company } from './company.entity';
import { CompanyUser } from './company-user.entity';
import { User } from './app-user.entity';

@Entity('company_audit_log')
@Index('ix_company_audit_log_company_occurred', ['companyId', 'occurredAt'])
@ForeignKey(() => Company, ['companyId'], ['id'], {
  name: 'fk_company_audit_log_company',
  onDelete: 'CASCADE',
})
@ForeignKey(() => CompanyUser, ['actorCompanyUserId'], ['id'], {
  name: 'fk_company_audit_log_actor',
  onDelete: 'SET NULL',
})
@ForeignKey(() => User, ['actorUserId'], ['id'], {
  name: 'fk_company_audit_log_user',
  onDelete: 'NO ACTION',
})
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

  @Column({ name: 'changes', type: 'jsonb', default: {} })
  changes!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
