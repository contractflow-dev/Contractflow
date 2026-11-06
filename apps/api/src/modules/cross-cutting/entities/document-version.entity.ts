import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { Document} from "./document.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "./base-custom.entity";
import { IDocumentVersionEntity } from "../interfaces/document-version.interface";
import { EDocumentUploadStatus } from "@contractflow/contracts-schema";


@Entity("document_version")
export class DocumentVersion extends BaseCustomEntity implements IDocumentVersionEntity{

    @Column({name: "document_id", type: "varchar", length: 26})
    documentId!: string
    @ManyToOne(() => Document, {onDelete:"NO ACTION"})
    @JoinColumn({name:"document_id", referencedColumnName: "id"})
    document!: Document

    @Column({name: "version_number", type:"int"})
    versionNumber!: number

    @Column({name: "storage_key", type:"varchar", length:512})
    storageKey!: string

    @Column({name: "file_name", type:"varchar", length:255})
    fileName!: string

    @Column({name: "mime_type", type:"varchar", length:127})
    mimeType!: string

    // pg returns bigint as a string; uploads are capped well below 2^53.
    @Column({name: "size_bytes", type:"bigint", transformer: {
        to: (value: number) => value,
        from: (value: string | null) => (value === null ? value : Number(value)),
    }})
    sizeBytes!: number

    @Column({name: "checksum_sha256", type:"char", length:64})
    checksumSha256!: string

    @Column({name: "change_note", type:"text"})
    changeNote!: string

    @Column({name: "uploaded_by_id", type: "varchar", length: 26})
    uploadedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"NO ACTION"})
    @JoinColumn({name:"uploaded_by_id", referencedColumnName: "id"})
    uploadedBy!: CompanyUser

    @Column({name: "uploaded_at", type:"timestamptz"})
    uploadedAt!: Date

    @Column({name: "upload_status", type:"enum", enum: EDocumentUploadStatus, enumName: "document_version_upload_status_enum", default: EDocumentUploadStatus.PENDING_UPLOAD})
    uploadStatus!: EDocumentUploadStatus

    @Column({name: "storage_provider", type:"varchar", length:32})
    storageProvider!: string

    @Column({name: "storage_bucket", type:"varchar", length:255})
    storageBucket!: string

    /** Provider object version id when bucket versioning is enabled. */
    @Column({name: "storage_version_id", type:"varchar", length:1024, nullable: true})
    storageVersionId!: string | null

    @Column({name: "upload_expires_at", type:"timestamptz", nullable: true})
    uploadExpiresAt!: Date | null

    @Column({name: "failure_reason", type:"varchar", length:255, nullable: true})
    failureReason!: string | null
}