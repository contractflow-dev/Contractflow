import{Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, OneToMany, JoinColumn} from "typeorm";  
import { Contract } from "../../contract/entities/contract.entity";
import { ContractSite } from "./contract-site.entity";
import { ContractParty } from "../../contract/entities/contract-party.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IInventoryItemEntity } from "../interface/inventory-item.interface";

@Entity("inventory_item")
export class InventoryItem extends BaseCustomEntity implements IInventoryItemEntity{

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"} )
    @JoinColumn({name: "contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "contract_site_id", type: "varchar", length: 26})
    contractSiteId!: string
    @ManyToOne(() => ContractSite, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_site_id", referencedColumnName: "id"})
    contractSite!: ContractSite      

    @Column({name: "contract_party_id", type: "varchar", length: 26})
    contractPartyId!: string
    @ManyToOne(() => ContractParty)
    @JoinColumn({name:"contract_party_id", referencedColumnName:"id"})
    contractParty!: ContractParty

    @Column({name: "item_code", type:"varchar", length:60})
    itemCode!: string

    @Column({name: "name", type:"varchar", length:255})
    name!: string

    @Column({name: "category", type:"varchar", length:100})
    category!: string

    @Column({name: "unit_of_measure", type:"varchar", length:20})
    unitOfMeasure!: string

    @Column({name: "quantity_on_hand_milli", type:"bigint"})
    quantityOnHandMilli!: number

    @Column({name: "reorder_level_milli", type:"bigint"})
    reorderLevelMilli!: number
}