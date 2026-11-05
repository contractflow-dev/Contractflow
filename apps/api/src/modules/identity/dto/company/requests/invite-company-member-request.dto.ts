import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { EInvitationRole } from '@contractflow/contracts-schema';

export class InviteCompanyMemberRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(EInvitationRole)
  companyRole!: EInvitationRole;
}
