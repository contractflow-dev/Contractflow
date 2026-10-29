import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum MailProvider {
  Smtp = 'smtp',
  Ses = 'ses',
  Resend = 'resend',
}

const toBool = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : value === true || value === 'true';

const normalizeHttpUrl = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();

  if (!trimmed || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @Transform(({ value }) =>
    value === undefined || value === '' ? 30 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(365)
  COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS: number = 30;

  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must start with postgres://',
  })
  DATABASE_URL!: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  DB_SYNC?: boolean;

  @Transform(toBool)
  @IsBoolean()
  DB_SSL: boolean = false;

  @Transform(normalizeHttpUrl)
  @IsUrl({ require_tld: false })
  WEB_URL!: string;

  @IsOptional()
  @Transform(normalizeHttpUrl)
  @IsString()
  CORS_ORIGIN?: string;

  @ValidateIf((o: EnvVars) => o.NODE_ENV === NodeEnv.Development)
  @IsString()
  @MinLength(32)
  JWT_SECRET?: string;

  /*
   * Mail provider
   */
  @IsEnum(MailProvider)
  MAIL_PROVIDER!: MailProvider;

  /*
   * Amazon SES
   */
  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Ses)
  @IsString()
  AWS_REGION?: string;

  @IsOptional()
  @IsString()
  AWS_PROFILE?: string;

  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Ses)
  @IsEmail()
  SES_FROM_EMAIL?: string;

  /*
   * SMTP
   */
  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Smtp)
  @IsString()
  SMTP_HOST?: string;

  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Smtp)
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  SMTP_SECURE?: boolean;

  /*
   * Resend
   */
  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Resend)
  @IsString()
  RESEND_API_KEY?: string;

  /*
   * Shared sender configuration
   */
  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const config = plainToInstance(EnvVars, raw, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );

    throw new Error(
      `Invalid environment configuration:\n - ${messages.join('\n - ')}`,
    );
  }

  return config;
}
