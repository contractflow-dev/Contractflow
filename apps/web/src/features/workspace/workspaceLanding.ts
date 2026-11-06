import type { ICompanyAccessSummaryResponse } from "@contractflow/contracts-schema";

export const COMPANY_OVERVIEW_PATH = "/dashboards";
export const MEMBER_LANDING_PATH = "/dashboards/contracts";
export const ONBOARDING_PATH = "/onboarding";

/**
 * - `active`: the user can use at least one company.
 * - `new`: the user has never had a company and should set one up.
 * - `ended`: the user was removed from their companies.
 * - `company-inactive`: the user belongs to a company that is inactive.
 * - `unknown`: the server hasn't said yet.
 */
export type CompanyAccessState =
  | "active"
  | "new"
  | "ended"
  | "company-inactive"
  | "unknown";

/** The page a member of the active company should start on. */
export function companyLandingPath(canManageCompany: boolean): string {
  return canManageCompany ? COMPANY_OVERVIEW_PATH : MEMBER_LANDING_PATH;
}

/**
 * Classifies a user with no usable company from the server's access summary,
 * so someone who lost access isn't treated as a brand-new user.
 */
export function companyAccessState(
  hasActiveCompany: boolean,
  summary: ICompanyAccessSummaryResponse | undefined,
): CompanyAccessState {
  if (hasActiveCompany) return "active";
  if (!summary) return "unknown";
  if (summary.hasInactiveCompanyMembership) return "company-inactive";
  if (summary.hasEndedMembership) return "ended";
  return "new";
}

/**
 * Where the company shell should send the user instead of rendering the
 * current page, or `null` to stay. The access state and `canManageCompany`
 * come from the server, never from the route.
 */
export function resolveWorkspaceRedirect({
  pathname,
  access,
  canManageCompany,
}: {
  pathname: string;
  access: CompanyAccessState;
  canManageCompany: boolean | null;
}): string | null {
  if (access === "new") return ONBOARDING_PATH;
  if (access !== "active") return null;
  // Only the overview is swapped for members. Other admin pages keep the
  // explicit "access required" message so a shared link isn't silently lost.
  if (pathname === COMPANY_OVERVIEW_PATH && canManageCompany === false) {
    return MEMBER_LANDING_PATH;
  }
  return null;
}
