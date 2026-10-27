import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Length,
  Min,
} from 'class-validator';
import {
  EContractType,
  ECurrencyCode,
  EPartyType,
} from '@contractflow/contracts-schema';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

const workspaces = ['project', 'hse', 'finance'] as const;

export class CreateContractRequestDto {
  @IsString()
  @Length(1, 40)
  referenceNumber!: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(EContractType)
  contractType!: EContractType;

  @IsEnum(EPartyType)
  partyType!: EPartyType;

  @IsArray()
  @ArrayUnique()
  @IsIn(workspaces, { each: true })
  workspaces!: AssignableContractWorkspace[];

  @IsOptional()
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i)
  parentContractId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  originalValueMinor!: number;

  @IsEnum(ECurrencyCode)
  currencyCode!: ECurrencyCode;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  retentionRateBps!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  advancePaymentRateBps?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  liquidatedDamagesPerDayMinor?: number | null;

  @IsDateString()
  awardDate!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsDateString()
  revisedEndDate?: string | null;

  @IsOptional()
  @IsDateString()
  actualCompletionDate?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  defectsLiabilityDays!: number;

  @IsString()
  @Length(1, 64)
  @IsTimeZone()
  timezone!: string;
}
