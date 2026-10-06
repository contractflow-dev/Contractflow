import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseCustomEntity } from './base-custom.entity';
import { Conversation } from './conversation.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { IConversationParticipantEntity } from '../interfaces/conversation-participant.interface';


@Entity('conversation_participant')
export class ConversationParticipant extends BaseCustomEntity implements IConversationParticipantEntity{
  @Column({ name: 'conversation_id', type: 'varchar', length: 26 })
  conversationId!: string;
  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id', referencedColumnName: 'id' })
  conversation!: Conversation;

  @Column({ name: 'company_user_id', type: 'varchar', length: 26 })
  CompanyUserId!: string;
  @ManyToOne(() => CompanyUser, { onDelete: "NO ACTION" })
  @JoinColumn({ name: 'company_user_id', referencedColumnName: 'id' })
  CompanyUser!: CompanyUser;
  
  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz' })
  leftAt!: Date;

  @Column({ name: 'last_read_at', type: 'timestamptz' })
  lastReadAt!: Date;
}
