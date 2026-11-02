import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { api } from "@/services/api";
import { companiesApi } from "@/services/companiesApi";

describe("paginated query cache", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    store.dispatch(setActiveWorkspaceId(null));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(new Request(input, init).url);
      const companyId = url.pathname.match(/\/companies\/([^/]+)/)?.[1];
      const page = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return new Response(
        JSON.stringify({
          data: [{ id: `${companyId}:page-${page}` }],
          meta: {
            totalItems: 45,
            itemCount: 1,
            itemsPerPage: limit,
            totalPages: Math.ceil(45 / limit),
            currentPage: page,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function fetchMembers(args: {
    companyId: string;
    page: number;
    limit?: number;
    search?: string;
  }) {
    const subscription = store.dispatch(
      companiesApi.endpoints.getCompanyMembers.initiate(args),
    );
    try {
      return await subscription.unwrap();
    } finally {
      subscription.unsubscribe();
    }
  }

  it("keeps each page, page size, and search in its own cache entry", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));

    const first = await fetchMembers({ companyId: "company-a", page: 1 });
    const second = await fetchMembers({ companyId: "company-a", page: 2 });
    await fetchMembers({ companyId: "company-a", page: 1, limit: 50 });
    await fetchMembers({ companyId: "company-a", page: 1, search: "ari" });

    expect(first.data[0]?.id).toBe("company-a:page-1");
    expect(second.data[0]?.id).toBe("company-a:page-2");
    expect(second.meta.currentPage).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      companiesApi.endpoints.getCompanyMembers.select({
        companyId: "company-a",
        page: 1,
      })(store.getState()).data?.data[0]?.id,
    ).toBe("company-a:page-1");
  });

  it("serves a repeated page from the cache without another request", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    const subscription = store.dispatch(
      companiesApi.endpoints.getCompanyMembers.initiate({
        companyId: "company-a",
        page: 1,
      }),
    );
    await subscription.unwrap();

    await fetchMembers({ companyId: "company-a", page: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it("never returns one company's cached page for another company", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    const companyA = await fetchMembers({ companyId: "company-a", page: 1 });

    store.dispatch(setActiveWorkspaceId("company-b"));
    const companyB = await fetchMembers({ companyId: "company-b", page: 1 });

    expect(companyA.data[0]?.id).toBe("company-a:page-1");
    expect(companyB.data[0]?.id).toBe("company-b:page-1");
    const headers = fetchMock.mock.calls.map(([input, init]) =>
      new Request(input, init).headers.get("X-Company-Id"),
    );
    expect(headers).toEqual(["company-a", "company-b"]);
  });

  it("refetches every cached page of a list after a member mutation", async () => {
    store.dispatch(setActiveWorkspaceId("company-a"));
    const pageOne = store.dispatch(
      companiesApi.endpoints.getCompanyMembers.initiate({
        companyId: "company-a",
        page: 1,
      }),
    );
    const pageTwo = store.dispatch(
      companiesApi.endpoints.getCompanyMembers.initiate({
        companyId: "company-a",
        page: 2,
      }),
    );
    await Promise.all([pageOne.unwrap(), pageTwo.unwrap()]);
    fetchMock.mockClear();

    store.dispatch(
      api.util.invalidateTags([{ type: "CompanyMember", id: "company-a" }]),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    pageOne.unsubscribe();
    pageTwo.unsubscribe();
  });
});
