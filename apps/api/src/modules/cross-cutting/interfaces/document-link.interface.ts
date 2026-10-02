import { DocumentEntityType } from "../entities/document-link.entity"

export interface IDocumentLinkEntity {
    documentId : string
    entityType : DocumentEntityType
    entityId : string
    caption : string
}