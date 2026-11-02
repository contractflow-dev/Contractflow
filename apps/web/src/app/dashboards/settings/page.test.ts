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

  it("removes company context while preserving unrelated query parameters", async () => {
    await DashboardSettingsPage({
      searchParams: Promise.resolve({
        companyId: "company one",
        search: "bridge & road",
        page: "3",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboards/profile?search=bridge+%26+road&page=3",
    );
  });

  it("redirects without adding an empty company selection", async () => {
    await DashboardSettingsPage({ searchParams: Promise.resolve({}) });

    expect(redirectMock).toHaveBeenCalledWith("/dashboards/profile");
  });
});
