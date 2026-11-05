import { Column, Entity, Index } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';

@Entity('email_verification_token')
@Index('ix_email_verification_user_created', ['userId', 'createdAt'])
export class EmailVerificationToken extends BaseCustomEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 26 })
  userId!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
