import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Document } from "./document.entity";
import { BaseCustomEntity } from "./base-custom.entity";
import { IDocumentLinkEntity } from "../interfaces/document-link.interface";

export enum DocumentEntityType{
    CERTIFICATE="certificate",  
    HSE="HSE",
    CONTRACT="contract",
    INVOICE="invoice",
    REPORT="report",
    OTHER="other"
}

@Entity("document_link")
export class DocumentLink extends BaseCustomEntity implements IDocumentLinkEntity{

    @Column({name: "document_id", type:"varchar", length: 26})
    documentId!: string
    @ManyToOne(() => Document, {onDelete:"NO ACTION"})
    @JoinColumn({name:"document_id", referencedColumnName: "id"})
    document!: Document

    @Column({name: "entity_type", type:"enum", enum: DocumentEntityType})
    entityType!: DocumentEntityType

    @Column({name: "entity_id", type:"uuid"})
    entityId!: string

    @Column({name: "caption", type:"varchar", length:255})
    caption!: string
}