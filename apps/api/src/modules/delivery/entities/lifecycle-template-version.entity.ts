import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { LifecycleTemplate } from './lifecycle-template.entity';

export type LifecycleTemplateVersionStatus = 'draft' | 'published' | 'retired';

/**
 * One version of a lifecycle template. Once published its stages are fixed
 * (trigger lifecycle_template_stage_immutable); a template has at most one
 * published version, the one new contracts are copied from.
 */
@Entity('lifecycle_template_version')
export class LifecycleTemplateVersion extends BaseCustomEntity {
  @Column({ name: 'lifecycle_template_id', type: 'varchar', length: 26 })
  lifecycleTemplateId!: string;
  @ManyToOne(() => LifecycleTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lifecycle_template_id', referencedColumnName: 'id' })
  lifecycleTemplate!: LifecycleTemplate;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: LifecycleTemplateVersionStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
