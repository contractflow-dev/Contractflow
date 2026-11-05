import { Check, Column, Entity, ForeignKey, Index } from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { ContractParty } from './contract-party.entity';
import { EPartyType } from '@contractflow/contracts-schema';

export type ContractPartyInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'revoked';

export type InvitableContractPartyType =
  | EPartyType.CONTRACTOR
  | EPartyType.SUBCONTRACTOR;

@Entity('contract_party_invitation')
@Check(
  'ck_contract_party_invitation_type',
  `"party_type" IN ('contractor', 'subcontractor')`,
)
@Check(
  'ck_contract_party_invitation_status',
  `"status" IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')`,
)
@Index('uq_contract_party_invitation_token', ['tokenHash'], { unique: true })
@Index(
  'uq_contract_party_invitation_pending',
  ['sourceContractPartyId', 'targetCompanyId', 'partyType'],
  { unique: true, where: `"status" = 'pending'` },
)
@Index('ix_contract_party_invitation_target_status', [
  'targetCompanyId',
  'status',
  'expiresAt',
])
@ForeignKey(
  () => ContractParty,
  ['sourceContractPartyId', 'sourceCompanyId'],
  ['id', 'companyId'],
  {
    name: 'fk_contract_party_invitation_source',
    onDelete: 'CASCADE',
  },
)
@ForeignKey(() => Company, ['targetCompanyId'], ['id'], {
  name: 'fk_contract_party_invitation_target',
  onDelete: 'CASCADE',
})
@ForeignKey(
  () => CompanyUser,
  ['invitedByCompanyUserId', 'sourceCompanyId'],
  ['id', 'companyId'],
  {
    name: 'fk_contract_party_invitation_inviter',
    onDelete: 'CASCADE',
  },
)
@ForeignKey(() => CompanyUser, ['acceptedByCompanyUserId'], ['id'], {
  name: 'fk_contract_party_invitation_responder',
  onDelete: 'SET NULL',
})
export class ContractPartyInvitation extends BaseCustomEntity {
  @Column({
    name: 'source_contract_party_id',
    type: 'varchar',
    length: 26,
  })
  sourceContractPartyId!: string;

  @Column({ name: 'source_company_id', type: 'varchar', length: 26 })
  sourceCompanyId!: string;

  @Column({ name: 'target_company_id', type: 'varchar', length: 26 })
  targetCompanyId!: string;

  @Column({
    name: 'invited_by_company_user_id',
    type: 'varchar',
    length: 26,
  })
  invitedByCompanyUserId!: string;

  @Column({
    name: 'accepted_by_company_user_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  acceptedByCompanyUserId!: string | null;

  @Column({ name: 'party_type', type: 'varchar', length: 20 })
  partyType!: InvitableContractPartyType;

  @Column({ name: 'email', type: 'varchar', length: 320 })
  email!: string;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
    select: false,
  })
  tokenHash!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: ContractPartyInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
