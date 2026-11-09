import { describe, expect, it } from "vitest";
import {
  SESSION_EXPIRED_REASON,
  safeRedirectPath,
  signInUrl,
} from "./signInRedirect";

const origin = "https://app.contractflow.test";

describe("signInUrl", () => {
  it("keeps the page to return to and says when a session expired", () => {
    expect(
      signInUrl("/dashboards/contracts?status=active", { expired: true }),
    ).toBe(
      `/login?reason=${SESSION_EXPIRED_REASON}&redirect=%2Fdashboards%2Fcontracts%3Fstatus%3Dactive`,
    );
    expect(signInUrl("/dashboards", { expired: false })).toBe(
      "/login?redirect=%2Fdashboards",
    );
  });

  it("never returns to another site or to the sign-in page", () => {
    expect(signInUrl("//evil.test/x", { expired: false })).toBe("/login");
    expect(signInUrl("https://evil.test", { expired: true })).toBe(
      `/login?reason=${SESSION_EXPIRED_REASON}`,
    );
    expect(signInUrl("/login?reason=x", { expired: false })).toBe("/login");
  });
});

describe("safeRedirectPath", () => {
  it("returns to a page on this site, with its query and hash", () => {
    expect(safeRedirectPath("/dashboards/contracts?page=2#top", origin)).toBe(
      "/dashboards/contracts?page=2#top",
    );
  });

  it("falls back to the dashboards for anything else", () => {
    for (const requested of [
      null,
      "",
      "https://evil.test/dashboards",
      "//evil.test",
      "/\\evil.test",
      "dashboards",
      "/login",
      "/login?redirect=%2Fdashboards",
    ]) {
      expect(safeRedirectPath(requested, origin), String(requested)).toBe(
        "/dashboards",
      );
    }
  });
});
