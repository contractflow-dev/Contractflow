import {
  Check,
  Column,
  Entity,
  ForeignKey,
  PrimaryColumn,
} from 'typeorm';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from './contract.entity';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

@Entity('contract_workspace')
@Check(
  'ck_contract_workspace_type',
  `"workspace" IN ('project', 'hse', 'finance')`,
)
@ForeignKey(() => Contract, ['contractId'], ['id'], {
  name: 'fk_contract_workspace_contract',
  onDelete: 'CASCADE',
})
@ForeignKey(() => CompanyUser, ['createdByCompanyUserId'], ['id'], {
  name: 'fk_contract_workspace_creator',
  onDelete: 'SET NULL',
})
export class ContractWorkspaceEntity {
  @PrimaryColumn({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;

  @PrimaryColumn({ name: 'workspace', type: 'varchar', length: 20 })
  workspace!: AssignableContractWorkspace;

  @Column({
    name: 'created_by_company_user_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  createdByCompanyUserId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
