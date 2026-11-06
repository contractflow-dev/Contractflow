import { IsString, Length } from 'class-validator';

export class VerifyCompanyEmailRequestDto {
  // 32 random bytes encoded as base64url.
  @IsString()
  @Length(43, 43)
  token!: string;
}
