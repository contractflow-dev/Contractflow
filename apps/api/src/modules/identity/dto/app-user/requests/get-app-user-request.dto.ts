import { Matches } from 'class-validator';

export class GetAppUserDto {
  @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i)
  id: string;
}
