import type { RecordContractSignatoryRequest } from '@contractflow/contracts-schema';
import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RecordContractSignatoryRequestDto implements RecordContractSignatoryRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  signatoryFirstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  signatoryLastName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 150)
  signatoryTitle!: string;

  @IsISO8601({ strict: true })
  signedAt!: string;
}
