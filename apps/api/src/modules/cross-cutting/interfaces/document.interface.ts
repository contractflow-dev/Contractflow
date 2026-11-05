import { EDocumentCategory, EDocumentStatus, EDocumentVisibility } from "@contractflow/contracts-schema"

export interface IDocumentEntity {
    contractId : string
    ownerCompanyId : string
    title : string
    documentNumber : string
    category : EDocumentCategory
    visibility : EDocumentVisibility
    status : EDocumentStatus
}