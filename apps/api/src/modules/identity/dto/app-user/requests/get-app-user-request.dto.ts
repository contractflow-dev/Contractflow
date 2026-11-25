import { Matches } from 'class-validator';
import { ULID_PATTERN } from '@contractflow/contracts-schema';

export class GetAppUserDto {
  @Matches(ULID_PATTERN)
  id: string;
}
