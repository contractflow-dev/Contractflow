import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './app-user.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { ICompanyUserEntity } from '../interface/company-user.interface';
import {
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';

@Entity('company_user')
@Index('uq_company_user_active_company_user', ['companyId', 'userId'], {
  unique: true,
  where: '"status" = \'active\' AND "left_at" IS NULL',
})
@Index('uq_company_user_id_company', ['id', 'companyId'], { unique: true })
export class CompanyUser
  extends BaseCustomEntity
  implements ICompanyUserEntity
{
  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'company_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_company_user_company',
  })
  company!: Company;

  @Column({ name: 'user_id', type: 'varchar', length: 26 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_company_user_app_user',
  })
  user!: User;

  @Column({ name: 'company_role', type: 'enum', enum: ECompanyRole })
  companyRole!: ECompanyRole;

  @Column({ name: 'job_title', type: 'varchar', length: 150 })
  jobTitle!: string;

  @Column({ name: 'status', type: 'enum', enum: ECompanyUserStatus })
  status!: ECompanyUserStatus;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;
}
