import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { Company } from './company.entity';

/** A one-time link that proves a company controls its company email inbox. */
@Entity('company_verification_token')
@Index('ix_company_verification_company_created', ['companyId', 'createdAt'])
export class CompanyVerificationToken extends BaseCustomEntity {
  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'company_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_company_verification_token_company',
  })
  company?: Company;

  /** The company email the link was sent to; a later email change voids it. */
  @Column({ name: 'email', type: 'citext' })
  email!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
