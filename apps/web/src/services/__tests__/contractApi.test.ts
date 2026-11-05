import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import { store } from "@/store";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { api } from "@/services/api";
import { contractApi } from "@/services/contractApi";

describe("RTK Query contract API contracts", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    store.dispatch(setActiveWorkspaceId("company-1"));
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        return new Response(
          JSON.stringify({
            data: [],
            meta: {
              totalItems: 0,
              itemCount: 0,
              itemsPerPage: 25,
              totalPages: 0,
              currentPage: 1,
            },
            method: request.method,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists contracts through the company-scoped paged API", async () => {
    await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({
          companyId: "company-1",
          search: "bridge replacement",
          status: EContractStatus.ACTIVE,
          page: 2,
          limit: 10,
        }),
      )
      .unwrap();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe(
      "http://localhost:3001/api/contracts?search=bridge+replacement&status=active&page=2&limit=10",
    );
    expect(request.method).toBe("GET");
    expect(request.credentials).toBe("include");
    expect(request.headers.get("X-Company-Id")).toBe("company-1");
  });

  it("uses company-scoped read routes for detail, parties, and status history", async () => {
    await store
      .dispatch(
        contractApi.endpoints.getContractById.initiate({
          companyId: "company-1",
          contractId: "contract-1",
        }),
      )
      .unwrap();
    await store
      .dispatch(
        contractApi.endpoints.getContractParties.initiate({
          companyId: "company-1",
          contractId: "contract-1",
        }),
      )
      .unwrap();
    await store
      .dispatch(
        contractApi.endpoints.getContractStatusHistory.initiate({
          companyId: "company-1",
          contractId: "contract-1",
          page: 3,
          limit: 20,
        }),
      )
      .unwrap();

    expect(
      fetchMock.mock.calls.map(([input]) => (input as Request).url),
    ).toEqual([
      "http://localhost:3001/api/contract",
      "http://localhost:3001/api/contract/parties",
      "http://localhost:3001/api/contract/status-history?page=3&limit=20",
    ]);
    expect(
      fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET"),
    ).toEqual(["GET", "GET", "GET"]);
    expect(
      fetchMock.mock.calls.map(([input]) =>
        (input as Request).headers.get("X-Contract-Id"),
      ),
    ).toEqual(["contract-1", "contract-1", "contract-1"]);
  });

  it("does not send contract context on the contract list", async () => {
    await store
      .dispatch(
        contractApi.endpoints.getContracts.initiate({ companyId: "company-1" }),
      )
      .unwrap();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.has("X-Contract-Id")).toBe(false);
    expect(new URL(request.url).searchParams.has("contractId")).toBe(false);
  });
});
