import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from './base-custom.entity';
import { IConversationEntity } from '../interfaces/conversation.interface';
import { CompanyUser } from '../../identity/entities/company-user.entity';  
import { ConversationType, ConversationWorkspace } from '@contractflow/contracts-schema';

@Entity('conversation')
export class Conversation extends BaseCustomEntity implements IConversationEntity {

  @Column({ name: 'conversation_type', type: 'enum', enum: ConversationType })
  conversationType!: ConversationType;

  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'workspace', type: 'enum', enum: ConversationWorkspace })
  workspace!: ConversationWorkspace;

  @Column({ name: 'title', type: 'varchar', length: 100 })
  title!: string;

  @Column({ name: 'conversation_created_at', type: 'timestamptz' })
  conversationCreatedAt!: Date;

  @Column({ name: 'created_by_id', type: 'varchar', length: 26 })
  createdBy_id!: string;
  @ManyToOne( () => CompanyUser, { onDelete: "NO ACTION" })
  @JoinColumn({ name: 'created_by_id', referencedColumnName: 'id' })
  createdBy!: CompanyUser;

}
