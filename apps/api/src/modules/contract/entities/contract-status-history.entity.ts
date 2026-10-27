import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { Contract } from "./contract.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IContractStatusHistoryEntity } from "../interfaces/contract-status-history.interface";
import { EFromStatus, EToStatus } from "@contractflow/contracts-schema";



@Entity("contract_status_history")
@Index("ix_contract_status_history_contract_changed", [
    "contractId",
    "changedAt",
    "id",
])
export class ContractStatusHistory extends BaseCustomEntity implements IContractStatusHistoryEntity {

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "from_status", type: "enum", enum: EFromStatus, nullable: true})
    fromStatus!: EFromStatus | null

    @Column({name: "to_status", type: "enum", enum: EToStatus})
    toStatus!: EToStatus

    @Column({name: "reason", type: "text", nullable: true})
    reason!: string | null

    @Column({name: "changed_by_id", type: "varchar", length: 26})
    changedById!: string
    
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"changed_by_id", referencedColumnName: "id"})
    changedBy!: CompanyUser

    @Column({name: "changed_at", type: "timestamptz"})
    changedAt!: Date

}