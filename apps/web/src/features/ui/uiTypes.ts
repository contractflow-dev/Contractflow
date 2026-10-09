export type ThemeMode = 'light' | 'dark' | 'system';

export interface UiState {
  sidebarOpen: boolean;
  mobileNavOpen: boolean;
  activeModal: string | null;
  modalPayload: Record<string, unknown> | null;
  themeMode: ThemeMode;
}

export interface OpenModalPayload {
  modalId: string;
  payload?: Record<string, unknown>;
}
