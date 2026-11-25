import { Entity, Column, ManyToOne, JoinColumn, Check } from "typeorm";
import { Document } from "./document.entity";
import { BaseCustomEntity } from "./base-custom.entity";
import { IDocumentLinkEntity } from "../interfaces/document-link.interface";
import { EDocumentEntityType } from "@contractflow/contracts-schema";


@Entity("document_link")
// A polymorphic reference: no foreign key, so the writer checks it exists.
@Check("ck_document_link_entity_id_ulid", `"entity_id" ~* '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'`)
export class DocumentLink extends BaseCustomEntity implements IDocumentLinkEntity{

    @Column({name: "document_id", type:"varchar", length: 26})
    documentId!: string
    @ManyToOne(() => Document, {onDelete:"NO ACTION"})
    @JoinColumn({name:"document_id", referencedColumnName: "id"})
    document!: Document

    @Column({name: "entity_type", type:"enum", enum: EDocumentEntityType})
    entityType!: EDocumentEntityType

    @Column({name: "entity_id", type: "varchar", length: 26})
    entityId!: string

    @Column({name: "caption", type:"varchar", length:255})
    caption!: string
}