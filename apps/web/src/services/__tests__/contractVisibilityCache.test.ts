import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ECompanyRole } from "@contractflow/contracts-schema";
import { store } from "@/store";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { api } from "@/services/api";
import { companiesApi } from "@/services/companiesApi";
import { contractApi } from "@/services/contractApi";

/**
 * Contract visibility is decided by the API from the viewer's contract roles
 * (and Company Administrator role). Every change to those must refresh the
 * cached contract list and detail, so a revoked contract can't linger.
 */
describe("contract visibility cache", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  let seen: Array<{ method: string; path: string }> = [];
  const listRequests = () =>
    seen.filter(
      ({ method, path }) => method === "GET" && path.endsWith("/contracts"),
    );
  const detailRequests = () =>
    seen.filter(
      ({ method, path }) => method === "GET" && path.endsWith("/contract"),
    );

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    store.dispatch(setActiveWorkspaceId("company-a"));
    fetchMock.mockReset();
    seen = [];
    fetchMock.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      seen.push({ method: request.method, path });
      const body =
        request.method === "GET" && path.endsWith("/contracts")
          ? {
              data: [{ id: `${request.headers.get("X-Company-Id")}:c-1` }],
              meta: {
                totalItems: 1,
                itemCount: 1,
                itemsPerPage: 20,
                totalPages: 1,
                currentPage: 1,
              },
            }
          : { id: "x", status: "accepted" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function watchContracts(companyId = "company-a") {
    const list = store.dispatch(
      contractApi.endpoints.getContracts.initiate({
        companyId,
        page: 1,
        limit: 20,
      }),
    );
    const detail = store.dispatch(
      contractApi.endpoints.getContractById.initiate({
        companyId,
        contractId: "c-1",
      }),
    );
    await list.unwrap();
    await detail.unwrap();
    return () => {
      list.unsubscribe();
      detail.unsubscribe();
    };
  }

  async function settle() {
    await Promise.all(
      store.dispatch(api.util.getRunningQueriesThunk()) as Promise<unknown>[],
    );
  }

  async function expectContractRefetch(run: () => Promise<unknown>) {
    const stop = await watchContracts();
    expect(listRequests()).toHaveLength(1);
    expect(detailRequests()).toHaveLength(1);

    await run();
    await settle();

    expect(listRequests()).toHaveLength(2);
    expect(detailRequests()).toHaveLength(2);
    stop();
  }

  it("refetches the contract list and detail after assigning a contract role", async () => {
    await expectContractRefetch(() =>
      store
        .dispatch(
          contractApi.endpoints.assignContractRole.initiate({
            companyId: "company-a",
            contractId: "c-1",
            workspace: "finance",
            companyUserId: "cu-2",
            role: "Finance Officer",
          }),
        )
        .unwrap(),
    );
  });

  it("refetches the contract list and detail after revoking a contract role", async () => {
    await expectContractRefetch(() =>
      store
        .dispatch(
          contractApi.endpoints.revokeContractRole.initiate({
            companyId: "company-a",
            contractId: "c-1",
            workspace: "finance",
            assignmentId: "a-1",
          }),
        )
        .unwrap(),
    );
  });

  it("refetches the contract list after accepting a contract-role invitation", async () => {
    const stop = await watchContracts();
    await store
      .dispatch(
        contractApi.endpoints.respondToContractRoleInvitation.initiate({
          token: "token",
          decision: "accept",
        }),
      )
      .unwrap();
    await settle();
    expect(listRequests()).toHaveLength(2);
    stop();
  });

  it("refetches every contract view after a company role change", async () => {
    const stop = await watchContracts();
    await store
      .dispatch(
        companiesApi.endpoints.changeCompanyMemberRole.initiate({
          companyId: "company-a",
          membershipId: "cu-1",
          companyRole: ECompanyRole.MEMBER,
        }),
      )
      .unwrap();
    await settle();
    expect(listRequests()).toHaveLength(2);
    expect(detailRequests()).toHaveLength(2);
    stop();
  });

  it("keeps each company's contract list separate when switching company", async () => {
    const stopA = await watchContracts("company-a");
    store.dispatch(setActiveWorkspaceId("company-b"));
    const stopB = await watchContracts("company-b");

    const listFor = (companyId: string) =>
      contractApi.endpoints.getContracts.select({
        companyId,
        page: 1,
        limit: 20,
      })(store.getState()).data?.data.map(({ id }) => id);
    expect(listFor("company-a")).toEqual(["company-a:c-1"]);
    expect(listFor("company-b")).toEqual(["company-b:c-1"]);
    stopA();
    stopB();
  });
});
