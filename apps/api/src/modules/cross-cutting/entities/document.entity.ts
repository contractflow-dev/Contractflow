import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { Company } from "../../identity/entities/company.entity";
import { BaseCustomEntity } from "./base-custom.entity";
import { IDocumentEntity } from "../interfaces/document.interface";
import { DocumentCategory, DocumentStatus, DocumentVisibility } from "@contractflow/contracts-schema";


@Entity("document")
export class Document extends BaseCustomEntity implements IDocumentEntity {

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_id", referencedColumnName:"id"})
    contract!: Contract

    @Column({name: "owner_company_id", type: "varchar", length: 26})
    ownerCompanyId!: string
    @ManyToOne(() => Company, {onDelete:"CASCADE"})
    @JoinColumn({name:"owner_company_id", referencedColumnName:"id"})
    Company!: Company

    @Column({name: "title", type:"varchar", length:255})
    title!: string

    @Column({name: "document_number", type:"varchar", length:60})
    documentNumber!: string

    @Column({name: "category", type:"enum", enum: DocumentCategory})
    category!: DocumentCategory

    @Column({name: "visibility", type:"enum", enum: DocumentVisibility})
    visibility!: DocumentVisibility

    @Column({name: "status", type:"enum", enum: DocumentStatus})
    status!: DocumentStatus
}