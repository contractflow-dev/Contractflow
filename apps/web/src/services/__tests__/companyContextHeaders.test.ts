import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { api } from "@/services/api";
import { contractApi } from "@/services/contractApi";
import { companiesApi } from "@/services/companiesApi";

describe("company context request headers", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    store.dispatch(setActiveWorkspaceId(null));
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const companyId = request.headers.get("X-Company-Id");
        const body = new URL(request.url).pathname.endsWith("/companies")
          ? []
          : {
              data: companyId ? [{ id: companyId }] : [],
              meta: {
                totalItems: 0,
                itemCount: 0,
                itemsPerPage: 25,
                totalPages: 0,
                currentPage: 1,
              },
            };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the active company ID and updates it after a company switch", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    const companyA = await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({
          companyId: "company-a",
          page: 1,
          limit: 25,
        }),
      )
      .unwrap();

    store.dispatch(setActiveWorkspaceId("company-b"));
    const companyB = await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({
          companyId: "company-b",
          page: 1,
          limit: 25,
        }),
      )
      .unwrap();

    const requests = fetchMock.mock.calls.map(
      ([input, init]) => new Request(input, init),
    );
    expect(
      requests.map((request) => request.headers.get("X-Company-Id")),
    ).toEqual(["company-a", "company-b"]);
    expect(companyA.data[0]?.id).toBe("company-a");
    expect(companyB.data[0]?.id).toBe("company-b");
    expect(requests[0]?.credentials).toBe("include");
  });

  it("omits company context for requests that are not company-scoped", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    await store
      .dispatch(companiesApi.endpoints.getCompanies.initiate())
      .unwrap();

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(request.headers.has("X-Company-Id")).toBe(false);
  });

  it("checks company access without any company context", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          activeCompanyCount: 0,
          hasEndedMembership: true,
          hasInactiveCompanyMembership: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await store
      .dispatch(companiesApi.endpoints.getCompanyAccessSummary.initiate())
      .unwrap();

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(new URL(request.url).pathname).toBe("/api/companies/access-summary");
    expect(request.headers.has("X-Company-Id")).toBe(false);
  });

  it("verifies a company email without company context, but resends with it", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ message: "ok", companyName: "Acme" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await store
      .dispatch(
        companiesApi.endpoints.verifyCompanyEmail.initiate({ token: "t" }),
      )
      .unwrap();
    await store
      .dispatch(
        companiesApi.endpoints.resendCompanyVerificationEmail.initiate({
          companyId: "company-b",
        }),
      )
      .unwrap();

    const [verify, resend] = fetchMock.mock.calls.map(
      ([input, init]) => new Request(input, init),
    );
    expect(new URL(verify!.url).pathname).toBe("/api/companies/verify-email");
    expect(verify!.headers.has("X-Company-Id")).toBe(false);
    expect(new URL(resend!.url).pathname).toBe(
      "/api/company/verification-email",
    );
    expect(resend!.headers.get("X-Company-Id")).toBe("company-b");
  });

  it("sends the requested company even when another company is active", async () => {
    store.dispatch(setActiveWorkspaceId("company-b"));
    await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({
          companyId: "company-a",
          page: 1,
          limit: 25,
        }),
      )
      .unwrap();

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(request.headers.get("X-Company-Id")).toBe("company-a");
    expect(new URL(request.url).pathname).toBe("/api/contracts");
  });

  it("sends the invited company in the header when responding to a contract invitation", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "accepted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await store
      .dispatch(
        contractApi.endpoints.respondToContractPartyInvitation.initiate({
          companyId: "company-a",
          token: "token-1",
          decision: "accept",
        }),
      )
      .unwrap();

    const request = new Request(...fetchMock.mock.calls[0]);
    expect(new URL(request.url).pathname).toBe(
      "/api/contract-party-invitations/respond",
    );
    expect(request.headers.get("X-Company-Id")).toBe("company-a");
  });
});
