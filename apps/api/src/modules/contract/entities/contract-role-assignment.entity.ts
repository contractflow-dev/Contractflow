import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  ForeignKey,
} from 'typeorm';
import { ContractParty } from './contract-party.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Company } from '../../identity/entities/company.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IContractRoleAssignmentEntity } from '../interfaces/contract-role-assignment.interface';
import { EContractRole } from '@contractflow/contracts-schema';

@Entity('contract_role_assignment')
@Index(
  'uq_contract_role_assignment_active',
  ['contractPartyId', 'companyUserId', 'role'],
  { unique: true, where: '"revoked_at" IS NULL' },
)
@ForeignKey(
  () => ContractParty,
  ['contractPartyId', 'companyId'],
  ['id', 'companyId'],
  {
    name: 'fk_role_assignment_party_company',
    onDelete: 'CASCADE',
  },
)
@ForeignKey(
  () => CompanyUser,
  ['companyUserId', 'companyId'],
  ['id', 'companyId'],
  {
    name: 'fk_role_assignment_member_company',
    onDelete: 'CASCADE',
  },
)
export class ContractRoleAssignment
  extends BaseCustomEntity
  implements IContractRoleAssignmentEntity
{
  @Column({ name: 'contract_party_id', type: 'varchar', length: 26 })
  contractPartyId!: string;
  @ManyToOne(() => ContractParty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_party_id', referencedColumnName: 'id' })
  contractParty!: ContractParty;

  @Column({ name: 'company_user_id', type: 'varchar', length: 26 })
  companyUserId!: string;

  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_user_id', referencedColumnName: 'id' })
  companyUser!: CompanyUser;

  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'id' })
  company!: Company;

  @Column({ name: 'contract_role', type: 'enum', enum: EContractRole })
  role!: EContractRole;

  @Column({ name: 'is_workspace_admin', type: 'boolean', default: false })
  isWorkspaceAdmin!: boolean;

  @Column({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @Column({ name: 'assigned_by_id', type: 'varchar', length: 26 })
  assignedById!: string;

  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assigned_by_id', referencedColumnName: 'id' })
  assignedBy!: CompanyUser;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({
    name: 'revoked_by_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  revokedById!: string | null;

  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'revoked_by_id', referencedColumnName: 'id' })
  revokedBy!: CompanyUser | null;
}
