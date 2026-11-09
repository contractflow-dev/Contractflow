import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  buildDocumentStorageKey,
  matchesDocumentFileSignature,
  sanitizeFileName,
  sha256HexToBase64,
  validateDocumentFile,
} from './document-file-policy';

const MAX = 10 * 1024 * 1024;
const COMPANY = '01J0000000000000000000000A';
const CONTRACT = '01J0000000000000000000000B';
const DOCUMENT = '01J0000000000000000000000C';
const VERSION = '01J0000000000000000000000D';

describe('validateDocumentFile', () => {
  it('accepts an allowlisted file and stores the canonical content type', () => {
    expect(
      validateDocumentFile(
        { fileName: 'Photo.JPG', mimeType: 'image/jpg', sizeBytes: 2048 },
        MAX,
      ),
    ).toEqual({
      fileName: 'Photo.JPG',
      extension: 'jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
    });
  });

  it('accepts a declared type with parameters', () => {
    expect(
      validateDocumentFile(
        {
          fileName: 'rates.csv',
          mimeType: 'text/csv; charset=utf-8',
          sizeBytes: 10,
        },
        MAX,
      ).contentType,
    ).toBe('text/csv');
  });

  it.each([
    ['payload.exe', 'application/octet-stream'],
    ['page.html', 'text/html'],
    ['drawing.svg', 'image/svg+xml'],
    ['macro.docm', 'application/vnd.ms-word.document.macroenabled.12'],
    ['archive.zip', 'application/zip'],
    ['no-extension', 'application/pdf'],
  ])('rejects the unsupported file %s', (fileName, mimeType) => {
    expect(() =>
      validateDocumentFile({ fileName, mimeType, sizeBytes: 10 }, MAX),
    ).toThrow('Unsupported file type');
  });

  it('rejects a content type that does not match the extension', () => {
    expect(() =>
      validateDocumentFile(
        { fileName: 'invoice.pdf', mimeType: 'text/html', sizeBytes: 10 },
        MAX,
      ),
    ).toThrow('does not match');
  });

  it.each([0, -1, 1.5])('rejects the invalid size %s', (sizeBytes) => {
    expect(() =>
      validateDocumentFile(
        { fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes },
        MAX,
      ),
    ).toThrow(BadRequestException);
  });

  it('enforces the configured size limit', () => {
    expect(() =>
      validateDocumentFile(
        { fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: MAX + 1 },
        MAX,
      ),
    ).toThrow('10 MB upload limit');
  });
});

describe('sanitizeFileName', () => {
  it('strips directory segments and control characters', () => {
    expect(sanitizeFileName('..\\..\\etc/pass\u0000wd<1>.pdf')).toBe(
      'passwd1.pdf',
    );
    expect(sanitizeFileName('  quarterly   report.pdf ')).toBe(
      'quarterly report.pdf',
    );
  });

  it('rejects names with nothing usable', () => {
    expect(() => sanitizeFileName('../')).toThrow('valid file name');
    expect(() => sanitizeFileName('...')).toThrow('valid file name');
  });

  it('shortens long names while keeping the extension', () => {
    const name = sanitizeFileName(`${'a'.repeat(300)}.pdf`);
    expect(name).toHaveLength(255);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('matchesDocumentFileSignature', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it.each([
    ['pdf', bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)],
    ['png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['docx', bytes(0x50, 0x4b, 0x03, 0x04)],
    ['csv', new TextEncoder().encode('a,b\n1,2')],
  ])('accepts a genuine %s', (extension, prefix) => {
    expect(matchesDocumentFileSignature(extension, prefix)).toBe(true);
  });

  it.each([
    ['pdf', new TextEncoder().encode('<html><script>')],
    ['png', bytes(0x25, 0x50, 0x44, 0x46)],
    ['csv', bytes(0x4d, 0x5a, 0x00, 0x90)],
    ['pdf', bytes()],
    ['exe', bytes(0x4d, 0x5a)],
  ])('rejects %s content with the wrong signature', (extension, prefix) => {
    expect(matchesDocumentFileSignature(extension, prefix)).toBe(false);
  });
});

describe('buildDocumentStorageKey', () => {
  it('builds a company and contract namespaced key from server identifiers', () => {
    expect(
      buildDocumentStorageKey({
        companyId: COMPANY,
        contractId: CONTRACT,
        documentId: DOCUMENT,
        versionId: VERSION,
        extension: 'pdf',
      }),
    ).toBe(
      `companies/${COMPANY}/contracts/${CONTRACT}/documents/${DOCUMENT}/${VERSION}.pdf`,
    );
  });

  it('keeps company-wide documents under the company, outside any contract', () => {
    expect(
      buildDocumentStorageKey({
        companyId: COMPANY,
        contractId: null,
        documentId: DOCUMENT,
        versionId: VERSION,
        extension: 'pdf',
      }),
    ).toBe(`companies/${COMPANY}/documents/${DOCUMENT}/${VERSION}.pdf`);
  });

  it.each([
    { companyId: '../other-company' },
    { documentId: 'a/b' },
    { extension: 'html' },
  ])('refuses unsafe key parts %o', (override) => {
    expect(() =>
      buildDocumentStorageKey({
        companyId: COMPANY,
        contractId: CONTRACT,
        documentId: DOCUMENT,
        versionId: VERSION,
        extension: 'pdf',
        ...override,
      }),
    ).toThrow();
  });
});

describe('sha256HexToBase64', () => {
  it('converts a hex digest to the base64 form S3 expects', () => {
    expect(
      sha256HexToBase64(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ),
    ).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });
});
