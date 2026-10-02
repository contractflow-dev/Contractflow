import { DocumentCategory, DocumentStatus, DocumentVisibility } from "../entities/document.entity"

export interface IDocumentEntity {
    contractId : string
    ownerCompanyId : string
    title : string
    documentNumber : string
    category : DocumentCategory
    visibility : DocumentVisibility
    status : DocumentStatus
}