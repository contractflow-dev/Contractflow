import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
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
}

const toBool = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : value === true || value === 'true';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeHttpUrl =({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
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

  // Unset: SSL follows NODE_ENV (on in production).
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  DB_SSL?: boolean;

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

  @IsEnum(MailProvider)
  MAIL_PROVIDER!: MailProvider;

  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Smtp)
  @IsString()
  SMTP_HOST?: string;

  @ValidateIf((o: EnvVars) => o.MAIL_PROVIDER === MailProvider.Smtp)
  @Transform(({ value }) => Number(value))
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  // --- Document storage (Amazon S3) ---
  // Credentials are never configured here: the AWS SDK default provider chain
  // resolves them (ECS task role in production, AWS profile/SSO locally).

  @Transform(trimString)
  @Matches(/^[a-z]{2}(-[a-z]+)+-\d$/, {
    message: 'AWS_REGION must be an AWS region such as eu-north-1',
  })
  AWS_REGION!: string;

  @Transform(trimString)
  @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, {
    message: 'S3_BUCKET_NAME must be a valid S3 bucket name',
  })
  S3_BUCKET_NAME!: string;

  // Local S3-compatible endpoint (for example MinIO). Leave unset for AWS.
  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = trimString({ value });
    return trimmed === '' ? undefined : trimmed;
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  S3_ENDPOINT?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  S3_FORCE_PATH_STYLE?: boolean;

  // A single presigned PUT is limited to 5 GiB by S3.
  @Transform(({ value }) =>
    value === undefined || value === '' ? 25 * 1024 * 1024 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024 * 1024)
  DOCUMENT_MAX_UPLOAD_BYTES: number = 25 * 1024 * 1024;

  @Transform(({ value }) =>
    value === undefined || value === '' ? 300 : Number(value),
  )
  @IsInt()
  @Min(60)
  @Max(3600)
  DOCUMENT_UPLOAD_URL_TTL_SECONDS: number = 300;

  @Transform(({ value }) =>
    value === undefined || value === '' ? 60 : Number(value),
  )
  @IsInt()
  @Min(10)
  @Max(900)
  DOCUMENT_DOWNLOAD_URL_TTL_SECONDS: number = 60;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const config = plainToInstance(EnvVars, raw, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new Error(
      `Invalid environment configuration:\n - ${messages.join('\n - ')}`,
    );
  }
  return config;
}
