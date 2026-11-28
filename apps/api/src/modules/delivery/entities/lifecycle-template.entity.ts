import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from '../../identity/entities/company.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';

/**
 * A contract lifecycle a contract's stages can be copied from. Only system
 * templates exist (decision D-2): no company owns one.
 */
@Entity('lifecycle_template')
export class LifecycleTemplate extends BaseCustomEntity {
  @Column({ name: 'code', type: 'varchar', length: 60, unique: true })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'owner_kind',
    type: 'varchar',
    length: 20,
    default: 'system',
  })
  ownerKind!: 'system';

  @Column({
    name: 'owner_company_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  ownerCompanyId!: string | null;
  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'owner_company_id', referencedColumnName: 'id' })
  ownerCompany!: Company | null;
}
