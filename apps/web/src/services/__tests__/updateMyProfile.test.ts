import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api } from "@/services/api";
import { authApi } from "@/services/authApi";

const saved = {
  id: "user-1",
  email: "ada@example.com",
  firstName: "Adaeze",
  middleName: "",
  lastName: "Obi",
  phoneNumber: "",
  timezone: "Africa/Lagos",
};

describe("updateMyProfile", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("patches the signed-in user's own profile, never another user's", async () => {
    fetchMock.mockResolvedValueOnce(json(saved));
    await store
      .dispatch(
        authApi.endpoints.updateMyProfile.initiate({ firstName: "Adaeze" }),
      )
      .unwrap();

    const request = new Request(...(fetchMock.mock.calls[0] as [RequestInfo]));
    expect(request.method).toBe("PATCH");
    expect(new URL(request.url).pathname).toMatch(/\/users\/me$/);
    expect(await request.json()).toEqual({ firstName: "Adaeze" });
  });

  it("puts the saved profile in the current-user cache, for every screen", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...saved, firstName: "Ada" }));
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());

    fetchMock.mockResolvedValueOnce(json(saved));
    await store
      .dispatch(
        authApi.endpoints.updateMyProfile.initiate({ firstName: "Adaeze" }),
      )
      .unwrap();

    const cached = authApi.endpoints.getCurrentUser.select()(store.getState());
    expect(cached.data).toMatchObject({
      firstName: "Adaeze",
      timezone: "Africa/Lagos",
    });
  });

  it("leaves the cached profile alone when saving fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...saved, firstName: "Ada" }));
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());

    fetchMock.mockResolvedValueOnce(json({ message: "Invalid" }, 400));
    await expect(
      store
        .dispatch(authApi.endpoints.updateMyProfile.initiate({ firstName: "" }))
        .unwrap(),
    ).rejects.toBeTruthy();

    const cached = authApi.endpoints.getCurrentUser.select()(store.getState());
    expect(cached.data?.firstName).toBe("Ada");
  });
});
