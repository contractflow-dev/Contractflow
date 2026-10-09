import type { ECompanyRole } from '@contractflow/contracts-schema';

export type OnboardingStep = 'profile' | 'role' | 'workspace' | 'completed';

export interface OnboardingState {
  currentStep: OnboardingStep;
  selectedRole: ECompanyRole | null;
  selectedWorkspaceId: string | null;
  isCompleted: boolean;
}
