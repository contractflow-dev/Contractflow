import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { Company } from "../../identity/entities/company.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "./base-custom.entity";
import { IDocumentEntity } from "../interfaces/document.interface";
import { EDocumentCategory, EDocumentStatus, EDocumentVisibility } from "@contractflow/contracts-schema";


@Entity("document")
export class Document extends BaseCustomEntity implements IDocumentEntity {

    // Null for a company-wide document, which only its owner company sees
    // (enforced by ck_document_company_level_private).
    @Column({name: "contract_id", type: "varchar", length: 26, nullable: true})
    contractId!: string | null
    @ManyToOne(() => Contract, {onDelete:"CASCADE", nullable: true})
    @JoinColumn({name:"contract_id", referencedColumnName:"id"})
    contract!: Contract | null

    @Column({name: "owner_company_id", type: "varchar", length: 26})
    ownerCompanyId!: string
    @ManyToOne(() => Company, {onDelete:"CASCADE"})
    @JoinColumn({name:"owner_company_id", referencedColumnName:"id"})
    Company!: Company

    @Column({name: "title", type:"varchar", length:255})
    title!: string

    @Column({name: "document_number", type:"varchar", length:60})
    documentNumber!: string

    @Column({name: "category", type:"enum", enum: EDocumentCategory})
    category!: EDocumentCategory

    @Column({name: "visibility", type:"enum", enum: EDocumentVisibility})
    visibility!: EDocumentVisibility

    @Column({name: "status", type:"enum", enum: EDocumentStatus})
    status!: EDocumentStatus

    // Soft delete: the row and its version history are retained for audit.
    @Column({name: "deleted_at", type: "timestamptz", nullable: true})
    deletedAt!: Date | null

    @Column({name: "deleted_by_id", type: "varchar", length: 26, nullable: true})
    deletedById!: string | null
    @ManyToOne(() => CompanyUser, {onDelete:"NO ACTION"})
    @JoinColumn({name:"deleted_by_id", referencedColumnName:"id"})
    deletedBy!: CompanyUser | null
}