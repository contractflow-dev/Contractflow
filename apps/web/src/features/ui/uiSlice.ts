import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OpenModalPayload, ThemeMode, UiState } from './uiTypes';

const initialState: UiState = {
  sidebarOpen: true,
  mobileNavOpen: false,
  activeModal: null,
  modalPayload: null,
  themeMode: 'system',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleMobileNav: (state) => {
      state.mobileNavOpen = !state.mobileNavOpen;
    },
    setMobileNavOpen: (state, action: PayloadAction<boolean>) => {
      state.mobileNavOpen = action.payload;
    },
    openModal: (state, action: PayloadAction<OpenModalPayload>) => {
      state.activeModal = action.payload.modalId;
      state.modalPayload = action.payload.payload ?? null;
    },
    closeModal: (state) => {
      state.activeModal = null;
      state.modalPayload = null;
    },
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
    },
  },
  selectors: {
    selectSidebarOpen: (state) => state.sidebarOpen,
    selectMobileNavOpen: (state) => state.mobileNavOpen,
    selectActiveModal: (state) => state.activeModal,
    selectModalPayload: (state) => state.modalPayload,
    selectThemeMode: (state) => state.themeMode,
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleMobileNav,
  setMobileNavOpen,
  openModal,
  closeModal,
  setThemeMode,
} = uiSlice.actions;

export const {
  selectSidebarOpen,
  selectMobileNavOpen,
  selectActiveModal,
  selectModalPayload,
  selectThemeMode,
} = uiSlice.selectors;

export const uiReducer = uiSlice.reducer;
