import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

export class RespondCompanyInvitationRequestDto {
  @IsString()
  @Length(43, 43)
  token!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['accept', 'decline'])
  decision!: 'accept' | 'decline';
}
