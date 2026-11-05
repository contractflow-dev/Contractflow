import { IsString, Length } from 'class-validator';

export class CompanyInvitationTokenRequestDto {
  @IsString()
  @Length(43, 43)
  token!: string;
}
