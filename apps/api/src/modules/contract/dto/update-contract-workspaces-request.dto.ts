import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

const workspaces = ['project', 'hse', 'finance'] as const;

export class UpdateContractWorkspacesRequestDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(workspaces, { each: true })
  workspaces!: AssignableContractWorkspace[];
}

/** Body of adding one workspace to the header contract. */
export class AddContractWorkspaceRequestDto {
  @IsIn(workspaces)
  workspace!: AssignableContractWorkspace;
}

/** The workspace named in the path, for removal and its impact. */
export class ContractWorkspaceParamDto {
  @IsIn(workspaces)
  workspace!: AssignableContractWorkspace;
}
