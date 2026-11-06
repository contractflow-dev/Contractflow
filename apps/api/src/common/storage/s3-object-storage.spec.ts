import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readObjectStorageConfig } from './object-storage.config';
import {
  contentDisposition,
  createS3Client,
  S3ObjectStorage,
} from './s3-object-storage';

const CHECKSUM = 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=';

function providerError(name: string, httpStatusCode = 400) {
  return Object.assign(new Error(`${name}: raw provider detail`), {
    name,
    $metadata: { httpStatusCode, requestId: 'req-1' },
  });
}

function storageWithClient() {
  // Static fake credentials keep presigning offline; nothing is sent to AWS.
  const client = new S3Client({
    region: 'eu-north-1',
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  const send = vi.fn();
  client.send = send as unknown as S3Client['send'];
  const storage = new S3ObjectStorage(client, { bucket: 'contractflow-test' });
  return { client, send, storage };
}

describe('S3ObjectStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('createUploadUrl', () => {
    it('signs the content type, exact length and SHA-256 checksum', async () => {
      const { storage } = storageWithClient();

      const upload = await storage.createUploadUrl({
        key: 'companies/c/contracts/k/documents/d/v.pdf',
        contentType: 'application/pdf',
        contentLength: 1234,
        checksumSha256Base64: CHECKSUM,
        expiresInSeconds: 300,
      });

      const url = new URL(upload.url);
      expect(url.hostname).toBe(
        'contractflow-test.s3.eu-north-1.amazonaws.com',
      );
      expect(url.pathname).toBe('/companies/c/contracts/k/documents/d/v.pdf');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-length;content-type;host;x-amz-checksum-sha256',
      );
      // The checksum must be sent as a signed header, not a query parameter.
      expect(url.searchParams.has('x-amz-checksum-sha256')).toBe(false);
      expect(url.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false);
      expect(upload.url).not.toContain('secret');
      expect(upload.method).toBe('PUT');
      expect(upload.headers).toEqual({
        'Content-Type': 'application/pdf',
        'x-amz-checksum-sha256': CHECKSUM,
      });
      expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('createDownloadUrl', () => {
    it('presigns a short-lived GET that downloads under the original name', async () => {
      const { storage } = storageWithClient();

      const download = await storage.createDownloadUrl({
        key: 'companies/c/contracts/k/documents/d/v.pdf',
        fileName: 'Site plan (rev 2).pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 60,
      });

      const url = new URL(download.url);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
      expect(url.searchParams.get('response-content-type')).toBe(
        'application/pdf',
      );
      expect(url.searchParams.get('response-content-disposition')).toBe(
        contentDisposition('Site plan (rev 2).pdf'),
      );
    });
  });

  describe('headObject', () => {
    it('maps object metadata, requesting the stored checksum', async () => {
      const { send, storage } = storageWithClient();
      send.mockResolvedValue({
        ContentLength: 42,
        ContentType: 'application/pdf',
        ChecksumSHA256: CHECKSUM,
        VersionId: 'v-1',
      });

      await expect(storage.headObject('key')).resolves.toEqual({
        sizeBytes: 42,
        contentType: 'application/pdf',
        checksumSha256Base64: CHECKSUM,
        versionId: 'v-1',
      });
      const command = send.mock.calls[0][0] as HeadObjectCommand;
      expect(command).toBeInstanceOf(HeadObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'contractflow-test',
        Key: 'key',
        ChecksumMode: 'ENABLED',
      });
    });

    it.each(['NotFound', 'NoSuchKey'])('returns null for %s', async (name) => {
      const { send, storage } = storageWithClient();
      send.mockRejectedValue(providerError(name, 404));

      await expect(storage.headObject('missing')).resolves.toBeNull();
    });

    it.each([
      'AccessDenied',
      'NoSuchBucket',
      'InvalidAccessKeyId',
      'SignatureDoesNotMatch',
      'RequestExpired',
      'TimeoutError',
    ])('hides %s behind a service-unavailable error', async (name) => {
      const { send, storage } = storageWithClient();
      send.mockRejectedValue(providerError(name, 403));

      const failure = storage.headObject('key');
      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(failure).rejects.not.toThrow('raw provider detail');
    });
  });

  describe('readObjectPrefix', () => {
    it('requests only the leading byte range', async () => {
      const { send, storage } = storageWithClient();
      send.mockResolvedValue({
        Body: {
          transformToByteArray: async () => new Uint8Array([1, 2, 3, 4, 5]),
        },
      });

      await expect(storage.readObjectPrefix('key', 4)).resolves.toEqual(
        new Uint8Array([1, 2, 3, 4]),
      );
      const command = send.mock.calls[0][0] as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input.Range).toBe('bytes=0-3');
    });

    it('returns no bytes for an empty object', async () => {
      const { send, storage } = storageWithClient();
      send.mockRejectedValue(providerError('InvalidRange', 416));

      await expect(storage.readObjectPrefix('key', 8)).resolves.toEqual(
        new Uint8Array(),
      );
    });
  });

  describe('deleteObject', () => {
    it('deletes the object from the configured bucket', async () => {
      const { send, storage } = storageWithClient();
      send.mockResolvedValue({});

      await storage.deleteObject('key');

      const command = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'contractflow-test',
        Key: 'key',
      });
    });

    it('treats an already missing object as deleted', async () => {
      const { send, storage } = storageWithClient();
      send.mockRejectedValue(providerError('NoSuchKey', 404));

      await expect(storage.deleteObject('key')).resolves.toBeUndefined();
    });

    it('reports other deletion failures as unavailable', async () => {
      const { send, storage } = storageWithClient();
      send.mockRejectedValue(providerError('AccessDenied', 403));

      await expect(storage.deleteObject('key')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  it('destroys the shared client on shutdown', () => {
    const { client, storage } = storageWithClient();
    const destroy = vi.spyOn(client, 'destroy');

    storage.onModuleDestroy();

    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe('S3 client configuration', () => {
  const config = (values: Record<string, unknown>) =>
    ({
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        if (values[key] === undefined) throw new Error(`${key} missing`);
        return values[key];
      },
    }) as unknown as ConfigService;

  it('reads the region and bucket from configuration', async () => {
    const storageConfig = readObjectStorageConfig(
      config({
        AWS_REGION: 'eu-north-1',
        S3_BUCKET_NAME: 'contractflow-app-storage-191518190571',
      }),
    );
    expect(storageConfig).toEqual({
      region: 'eu-north-1',
      bucket: 'contractflow-app-storage-191518190571',
      endpoint: undefined,
      forcePathStyle: false,
    });

    const client = createS3Client(storageConfig);
    await expect(client.config.region()).resolves.toBe('eu-north-1');
    expect(client.config.forcePathStyle).toBe(false);
    client.destroy();
  });

  it('uses path-style addressing for a custom endpoint by default', () => {
    expect(
      readObjectStorageConfig(
        config({
          AWS_REGION: 'eu-north-1',
          S3_BUCKET_NAME: 'local-bucket',
          S3_ENDPOINT: 'http://localhost:9000',
        }),
      ),
    ).toMatchObject({
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
    });
  });

  it('requires the region and bucket', () => {
    expect(() => readObjectStorageConfig(config({}))).toThrow('AWS_REGION');
  });
});

describe('contentDisposition', () => {
  it('adds an ASCII fallback and a UTF-8 file name', () => {
    expect(contentDisposition('Résumé "final".pdf')).toBe(
      `attachment; filename="R_sum_ _final_.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%22final%22.pdf`,
    );
  });
});
