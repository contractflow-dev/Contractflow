export {
  workspaceSlice,
  workspaceReducer,
  setActiveWorkspaceId,
  addRecentWorkspaceId,
  clearActiveWorkspace,
  resetWorkspace,
  selectActiveWorkspaceId,
  selectRecentWorkspaceIds,
} from "./workspaceSlice";

export type { WorkspaceState } from "./workspaceTypes";
export {
  activeCompanyStorageKey,
  clearPersistedActiveCompanyId,
  persistActiveCompanyId,
  readPersistedActiveCompanyId,
  resolveActiveCompanyId,
} from "./companySelection";
export {
  companyAccessState,
  companyLandingPath,
  resolveWorkspaceRedirect,
} from "./workspaceLanding";
export type { CompanyAccessState } from "./workspaceLanding";
