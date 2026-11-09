import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { AppUser } from './app-user.entity';

/**
 * A single-use link that lets a user set a new password. Only the SHA-256
 * hash of the token is stored; the raw token exists only in the email.
 */
@Entity('password_reset_token')
@Index('ix_password_reset_user_created', ['userId', 'createdAt'])
export class PasswordResetToken extends BaseCustomEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 26 })
  userId!: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_password_reset_token_user',
  })
  user?: AppUser;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Set when the token is used or replaced; a set value means it is spent. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
