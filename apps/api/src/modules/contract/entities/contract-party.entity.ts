import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Contract } from './contract.entity';
import { Company } from '../../identity/entities/company.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IContractPartyEntity } from '../interfaces/contract-party.interface';
import { EPartyType } from '@contractflow/contracts-schema';

@Entity('contract_party')
@Index('uq_contract_party_id_company', ['id', 'companyId'], { unique: true })
// A contract is between two companies: at most one AWARDING and one
// AWARDED party, each a different company. The subcontract rules that span
// two contracts are the database trigger contract_party_rules.
@Index('uq_contract_party_one_awarding', ['contractId'], {
  unique: true,
  where: `"party_type" = 'awarding'`,
})
@Index('uq_contract_party_one_awarded', ['contractId'], {
  unique: true,
  where: `"party_type" = 'awarded'`,
})
@Unique('uq_contract_party_contract_company', ['contractId', 'companyId'])
export class ContractParty extends BaseCustomEntity implements IContractPartyEntity
{
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'company_id', type: 'varchar', length: 26 })
  companyId!: string;
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'id' })
  company!: Company;

  @Column({ name: 'party_type', type: 'enum', enum: EPartyType })
  partyType!: EPartyType;

  @Column({
    name: 'signatory_first_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  signatoryFirstName!: string | null;

  @Column({
    name: 'signatory_last_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  signatoryLastName!: string | null;

  @Column({
    name: 'signatory_title',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  signatoryTitle!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;
}
