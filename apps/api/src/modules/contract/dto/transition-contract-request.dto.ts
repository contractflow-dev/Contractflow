import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

export const CONTRACT_TRANSITIONS = [
  'activate',
  'hold',
  'resume',
  'complete',
] as const;

export type ContractTransition = (typeof CONTRACT_TRANSITIONS)[number];

export class TransitionContractRequestDto {
  @IsIn(CONTRACT_TRANSITIONS)
  transition!: ContractTransition;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  reason!: string;
}
