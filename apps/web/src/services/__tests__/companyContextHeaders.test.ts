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

  it("omits company context for unselected and public requests", async () => {
    await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({
          companyId: "company-a",
          page: 1,
          limit: 25,
        }),
      )
      .unwrap();
    store.dispatch(setActiveWorkspaceId("company-a"));
    await store
      .dispatch(companiesApi.endpoints.getCompanies.initiate())
      .unwrap();

    const requests = fetchMock.mock.calls.map(
      ([input, init]) => new Request(input, init),
    );
    expect(requests[0]?.headers.has("X-Company-Id")).toBe(false);
    expect(requests[1]?.headers.has("X-Company-Id")).toBe(false);
  });
});
