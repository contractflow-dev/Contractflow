import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { ELifecycleStageCode } from '@contractflow/contracts-schema';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { LifecycleTemplateVersion } from './lifecycle-template-version.entity';

/** One stage of a lifecycle template version, copied to each new contract. */
@Entity('lifecycle_template_stage')
export class LifecycleTemplateStage extends BaseCustomEntity {
  @Column({
    name: 'lifecycle_template_version_id',
    type: 'varchar',
    length: 26,
  })
  lifecycleTemplateVersionId!: string;
  @ManyToOne(() => LifecycleTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'lifecycle_template_version_id',
    referencedColumnName: 'id',
  })
  lifecycleTemplateVersion!: LifecycleTemplateVersion;

  @Column({ name: 'stage_code', type: 'varchar', length: 40 })
  stageCode!: ELifecycleStageCode;

  @Column({ name: 'sequence', type: 'int' })
  sequence!: number;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** Share of the contract, in basis points; a version's stages total 10,000. */
  @Column({ name: 'default_weight_bps', type: 'int' })
  defaultWeightBps!: number;

  /** Completed when the contract is activated (Contract Award). */
  @Column({
    name: 'completes_on_activation',
    type: 'boolean',
    default: false,
  })
  completesOnActivation!: boolean;
}
