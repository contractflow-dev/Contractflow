import { ECompanyRole } from "../enums/identity.enum.js";

export type OnboardingStepName = "profile" | "role" | "workspace" | "completed";

export interface OnboardingStatus {
  currentStep: OnboardingStepName;
  isCompleted: boolean;
  selectedRole?: ECompanyRole;
  workspaceId?: string;
}

export interface SubmitProfileRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber?: string;
  timezone?: string;
}

export interface SubmitRoleRequest {
  role: ECompanyRole;
  jobTitle?: string;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  message?: string;
  status: OnboardingStatus;
}
