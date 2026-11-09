import { createHash } from 'node:crypto';
import type {
  IObjectStorage,
  IStoredObjectMetadata,
} from '../../../src/common/storage/object-storage.interface';

/** In-memory S3 stand-in that records "uploads" made through the test. */
export class InMemoryObjectStorage implements IObjectStorage {
  readonly provider = 'amazon-s3';
  readonly bucket = 'integration-bucket';
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
  }

  async createUploadUrl(request: { key: string; expiresInSeconds: number }) {
    return {
      url: `memory://${request.key}`,
      method: 'PUT' as const,
      headers: {},
      expiresAt: new Date(Date.now() + request.expiresInSeconds * 1000),
    };
  }

  async createDownloadUrl(request: { key: string }) {
    return {
      url: `memory://${request.key}?download`,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  async headObject(key: string): Promise<IStoredObjectMetadata | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      sizeBytes: object.body.length,
      contentType: object.contentType,
      checksumSha256Base64: createHash('sha256')
        .update(object.body)
        .digest('base64'),
      versionId: 'memory-version-1',
    };
  }

  async readObjectPrefix(key: string, length: number) {
    return new Uint8Array(
      this.objects.get(key)?.body.subarray(0, length) ?? [],
    );
  }

  async deleteObject(key: string) {
    this.objects.delete(key);
  }
}
