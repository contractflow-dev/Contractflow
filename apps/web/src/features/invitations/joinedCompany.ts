import {
  ECompanyRole,
  EInvitationStatus,
  type ICompanyInvitationResponseResult,
} from "@contractflow/contracts-schema";
import type { AppDispatch } from "@/store";
import {
  companyLandingPath,
  persistActiveCompanyId,
} from "@/features/workspace";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";

/**
 * Makes a company the user just joined their active workspace, remembered
 * for this browser the same way the company switcher remembers a choice.
 * The company shell still checks it against the user's memberships from the
 * API before using it.
 */
export function activateJoinedCompany(
  dispatch: AppDispatch,
  userId: string | undefined,
  companyId: string,
): void {
  dispatch(setActiveWorkspaceId(companyId));
  if (!userId) return;
  try {
    persistActiveCompanyId(window.localStorage, userId, companyId);
  } catch {
    // Without storage the shell selects the company again on the next visit.
  }
}

export type InvitationAnswer =
  | { kind: "joined"; companyId: string }
  | { kind: "declined" }
  | { kind: "expired" };

/**
 * What the API's answer means. A 2xx response is not proof of acceptance:
 * only an "accepted" status that names the joined company is.
 */
export function classifyInvitationAnswer(
  result: ICompanyInvitationResponseResult,
): InvitationAnswer {
  if (result.status === EInvitationStatus.ACCEPTED && result.companyId) {
    return { kind: "joined", companyId: result.companyId };
  }
  if (result.status === EInvitationStatus.DECLINED) return { kind: "declined" };
  return { kind: "expired" };
}

/** Where a new member of a company starts, by the role they joined with. */
export function joinedCompanyLandingPath(companyRole: ECompanyRole): string {
  return companyLandingPath(companyRole === ECompanyRole.COMPANY_ADMIN);
}

/** The invitation-link page, used to come back after signing in. */
export function invitationLinkPath(token: string): string {
  return `/invitations/respond?token=${encodeURIComponent(token)}`;
}

/** Registration that keeps the invitation, so the invited email is fixed. */
export function invitationRegisterPath(token: string): string {
  return `/auth/register?invitation=${encodeURIComponent(token)}`;
}

/** Sign-in that comes back to the invitation afterwards. */
export function invitationSignInPath(token: string): string {
  return `/login?redirect=${encodeURIComponent(invitationLinkPath(token))}`;
}
