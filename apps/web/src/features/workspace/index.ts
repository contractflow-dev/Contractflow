export {
  workspaceSlice,
  workspaceReducer,
  setActiveWorkspaceId,
  addRecentWorkspaceId,
  clearActiveWorkspace,
  resetWorkspace,
  selectActiveWorkspaceId,
  selectRecentWorkspaceIds,
} from './workspaceSlice';

export type { WorkspaceState } from './workspaceTypes';
