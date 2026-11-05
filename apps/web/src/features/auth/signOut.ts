import type { AppDispatch } from "@/store";
import { logout } from "./authSlice";
import { resetOnboarding } from "../onboarding/onboardingSlice";
import { resetWorkspace } from "../workspace/workspaceSlice";
import { closeModal, setMobileNavOpen } from "../ui/uiSlice";
import { api } from "@/services/api";

export async function completeSignOut(
  request: () => Promise<unknown>,
  clearClientState: () => void,
  replaceRoute: (href: string) => void,
): Promise<void> {
  let failed = false;
  try {
    await request();
  } catch {
    failed = true;
  } finally {
    clearClientState();
    replaceRoute(failed ? "/login?logout=failed" : "/login");
  }
}

export function clearSignedOutClientState(dispatch: AppDispatch): void {
  dispatch(logout());
  dispatch(resetOnboarding());
  dispatch(resetWorkspace());
  dispatch(closeModal());
  dispatch(setMobileNavOpen(false));
  dispatch(api.util.resetApiState());
}
