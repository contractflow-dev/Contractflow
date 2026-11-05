import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompanyInvitationTokenRequestDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}
