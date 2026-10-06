import { IsUUID } from 'class-validator';

export class GetAppUserDto {
  @IsUUID()
  id: string;
}
