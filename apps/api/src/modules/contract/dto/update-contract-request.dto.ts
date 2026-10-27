import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateContractRequestDto } from './create-contract-request.dto';

export class UpdateContractRequestDto extends PartialType(
  OmitType(CreateContractRequestDto, [
    'referenceNumber',
    'partyType',
    'workspaces',
  ] as const),
) {}
