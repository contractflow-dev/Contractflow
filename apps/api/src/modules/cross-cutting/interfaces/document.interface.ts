import { DocumentCategory, DocumentStatus, DocumentVisibility } from "@contractflow/contracts-schema"

export interface IDocumentEntity {
    contractId : string
    ownerCompanyId : string
    title : string
    documentNumber : string
    category : DocumentCategory
    visibility : DocumentVisibility
    status : DocumentStatus
}