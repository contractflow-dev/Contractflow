import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import type { CompanyInvitationDecision } from '@contractflow/contracts-schema';

/** Answers one of the signed-in user's own invitations, named in the path. */
export class RespondMyCompanyInvitationRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['accept', 'decline'])
  decision!: CompanyInvitationDecision;
}
