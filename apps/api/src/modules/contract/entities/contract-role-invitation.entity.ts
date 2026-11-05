import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  ForeignKey,
} from 'typeorm';
import { EContractRole } from '@contractflow/contracts-schema';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { ContractParty } from './contract-party.entity';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export type ContractRoleInvitationStatus =
  'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';

@Entity('contract_role_invitation')
@Check(
  'ck_contract_role_invitation_workspace',
  `"workspace" IN ('project', 'hse', 'finance')`,
)
@Check(
  'ck_contract_role_invitation_status',
  `"status" IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')`,
)
@Index(
  'uq_contract_role_invitation_pending',
  ['contractPartyId', 'email', 'role'],
  {
    unique: true,
    where: `"status" = 'pending'`,
  },
)
@Index('ix_contract_role_invitation_party_status_expiry', [
  'contractPartyId',
  'status',
  'expiresAt',
])
@Index('uq_contract_role_invitation_token', ['tokenHash'], { unique: true })
@ForeignKey(
  () => ContractParty,
  ['contractPartyId', 'companyId'],
  ['id', 'companyId'],
  {
    name: 'fk_contract_role_invitation_party_company',
    onDelete: 'CASCADE',
  },
)
@ForeignKey(
  () => CompanyUser,
  ['invitedById', 'companyId'],
  ['id', 'companyId'],
  {
    name: 'fk_contract_role_invitation_inviter_company',
    onDelete: 'CASCADE',
  },
)
export class ContractRoleInvitation extends BaseCustomEntity {
  @Column({ name: 'contract_party_id', type: 'varchar', length: 26 })
  contractPartyId!: string;

  @ManyToOne(() => ContractParty, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'contract_party_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_contract_role_invitation_party',
  })
  contractParty!: ContractParty;

  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'company_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_contract_role_invitation_company',
  })
  company!: Company;

  @Column({ name: 'invited_by_id', type: 'varchar', length: 26 })
  invitedById!: string;

  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'invited_by_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_contract_role_invitation_inviter',
  })
  invitedBy!: CompanyUser;

  @Column({ name: 'email', type: 'varchar', length: 320 })
  email!: string;

  @Column({
    name: 'contract_role',
    type: 'enum',
    enum: EContractRole,
    enumName: 'contract_role_assignment_contract_role_enum',
  })
  role!: EContractRole;

  @Column({ name: 'workspace', type: 'varchar', length: 20 })
  workspace!: AssignableContractWorkspace;

  @Column({ name: 'is_workspace_admin', type: 'boolean', default: false })
  isWorkspaceAdmin!: boolean;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
    select: false,
  })
  tokenHash!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: ContractRoleInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
