import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import { store } from "@/store";
import { api } from "@/services/api";
import { contractApi } from "@/services/contractApi";

describe("RTK Query contract API contracts", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        return new Response(
          JSON.stringify({
            items: [],
            total: 0,
            page: 1,
            limit: 25,
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
      "http://localhost:3001/api/companies/company-1/contracts?search=bridge+replacement&status=active&page=2&limit=10",
    );
    expect(request.method).toBe("GET");
    expect(request.credentials).toBe("include");
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
      "http://localhost:3001/api/companies/company-1/contracts/contract-1",
      "http://localhost:3001/api/companies/company-1/contracts/contract-1/parties",
      "http://localhost:3001/api/companies/company-1/contracts/contract-1/status-history?page=3&limit=20",
    ]);
    expect(
      fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET"),
    ).toEqual(["GET", "GET", "GET"]);
  });
});
