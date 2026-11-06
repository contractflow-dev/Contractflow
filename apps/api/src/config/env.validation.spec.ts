import { describe, expect, it } from 'vitest';
import { MailProvider, NodeEnv, validateEnv } from './env.validation';

const validEnvironment = {
  NODE_ENV: NodeEnv.Test,
  PORT: '3001',
  DATABASE_URL: 'postgres://user:password@localhost:5432/contractflow',
  WEB_URL: 'http://localhost:3000',
  MAIL_PROVIDER: MailProvider.Smtp,
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  AWS_REGION: 'eu-north-1',
  S3_BUCKET_NAME: 'contractflow-app-storage-191518190571',
};

describe('document storage environment settings', () => {
  it('accepts the S3 region and bucket with safe upload defaults', () => {
    const config = validateEnv(validEnvironment);

    expect(config.AWS_REGION).toBe('eu-north-1');
    expect(config.S3_BUCKET_NAME).toBe('contractflow-app-storage-191518190571');
    expect(config.S3_ENDPOINT).toBeUndefined();
    expect(config.DOCUMENT_MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(config.DOCUMENT_UPLOAD_URL_TTL_SECONDS).toBe(300);
    expect(config.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS).toBe(60);
  });

  it('does not require static AWS credentials', () => {
    const config = validateEnv(validEnvironment);

    expect(config).not.toHaveProperty('AWS_ACCESS_KEY_ID');
    expect(config).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
  });

  it.each(['AWS_REGION', 'S3_BUCKET_NAME'])(
    'fails startup when %s is missing',
    (key) => {
      const environment: Record<string, unknown> = { ...validEnvironment };
      delete environment[key];

      expect(() => validateEnv(environment)).toThrow(key);
    },
  );

  it.each([
    ['AWS_REGION', 'Europe North'],
    ['S3_BUCKET_NAME', 'Invalid_Bucket'],
    ['S3_ENDPOINT', 'localhost:9000'],
    ['DOCUMENT_MAX_UPLOAD_BYTES', '0'],
    ['DOCUMENT_UPLOAD_URL_TTL_SECONDS', '86400'],
    ['DOCUMENT_DOWNLOAD_URL_TTL_SECONDS', '5'],
  ])('rejects an invalid %s', (key, value) => {
    expect(() => validateEnv({ ...validEnvironment, [key]: value })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('treats blank optional storage settings as unset', () => {
    const config = validateEnv({
      ...validEnvironment,
      S3_ENDPOINT: '',
      S3_FORCE_PATH_STYLE: '',
      DOCUMENT_MAX_UPLOAD_BYTES: '',
    });

    expect(config.S3_ENDPOINT).toBeUndefined();
    expect(config.S3_FORCE_PATH_STYLE).toBeUndefined();
    expect(config.DOCUMENT_MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });

  it('accepts a local S3-compatible endpoint', () => {
    const config = validateEnv({
      ...validEnvironment,
      S3_ENDPOINT: 'http://localhost:9000',
      S3_FORCE_PATH_STYLE: 'true',
    });

    expect(config.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(config.S3_FORCE_PATH_STYLE).toBe(true);
  });
});

describe('dashboard expiry environment setting', () => {
  it('defaults to a 30-day expiry window', () => {
    const config = validateEnv(validEnvironment);

    expect(config.COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS).toBe(30);
  });

  it('accepts a configured positive whole-day window up to one year', () => {
    const config = validateEnv({
      ...validEnvironment,
      COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS: '45',
    });

    expect(config.COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS).toBe(45);
  });

  it('rejects values outside the supported range', () => {
    expect(() =>
      validateEnv({
        ...validEnvironment,
        COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS: '0',
      }),
    ).toThrow('Invalid environment configuration');
  });
});
