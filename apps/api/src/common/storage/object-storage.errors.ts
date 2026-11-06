import { ServiceUnavailableException, type Logger } from '@nestjs/common';

/** Errors that mean the object is absent rather than storage being broken. */
const NOT_FOUND_ERRORS = new Set(['NoSuchKey', 'NotFound', 'NoSuchVersion']);

/** Errors that indicate deployment configuration (IAM, bucket, clock). */
const CONFIGURATION_ERRORS = new Set([
  'AccessDenied',
  'AllAccessDisabled',
  'NoSuchBucket',
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
  'RequestTimeTooSkewed',
  'ExpiredToken',
  'InvalidToken',
  'CredentialsProviderError',
  'PermanentRedirect',
  'AuthorizationHeaderMalformed',
]);

interface ProviderErrorShape {
  name?: unknown;
  Code?: unknown;
  $metadata?: { httpStatusCode?: unknown; requestId?: unknown };
}

export function storageErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'Unknown';
  const shape = error as ProviderErrorShape;
  if (typeof shape.Code === 'string') return shape.Code;
  if (typeof shape.name === 'string') return shape.name;
  return 'Unknown';
}

export function isStorageNotFound(error: unknown): boolean {
  if (NOT_FOUND_ERRORS.has(storageErrorCode(error))) return true;
  const status = (error as ProviderErrorShape | null)?.$metadata
    ?.httpStatusCode;
  return status === 404;
}

/**
 * Logs the provider failure server-side and returns a client-safe exception.
 * Raw provider messages, keys and request signatures never reach the client.
 */
export function toStorageException(
  logger: Logger,
  operation: string,
  error: unknown,
): ServiceUnavailableException {
  const code = storageErrorCode(error);
  const requestId = (error as ProviderErrorShape | null)?.$metadata?.requestId;
  const detail = `${operation} failed with ${code}${
    typeof requestId === 'string' ? ` (request ${requestId})` : ''
  }`;
  if (CONFIGURATION_ERRORS.has(code)) {
    logger.error(
      `${detail}. Check the bucket name, region and IAM permissions.`,
    );
  } else {
    logger.warn(detail);
  }
  return new ServiceUnavailableException(
    'Document storage is temporarily unavailable. Please try again.',
  );
}
