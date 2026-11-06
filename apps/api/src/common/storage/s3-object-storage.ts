import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { IObjectStorageConfig } from './object-storage.config';
import {
  isStorageNotFound,
  storageErrorCode,
  toStorageException,
} from './object-storage.errors';
import type {
  IObjectStorage,
  IPresignedDownload,
  IPresignedDownloadRequest,
  IPresignedUpload,
  IPresignedUploadRequest,
  IStoredObjectMetadata,
} from './object-storage.interface';

/** Headers that the browser must send exactly as signed. */
const SIGNED_UPLOAD_HEADERS = new Set(['content-type', 'content-length']);
/** Kept as a signed header rather than a query parameter, so S3 checks it. */
const UNHOISTABLE_UPLOAD_HEADERS = new Set(['x-amz-checksum-sha256']);

export function createS3Client(config: IObjectStorageConfig): S3Client {
  // No `credentials` option: the default provider chain resolves the ECS task
  // role in production and env/profile/SSO credentials locally.
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 15_000 },
    // Default CRC32 checksums would be baked into presigned URLs and break
    // browser uploads; this service supplies an explicit SHA-256 instead.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/**
 * Amazon S3 implementation of the object storage port. One client is created
 * per application and reused for every request.
 */
export class S3ObjectStorage implements IObjectStorage, OnModuleDestroy {
  readonly provider = 'amazon-s3';
  readonly bucket: string;
  private readonly logger = new Logger(S3ObjectStorage.name);

  constructor(
    private readonly client: S3Client,
    config: Pick<IObjectStorageConfig, 'bucket'>,
  ) {
    this.bucket = config.bucket;
  }

  async createUploadUrl(
    request: IPresignedUploadRequest,
  ): Promise<IPresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: request.key,
      ContentType: request.contentType,
      ContentLength: request.contentLength,
      ChecksumSHA256: request.checksumSha256Base64,
    });
    try {
      const url = await getSignedUrl(this.client, command, {
        expiresIn: request.expiresInSeconds,
        signableHeaders: SIGNED_UPLOAD_HEADERS,
        unhoistableHeaders: UNHOISTABLE_UPLOAD_HEADERS,
      });
      return {
        url,
        method: 'PUT',
        // Browsers set Content-Length themselves from the body.
        headers: {
          'Content-Type': request.contentType,
          'x-amz-checksum-sha256': request.checksumSha256Base64,
        },
        expiresAt: this.expiry(request.expiresInSeconds),
      };
    } catch (error) {
      throw toStorageException(this.logger, 'Presigning an upload', error);
    }
  }

  async createDownloadUrl(
    request: IPresignedDownloadRequest,
  ): Promise<IPresignedDownload> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: request.key,
      ResponseContentType: request.contentType,
      ResponseContentDisposition: contentDisposition(request.fileName),
    });
    try {
      const url = await getSignedUrl(this.client, command, {
        expiresIn: request.expiresInSeconds,
      });
      return { url, expiresAt: this.expiry(request.expiresInSeconds) };
    } catch (error) {
      throw toStorageException(this.logger, 'Presigning a download', error);
    }
  }

  async headObject(key: string): Promise<IStoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ChecksumMode: 'ENABLED',
        }),
      );
      return {
        sizeBytes: Number(result.ContentLength ?? 0),
        contentType: result.ContentType ?? null,
        checksumSha256Base64: result.ChecksumSHA256 ?? null,
        versionId: result.VersionId ?? null,
      };
    } catch (error) {
      if (isStorageNotFound(error)) return null;
      throw toStorageException(this.logger, 'Reading object metadata', error);
    }
  }

  async readObjectPrefix(key: string, length: number): Promise<Uint8Array> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${Math.max(length, 1) - 1}`,
        }),
      );
      if (!result.Body) return new Uint8Array();
      const bytes = await result.Body.transformToByteArray();
      return bytes.subarray(0, length);
    } catch (error) {
      // An empty object cannot satisfy any byte range.
      if (storageErrorCode(error) === 'InvalidRange') return new Uint8Array();
      throw toStorageException(this.logger, 'Reading object content', error);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      // With bucket versioning enabled this adds a delete marker and keeps
      // prior versions recoverable under the bucket's lifecycle rules.
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isStorageNotFound(error)) return;
      throw toStorageException(this.logger, 'Deleting an object', error);
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  private expiry(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }
}

/** RFC 6266 attachment header with an ASCII fallback and a UTF-8 name. */
export function contentDisposition(fileName: string): string {
  const fallback =
    fileName
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'document';
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
