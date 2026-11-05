import { validate } from 'class-validator';
import { GetAppUserDto } from './get-app-user-request.dto';

describe('GetAppUserDto', () => {
  it('accepts a ULID identifier', async () => {
    const dto = new GetAppUserDto();
    dto.id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects UUID identifiers', async () => {
    const dto = new GetAppUserDto();
    dto.id = '550e8400-e29b-41d4-a716-446655440000';

    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('rejects ULIDs with values outside the ULID range', async () => {
    const dto = new GetAppUserDto();
    dto.id = '81ARZ3NDEKTSV4RRFFQ69G5FAV';

    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
