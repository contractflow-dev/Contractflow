import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSettingsPage from "./page";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("dashboard settings route", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects the duplicate settings route to the canonical profile route", async () => {
    await DashboardSettingsPage({
      searchParams: Promise.resolve({ companyId: "company one" }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboards/profile?companyId=company%20one",
    );
  });

  it("redirects without adding an empty company selection", async () => {
    await DashboardSettingsPage({ searchParams: Promise.resolve({}) });

    expect(redirectMock).toHaveBeenCalledWith("/dashboards/profile");
  });
});
