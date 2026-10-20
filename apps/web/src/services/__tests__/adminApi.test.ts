import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api } from "@/services/api";
import { adminApi, type AdminOverviewResponse } from "@/services/adminApi";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";

describe("RTK Query Admin API contracts", () => {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

  const mockOverviewData: AdminOverviewResponse = {
    companies: { total: 12, active: 10, inactive: 2, newThisMonth: 4 },
    users: { total: 50, active: 45, inactive: 5, pendingVerification: 5, platformAdmins: 2 },
    contracts: { total: 24, active: 18, draft: 4, suspended: 1, completed: 1, expiringSoon: 3 },
    invitations: { total: 30, pending: 8, accepted: 18, declined: 4, expired: 2 },
    attention: {
      expiringContractsCount: 3,
      pendingInvitationsCount: 8,
      unverifiedUsersCount: 5,
      items: [
        {
          id: "item-1",
          category: "contract_expiry",
          title: "Contract Expiring Soon: CTR-2026-004",
          description: "Major EPC contract expires in 12 days.",
          urgency: "high",
          referenceDate: new Date().toISOString(),
        },
      ],
    },
    recentActivity: [
      {
        id: "log-1",
        action: "contract.status_changed",
        entityType: "contract",
        entityId: "cnt-1",
        summary: "Contract status moved to ACTIVE",
        actorName: "David Admin",
        companyName: "TotalEnergies JV",
        occurredAt: new Date().toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /admin/overview with credentials: 'include' and returns typed response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockOverviewData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await store
      .dispatch(adminApi.endpoints.getAdminOverview.initiate())
      .unwrap();

    expect(result.companies.total).toBe(12);
    expect(result.users.total).toBe(50);
    expect(result.contracts.active).toBe(18);
    expect(result.attention.items).toHaveLength(1);
    expect(result.recentActivity).toHaveLength(1);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:3001/api/admin/overview");
    expect(request.method).toBe("GET");
    expect(request.credentials).toBe("include");
  });

  it("handles 403 Forbidden when a company admin or non-platform user attempts access", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: "Platform administrator privileges required.",
          error: "Forbidden",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    let caughtError: unknown;
    try {
      await store
        .dispatch(adminApi.endpoints.getAdminOverview.initiate())
        .unwrap();
    } catch (e) {
      caughtError = e;
    }

    expect(getApiErrorStatus(caughtError)).toBe(403);
    expect(getApiErrorMessage(caughtError, "Failed")).toContain(
      "Platform administrator privileges required.",
    );
  });

  it("handles 401 Unauthorized when request is unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 401,
          message: "Authentication required.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    let caughtError: unknown;
    try {
      await store
        .dispatch(adminApi.endpoints.getAdminOverview.initiate())
        .unwrap();
    } catch (e) {
      caughtError = e;
    }

    expect(getApiErrorStatus(caughtError)).toBe(401);
  });
});
