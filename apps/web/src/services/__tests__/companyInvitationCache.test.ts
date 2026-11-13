import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api } from "@/services/api";
import { companiesApi } from "@/services/companiesApi";

const TOKEN = "invitation-token";

describe("company invitation response cache", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  let respondResult: { status: number; body: unknown };
  const subscriptions: Array<{ unsubscribe: () => void }> = [];
  let requestedPaths: string[] = [];

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    fetchMock.mockReset();
    respondResult = { status: 200, body: { status: "accepted" } };
    requestedPaths = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      requestedPaths.push(path);
      switch (path) {
        case "/api/companies":
          return json([]);
        case "/api/companies/access-summary":
          return json({
            activeCompanyCount: 0,
            hasEndedMembership: false,
            hasInactiveCompanyMembership: false,
          });
        case "/api/invitations/preview":
          return json({
            status: "pending",
            companyName: "Acme Works",
            inviterName: "Ada Admin",
            email: "ari@example.com",
            companyRole: "HSE Officer",
            expiresAt: "2026-12-01T00:00:00.000Z",
          });
        case "/api/invitations/respond":
          return json(respondResult.body, respondResult.status);
        default:
          return json({ message: `Unexpected ${path}` }, 404);
      }
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    subscriptions
      .splice(0)
      .forEach((subscription) => subscription.unsubscribe());
    vi.unstubAllGlobals();
  });

  /** Loads, and stays subscribed to, the data the invitation screens show. */
  async function loadInvitationScreens() {
    const queries = [
      store.dispatch(companiesApi.endpoints.getCompanies.initiate()),
      store.dispatch(companiesApi.endpoints.getCompanyAccessSummary.initiate()),
      store.dispatch(
        companiesApi.endpoints.getPublicCompanyInvitation.initiate({
          token: TOKEN,
        }),
      ),
    ];
    subscriptions.push(...queries);
    await Promise.all(queries.map((query) => query.unwrap()));
    requestedPaths = [];
  }

  async function respond(decision: "accept" | "decline") {
    return store
      .dispatch(
        companiesApi.endpoints.respondToCompanyInvitation.initiate({
          token: TOKEN,
          decision,
        }),
      )
      .unwrap();
  }

  async function refetchedPaths() {
    // Give invalidation-triggered refetches time to start.
    await new Promise((resolve) => setTimeout(resolve, 20));
    return requestedPaths
      .filter((path) => path !== "/api/invitations/respond")
      .sort();
  }

  it("refreshes the company list, access summary, and the invitation after accepting", async () => {
    await loadInvitationScreens();

    await respond("accept");

    expect(await refetchedPaths()).toEqual([
      "/api/companies",
      "/api/companies/access-summary",
      "/api/invitations/preview",
    ]);
  });

  // Declining adds no membership, so the company list stays cached. The
  // access summary is refreshed: its pending-invitation count went down.
  it("refreshes the invitation and access summary, not the companies, after declining", async () => {
    await loadInvitationScreens();
    respondResult = { status: 200, body: { status: "declined" } };

    await respond("decline");

    expect(await refetchedPaths()).toEqual([
      "/api/companies/access-summary",
      "/api/invitations/preview",
    ]);
  });

  // The API currently reports expiry as a 409 (covered below); this guards the
  // typed "expired" status in case it is ever returned with a 2xx.
  it("treats an expired status like a decline, even when accepting", async () => {
    await loadInvitationScreens();
    respondResult = { status: 200, body: { status: "expired" } };

    await respond("accept");

    expect(await refetchedPaths()).toEqual([
      "/api/companies/access-summary",
      "/api/invitations/preview",
    ]);
  });

  it.each([
    "This invitation has expired.",
    "This invitation has already been used.",
  ])(
    "refreshes nothing when the server rejects the response: %s",
    async (message) => {
      await loadInvitationScreens();
      respondResult = { status: 409, body: { message } };

      await expect(respond("accept")).rejects.toMatchObject({ status: 409 });

      expect(await refetchedPaths()).toEqual([]);
    },
  );
});
