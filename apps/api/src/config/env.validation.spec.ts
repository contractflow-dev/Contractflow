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
};

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
