import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { isUlid } from '@contractflow/contracts-schema';

/**
 * Accepts a route parameter only when it is a ULID record identifier, so a
 * malformed id is answered 400 before any lookup rather than reaching the
 * database. It decides nothing about access: the service still checks it.
 */
@Injectable()
export class ParseUlidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown, metadata: ArgumentMetadata): string {
    if (!isUlid(value)) {
      throw new BadRequestException(
        `${metadata.data ?? 'The identifier'} must be a valid ULID.`,
      );
    }
    return value;
  }
}
