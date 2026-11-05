import { EDocumentEntityType } from "@contractflow/contracts-schema"

export interface IDocumentLinkEntity {
    documentId : string
    entityType : EDocumentEntityType
    entityId : string
    caption : string
}