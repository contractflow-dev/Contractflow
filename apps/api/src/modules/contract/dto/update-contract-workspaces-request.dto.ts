import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

const workspaces = ['project', 'hse', 'finance'] as const;

export class UpdateContractWorkspacesRequestDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(workspaces, { each: true })
  workspaces!: AssignableContractWorkspace[];
}
