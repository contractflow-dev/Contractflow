import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WorkspaceState } from './workspaceTypes';

const initialState: WorkspaceState = {
  activeWorkspaceId: null,
  recentWorkspaceIds: [],
};

export const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.activeWorkspaceId = action.payload;
      if (action.payload && !state.recentWorkspaceIds.includes(action.payload)) {
        state.recentWorkspaceIds = [action.payload, ...state.recentWorkspaceIds].slice(0, 5);
      }
    },
    addRecentWorkspaceId: (state, action: PayloadAction<string>) => {
      if (!state.recentWorkspaceIds.includes(action.payload)) {
        state.recentWorkspaceIds = [action.payload, ...state.recentWorkspaceIds].slice(0, 5);
      }
    },
    clearActiveWorkspace: (state) => {
      state.activeWorkspaceId = null;
    },
    resetWorkspace: () => initialState,
  },
  selectors: {
    selectActiveWorkspaceId: (state) => state.activeWorkspaceId,
    selectRecentWorkspaceIds: (state) => state.recentWorkspaceIds,
  },
});

export const {
  setActiveWorkspaceId,
  addRecentWorkspaceId,
  clearActiveWorkspace,
  resetWorkspace,
} = workspaceSlice.actions;

export const { selectActiveWorkspaceId, selectRecentWorkspaceIds } =
  workspaceSlice.selectors;

export const workspaceReducer = workspaceSlice.reducer;
