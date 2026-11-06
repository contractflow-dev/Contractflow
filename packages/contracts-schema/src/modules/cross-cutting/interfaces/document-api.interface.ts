import type {
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
} from "../enums/cross-cutting.enum.js";

/**
 * Upload-permission request for a new contract document. The company and
 * contract come from the X-Company-Id and X-Contract-Id headers, never from
 * this body.
 */
export interface CreateDocumentUploadRequest {
  title: string;
  documentNumber?: string;
  category: EDocumentCategory;
  visibility: EDocumentVisibility;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Lower-case hex SHA-256 of the file. S3 rejects a body that differs. */
  checksumSha256: string;
  changeNote?: string;
}

/** Upload-permission request for a new version of an existing document. */
export interface CreateDocumentVersionUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  changeNote?: string;
}

/**
 * A short-lived presigned PUT. The browser must send exactly `method` and
 * `headers`; the URL is a bearer credential and must not be logged or stored.
 */
export interface DocumentUploadInstruction {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export interface DocumentVersionSummary {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  changeNote: string;
  uploadStatus: EDocumentUploadStatus;
  uploadedById: string;
  uploadedAt: string;
}

export interface DocumentSummary {
  id: string;
  contractId: string;
  ownerCompanyId: string;
  title: string;
  documentNumber: string;
  category: EDocumentCategory;
  visibility: EDocumentVisibility;
  status: EDocumentStatus;
  createdAt: string;
  updatedAt: string;
  /** Latest available version, or null while the first upload is pending. */
  currentVersion: DocumentVersionSummary | null;
}

export interface DocumentDetail extends DocumentSummary {
  versions: DocumentVersionSummary[];
}

export interface DocumentUploadSession {
  document: DocumentSummary;
  version: DocumentVersionSummary;
  upload: DocumentUploadInstruction;
}

export interface DocumentDownloadUrl {
  url: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}
