import { BadRequestException } from '@nestjs/common';

/** Bytes read from a stored object to check its file signature. */
export const FILE_SIGNATURE_PREFIX_BYTES = 512;

type SignatureCheck = (prefix: Uint8Array) => boolean;

interface AllowedFileType {
  /** Content type stored and signed; the browser's value is not trusted. */
  contentType: string;
  /** Declared types browsers commonly report for this extension. */
  acceptedMimeTypes: readonly string[];
  matchesSignature: SignatureCheck;
}

const startsWith =
  (...signature: number[]): SignatureCheck =>
  (prefix) =>
    prefix.length >= signature.length &&
    signature.every((byte, index) => prefix[index] === byte);

/** Plain text: non-empty and free of NUL bytes in the inspected prefix. */
const looksLikeText: SignatureCheck = (prefix) =>
  prefix.length > 0 && !prefix.includes(0);

const PDF = startsWith(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
const PNG = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = startsWith(0xff, 0xd8, 0xff);
const ZIP = startsWith(0x50, 0x4b, 0x03, 0x04); // Office Open XML container

const OOXML = 'application/vnd.openxmlformats-officedocument';

/**
 * Allowlisted extensions. Macro-capable and legacy binary Office formats,
 * executables, archives, HTML and SVG are intentionally excluded.
 */
export const ALLOWED_DOCUMENT_FILE_TYPES: Readonly<
  Record<string, AllowedFileType>
> = Object.freeze({
  pdf: {
    contentType: 'application/pdf',
    acceptedMimeTypes: ['application/pdf'],
    matchesSignature: PDF,
  },
  png: {
    contentType: 'image/png',
    acceptedMimeTypes: ['image/png'],
    matchesSignature: PNG,
  },
  jpg: {
    contentType: 'image/jpeg',
    acceptedMimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    matchesSignature: JPEG,
  },
  jpeg: {
    contentType: 'image/jpeg',
    acceptedMimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    matchesSignature: JPEG,
  },
  docx: {
    contentType: `${OOXML}.wordprocessingml.document`,
    acceptedMimeTypes: [`${OOXML}.wordprocessingml.document`],
    matchesSignature: ZIP,
  },
  xlsx: {
    contentType: `${OOXML}.spreadsheetml.sheet`,
    acceptedMimeTypes: [`${OOXML}.spreadsheetml.sheet`],
    matchesSignature: ZIP,
  },
  pptx: {
    contentType: `${OOXML}.presentationml.presentation`,
    acceptedMimeTypes: [`${OOXML}.presentationml.presentation`],
    matchesSignature: ZIP,
  },
  csv: {
    contentType: 'text/csv',
    // Windows browsers often report CSV files as an Excel type.
    acceptedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
    matchesSignature: looksLikeText,
  },
  txt: {
    contentType: 'text/plain',
    acceptedMimeTypes: ['text/plain'],
    matchesSignature: looksLikeText,
  },
});

export interface IDocumentFileInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IValidatedDocumentFile {
  /** Display name with path segments and control characters removed. */
  fileName: string;
  extension: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Validates client-declared file metadata before any upload permission is
 * issued. The stored content type comes from the allowlist, not the browser.
 */
export function validateDocumentFile(
  input: IDocumentFileInput,
  maxUploadBytes: number,
): IValidatedDocumentFile {
  const fileName = sanitizeFileName(input.fileName);
  const extension = fileExtension(fileName);
  const allowed = extension
    ? ALLOWED_DOCUMENT_FILE_TYPES[extension]
    : undefined;
  if (!extension || !allowed) {
    throw new BadRequestException(
      `Unsupported file type. Allowed types: ${allowedExtensionsLabel()}.`,
    );
  }

  const declaredMimeType = input.mimeType.split(';')[0].trim().toLowerCase();
  if (!allowed.acceptedMimeTypes.includes(declaredMimeType)) {
    throw new BadRequestException(
      'The file content type does not match its extension.',
    );
  }

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) {
    throw new BadRequestException('The file is empty.');
  }
  if (input.sizeBytes > maxUploadBytes) {
    throw new BadRequestException(
      `The file exceeds the ${formatBytes(maxUploadBytes)} upload limit.`,
    );
  }

  return {
    fileName,
    extension,
    contentType: allowed.contentType,
    sizeBytes: input.sizeBytes,
  };
}

/** True when the stored bytes start with the signature expected for the type. */
export function matchesDocumentFileSignature(
  extension: string,
  prefix: Uint8Array,
): boolean {
  const allowed = ALLOWED_DOCUMENT_FILE_TYPES[extension];
  return allowed ? allowed.matchesSignature(prefix) : false;
}

export function sanitizeFileName(rawFileName: string): string {
  const baseName = rawFileName.split(/[\\/]/).pop() ?? '';
  const cleaned = baseName
    // Control characters and characters that are unsafe in headers/paths.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  if (!cleaned) {
    throw new BadRequestException('A valid file name is required.');
  }
  if (cleaned.length <= 255) return cleaned;

  const extension = fileExtension(cleaned);
  const suffix = extension ? `.${extension}` : '';
  return `${cleaned.slice(0, 255 - suffix.length)}${suffix}`;
}

export function fileExtension(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Object keys are generated only here, from server-side identifiers. The
 * original file name is never part of the key.
 */
export function buildDocumentStorageKey(parts: {
  companyId: string;
  contractId: string;
  documentId: string;
  versionId: string;
  extension: string;
}): string {
  for (const value of [
    parts.companyId,
    parts.contractId,
    parts.documentId,
    parts.versionId,
  ]) {
    if (!/^[0-9A-Za-z]{26}$/.test(value)) {
      throw new Error('Storage keys require ULID identifiers');
    }
  }
  if (!ALLOWED_DOCUMENT_FILE_TYPES[parts.extension]) {
    throw new Error('Storage keys require an allowlisted extension');
  }
  return [
    'companies',
    parts.companyId,
    'contracts',
    parts.contractId,
    'documents',
    parts.documentId,
    `${parts.versionId}.${parts.extension}`,
  ].join('/');
}

export function sha256HexToBase64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

function allowedExtensionsLabel(): string {
  return Object.keys(ALLOWED_DOCUMENT_FILE_TYPES).join(', ');
}

function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`
    : `${bytes} bytes`;
}
