import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseCustomEntity } from './base-custom.entity';
import { IMessageEntity } from '../interfaces/message.interface';
import { Conversation } from './conversation.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';


@Entity('message')
export class Message extends BaseCustomEntity implements IMessageEntity{
  @Column({ name: 'conversation_id', type: 'varchar', length: 26 })
  conversationId!: string;
  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id', referencedColumnName: 'id' })
  conversation!: Conversation;

  @Column({ name: 'sender_company_user_id', type: 'varchar', length: 26 })
  senderCompanyUserId!: string;
  @ManyToOne(() => CompanyUser, { onDelete: "NO ACTION" })
  @JoinColumn({ name: 'sender_company_user_id', referencedColumnName: 'id' })
  senderCompanyUser!: CompanyUser;
  
  @Column({ name: 'body', type: 'text'  })
  body!: string;

  @Column({ name: 'attachements', type: 'jsonb' })
  attachements!: Record<string, any>;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;

  @Column({ name: 'edited_at', type: 'timestamptz' })
  editedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date;
}
