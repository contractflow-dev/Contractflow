import { DocumentEntityType } from "@contractflow/contracts-schema"

export interface IDocumentLinkEntity {
    documentId : string
    entityType : DocumentEntityType
    entityId : string
    caption : string
}