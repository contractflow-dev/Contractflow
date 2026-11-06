import { createHash, randomUUID } from 'node:crypto';
import {
  S3ObjectStorage,
  createS3Client,
} from '../../../src/common/storage/s3-object-storage';

/**
 * Opt-in check against a real S3-compatible bucket. Never point it at the
 * production bucket. Credentials come from the AWS default provider chain
 * (AWS_PROFILE, SSO, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for MinIO).
 *
 *   TEST_S3_BUCKET=contractflow-dev-test TEST_S3_REGION=eu-north-1 \
 *     pnpm --filter @contractflow/api test:integration -- test/integration/storage
 *
 * Add TEST_S3_ENDPOINT=http://localhost:9000 for MinIO.
 */
const bucket = process.env.TEST_S3_BUCKET?.trim();

describe.skipIf(!bucket)('S3ObjectStorage against a live bucket', () => {
  const endpoint = process.env.TEST_S3_ENDPOINT?.trim() || undefined;
  const config = {
    region: process.env.TEST_S3_REGION?.trim() || 'eu-north-1',
    bucket: bucket ?? '',
    endpoint,
    forcePathStyle: endpoint !== undefined,
  };
  const storage = new S3ObjectStorage(createS3Client(config), config);
  const body = Buffer.from('%PDF-1.7\nintegration check\n%%EOF\n');
  const checksum = createHash('sha256').update(body).digest('base64');
  const key = `integration-tests/${randomUUID()}/document.pdf`;

  afterAll(async () => {
    await storage.deleteObject(key);
    storage.onModuleDestroy();
  });

  async function presign() {
    return storage.createUploadUrl({
      key,
      contentType: 'application/pdf',
      contentLength: body.length,
      checksumSha256Base64: checksum,
      expiresInSeconds: 120,
    });
  }

  it('rejects a body that differs from the signed checksum', async () => {
    const upload = await presign();
    const tampered = Buffer.from(body);
    tampered[tampered.length - 2] = 0x41;

    const response = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: tampered,
    });

    expect(response.ok).toBe(false);
    await expect(storage.headObject(key)).resolves.toBeNull();
  });

  it('rejects a content type that differs from the signed one', async () => {
    const upload = await presign();

    const response = await fetch(upload.url, {
      method: upload.method,
      headers: { ...upload.headers, 'Content-Type': 'text/html' },
      body,
    });

    expect(response.status).toBe(403);
  });

  it('accepts the signed upload and exposes it through a presigned GET', async () => {
    const upload = await presign();
    const put = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body,
    });
    expect(put.ok).toBe(true);

    await expect(storage.headObject(key)).resolves.toMatchObject({
      sizeBytes: body.length,
      contentType: 'application/pdf',
      checksumSha256Base64: checksum,
    });
    const prefix = await storage.readObjectPrefix(key, 5);
    expect(Buffer.from(prefix).toString('latin1')).toBe('%PDF-');

    const download = await storage.createDownloadUrl({
      key,
      fileName: 'Method statement.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 60,
    });
    const get = await fetch(download.url);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-disposition')).toContain(
      'Method%20statement.pdf',
    );
    expect(Buffer.from(await get.arrayBuffer()).equals(body)).toBe(true);

    await storage.deleteObject(key);
    await expect(storage.headObject(key)).resolves.toBeNull();
  });
});
