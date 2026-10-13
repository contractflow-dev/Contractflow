import { IsString, Length } from 'class-validator';

export class VerifyEmailRequestDto {
  @IsString()
  @Length(32, 128)
  token!: string;
}
