import {
  EDocumentCategory,
  EDocumentVisibility,
} from "@contractflow/contracts-schema";

/**
 * Client-side mirror of the API's document file policy
 * (apps/api/src/modules/cross-cutting/services/document-file-policy.ts).
 * It only spares users a round trip: the server re-validates the name, size,
 * declared type and the stored bytes, and is the authority.
 */
export const DOCUMENT_FILE_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
};

/** The API's default `DOCUMENT_MAX_UPLOAD_BYTES` (25 MB). */
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Value for the file input's `accept` attribute. */
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_FILE_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

export const DOCUMENT_TYPES_LABEL =
  "PDF, Word, Excel, PowerPoint, PNG, JPEG, CSV or text";

export const DOCUMENT_CATEGORY_LABELS: Record<EDocumentCategory, string> = {
  [EDocumentCategory.CONTRACT]: "Contract",
  [EDocumentCategory.CERTIFICATE]: "Certificate",
  [EDocumentCategory.REPORT]: "Report",
  [EDocumentCategory.HSE]: "HSE",
  [EDocumentCategory.INVOICE]: "Invoice",
  [EDocumentCategory.OTHER]: "Other",
};

export const DOCUMENT_VISIBILITY_LABELS: Record<EDocumentVisibility, string> = {
  [EDocumentVisibility.PUBLIC]: "All parties",
  [EDocumentVisibility.PRIVATE]: "Your company only",
};

interface FileLike {
  name: string;
  size: number;
  type: string;
}

export function fileExtension(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1] ? match[1].toLowerCase() : null;
}

/** Why the file can't be uploaded, or null when it can. */
export function documentFileProblem(file: FileLike): string | null {
  const extension = fileExtension(file.name);
  if (!extension || !(extension in DOCUMENT_FILE_TYPES)) {
    return `This file type can't be uploaded. Choose a ${DOCUMENT_TYPES_LABEL} file.`;
  }
  if (file.size <= 0) return "This file is empty.";
  if (file.size > DOCUMENT_MAX_BYTES) {
    return "This file is larger than 25 MB.";
  }
  return null;
}

/**
 * The type declared to the API. Browsers leave `type` empty for some files
 * (often CSV), so the allowlisted type for the extension fills the gap.
 */
export function documentMimeType(file: FileLike): string {
  if (file.type) return file.type;
  const extension = fileExtension(file.name);
  return (
    (extension && DOCUMENT_FILE_TYPES[extension]) || "application/octet-stream"
  );
}
