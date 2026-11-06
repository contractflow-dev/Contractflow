import type { ConfigService } from '@nestjs/config';

export interface IObjectStorageConfig {
  region: string;
  bucket: string;
  /** S3-compatible endpoint for local development; unset for AWS. */
  endpoint?: string;
  forcePathStyle: boolean;
}

export function readObjectStorageConfig(
  config: ConfigService,
): IObjectStorageConfig {
  const endpoint = config.get<string>('S3_ENDPOINT')?.trim() || undefined;
  return {
    region: config.getOrThrow<string>('AWS_REGION'),
    bucket: config.getOrThrow<string>('S3_BUCKET_NAME'),
    endpoint,
    // Custom endpoints such as MinIO usually need path-style addressing.
    forcePathStyle:
      config.get<boolean>('S3_FORCE_PATH_STYLE') ?? endpoint !== undefined,
  };
}
