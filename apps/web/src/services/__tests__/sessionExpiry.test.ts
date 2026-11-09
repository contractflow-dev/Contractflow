import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api, resetSignInRedirectForTests } from "@/services/api";
import { authApi } from "@/services/authApi";
import { selectIsAuthenticated, setUser } from "@/features/auth";
import type { AuthUser } from "@/features/auth/authTypes";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const unauthorized = () =>
  json(401, { statusCode: 401, message: "Authentication required." });

describe("an expired or revoked session", () => {
  const replace = vi.fn<(url: string) => void>();
  const fetchMock =
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  function onPage(pathname: string, search = "") {
    vi.stubGlobal("window", {
      location: { pathname, search, origin: "http://localhost", replace },
    });
  }

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    resetSignInRedirectForTests();
    replace.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a signed-in user to sign in again, saying why, and keeps the page", async () => {
    onPage("/dashboards/contracts", "?status=active");
    fetchMock.mockResolvedValueOnce(
      json(200, { id: "u-1", email: "ada@example.com" }),
    );
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());
    store.dispatch(setUser({ id: "u-1" } as AuthUser));

    // The session ends; the next request is refused, then another.
    fetchMock.mockImplementation(async () => unauthorized());
    await store.dispatch(
      authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }),
    );
    await store.dispatch(
      authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }),
    );

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      "/login?reason=session-expired&redirect=%2Fdashboards%2Fcontracts%3Fstatus%3Dactive",
    );
    // No signed-in state is left behind.
    expect(selectIsAuthenticated(store.getState())).toBe(false);
  });

  it("asks someone who wasn't signed in to sign in, without claiming expiry", async () => {
    onPage("/dashboards");
    fetchMock.mockImplementation(async () => unauthorized());
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());

    expect(replace).toHaveBeenCalledWith("/login?redirect=%2Fdashboards");
  });

  it("leaves public pages where they are", async () => {
    onPage("/login");
    fetchMock.mockImplementation(async () => unauthorized());
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());

    expect(replace).not.toHaveBeenCalled();
  });
});
