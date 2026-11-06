import { describe, expect, it } from "vitest";
import {
  companyAccessState,
  companyLandingPath,
  resolveWorkspaceRedirect,
} from "./workspaceLanding";

const noAccess = {
  activeCompanyCount: 0,
  hasEndedMembership: false,
  hasInactiveCompanyMembership: false,
};

describe("companyAccessState", () => {
  it("is active whenever the user has a usable company", () => {
    expect(companyAccessState(true, undefined)).toBe("active");
  });

  it("waits for the server before classifying a user without a company", () => {
    expect(companyAccessState(false, undefined)).toBe("unknown");
  });

  it("treats a user who never had a company as new", () => {
    expect(companyAccessState(false, noAccess)).toBe("new");
  });

  it("recognises a user whose membership ended", () => {
    expect(
      companyAccessState(false, { ...noAccess, hasEndedMembership: true }),
    ).toBe("ended");
  });

  it("prefers the inactive-company explanation when both apply", () => {
    expect(
      companyAccessState(false, {
        ...noAccess,
        hasEndedMembership: true,
        hasInactiveCompanyMembership: true,
      }),
    ).toBe("company-inactive");
  });
});

describe("resolveWorkspaceRedirect", () => {
  it("sends only a new user to company setup", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards",
        access: "new",
        canManageCompany: null,
      }),
    ).toBe("/onboarding");
  });

  it.each(["ended", "company-inactive", "unknown"] as const)(
    "does not send a %s user to company setup",
    (access) => {
      expect(
        resolveWorkspaceRedirect({
          pathname: "/dashboards",
          access,
          canManageCompany: null,
        }),
      ).toBeNull();
    },
  );

  it("keeps a company administrator on the overview", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards",
        access: "active",
        canManageCompany: true,
      }),
    ).toBeNull();
  });

  it("moves a regular member from the admin overview to contracts", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards",
        access: "active",
        canManageCompany: false,
      }),
    ).toBe("/dashboards/contracts");
  });

  it("never redirects a member away from the member landing page", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards/contracts",
        access: "active",
        canManageCompany: false,
      }),
    ).toBeNull();
  });

  it("leaves other admin pages to the access-required message", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards/team",
        access: "active",
        canManageCompany: false,
      }),
    ).toBeNull();
  });

  it("waits for the membership before redirecting from the overview", () => {
    expect(
      resolveWorkspaceRedirect({
        pathname: "/dashboards",
        access: "active",
        canManageCompany: null,
      }),
    ).toBeNull();
  });
});

describe("companyLandingPath", () => {
  it("returns the overview for administrators and contracts for members", () => {
    expect(companyLandingPath(true)).toBe("/dashboards");
    expect(companyLandingPath(false)).toBe("/dashboards/contracts");
  });
});
