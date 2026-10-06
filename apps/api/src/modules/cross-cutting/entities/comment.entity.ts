import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { BaseCustomEntity } from './base-custom.entity';
import { ICommentEntity } from '../interfaces/comment.interface';
import { EntityType, CommentVisibility } from '@contractflow/contracts-schema';


@Entity('comment')
export class Comment extends BaseCustomEntity implements ICommentEntity{
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'author_company_user_id', type: 'varchar', length: 26 })
  authorCompanyUserId!: string;
  @ManyToOne(() => CompanyUser)
  @JoinColumn({ name: 'author_company_user_id', referencedColumnName: 'id' })
  companyUser!: CompanyUser;

  @Column({ name: 'parent_comment_id', type: 'varchar', length: 26 })
  parentCommentId!: string;
  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_comment_id', referencedColumnName: 'id' })
  comment!: Comment;

  @Column({ name: 'entity_type', type: 'enum', enum: EntityType })
  entityType!: EntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'body', type: 'varchar' })
  body!: string;

  @Column({ name: 'visibility', type: 'enum', enum: CommentVisibility })
  visibility!: CommentVisibility;
}
