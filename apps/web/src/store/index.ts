import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/services/api';
import { authReducer } from '@/features/auth';
import { onboardingReducer } from '@/features/onboarding';
import { workspaceReducer } from '@/features/workspace';
import { uiReducer } from '@/features/ui';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    onboarding: onboardingReducer,
    workspace: workspaceReducer,
    ui: uiReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
