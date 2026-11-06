import { EDocumentUploadStatus } from "@contractflow/contracts-schema"

export interface IDocumentVersionEntity {
    documentId : string
    versionNumber : number
    storageKey : string
    fileName : string
    mimeType : string
    sizeBytes : number
    checksumSha256 : string
    changeNote : string
    uploadedById : string
    uploadedAt : Date
    uploadStatus : EDocumentUploadStatus
    storageProvider : string
    storageBucket : string
    storageVersionId : string | null
    uploadExpiresAt : Date | null
    failureReason : string | null
}