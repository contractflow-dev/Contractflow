
export interface IDocumentVersionEntity {
    documentId : string
    versionNumber : number
    storageKey : string
    fileName : string
    mimeType : string
    sizeBytes : bigint
    checksumSha256 : string
    changeNote : string
    uploadedById : string
    uploadedAt : Date

}