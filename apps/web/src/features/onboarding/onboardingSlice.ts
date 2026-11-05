import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ECompanyRole } from '@contractflow/contracts-schema';
import type { OnboardingState, OnboardingStep } from './onboardingTypes';

const initialState: OnboardingState = {
  currentStep: 'profile',
  selectedRole: null,
  selectedWorkspaceId: null,
  isCompleted: false,
};

export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
      if (action.payload === 'completed') {
        state.isCompleted = true;
      }
    },
    setSelectedRole: (state, action: PayloadAction<ECompanyRole | null>) => {
      state.selectedRole = action.payload;
    },
    setSelectedWorkspaceId: (state, action: PayloadAction<string | null>) => {
      state.selectedWorkspaceId = action.payload;
    },
    setCompleted: (state, action: PayloadAction<boolean>) => {
      state.isCompleted = action.payload;
      if (action.payload) {
        state.currentStep = 'completed';
      }
    },
    resetOnboarding: () => initialState,
  },
  selectors: {
    selectCurrentStep: (state) => state.currentStep,
    selectSelectedRole: (state) => state.selectedRole,
    selectSelectedWorkspaceId: (state) => state.selectedWorkspaceId,
    selectIsOnboardingCompleted: (state) => state.isCompleted,
  },
});

export const {
  setStep,
  setSelectedRole,
  setSelectedWorkspaceId,
  setCompleted,
  resetOnboarding,
} = onboardingSlice.actions;

export const {
  selectCurrentStep,
  selectSelectedRole,
  selectSelectedWorkspaceId,
  selectIsOnboardingCompleted,
} = onboardingSlice.selectors;

export const onboardingReducer = onboardingSlice.reducer;
