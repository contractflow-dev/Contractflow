import {
  EDocumentCategory,
  EDocumentVisibility,
  type CreateDocumentUploadRequest,
  type CreateDocumentVersionUploadRequest,
} from '@contractflow/contracts-schema';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * File metadata declared by the client. The service re-validates it against
 * the allowlist and size limit; storage keys are never accepted from clients.
 */
export class DocumentFileRequestDto implements CreateDocumentVersionUploadRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  fileName!: string;

  @Transform(trimLower)
  @IsString()
  @Length(1, 127)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @Transform(trimLower)
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'checksumSha256 must be a hex-encoded SHA-256 digest',
  })
  checksumSha256!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000)
  changeNote?: string;
}

export class CreateDocumentUploadRequestDto
  extends DocumentFileRequestDto
  implements CreateDocumentUploadRequest
{
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  documentNumber?: string;

  @IsEnum(EDocumentCategory)
  category!: EDocumentCategory;

  @IsEnum(EDocumentVisibility)
  visibility!: EDocumentVisibility;
}

export class DocumentDownloadQueryDto {
  @IsOptional()
  @Matches(/^[0-9A-HJKMNP-TV-Z]{26}$/i, {
    message: 'versionId must be a valid ULID',
  })
  versionId?: string;
}
