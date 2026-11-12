import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api } from "@/services/api";
import { authApi } from "@/services/authApi";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { companiesApi } from "@/services/companiesApi";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  ECompanyRole,
  ECountryCode,
  ECurrencyCode,
  EUserStatus,
} from "@contractflow/contracts-schema";
import { clearSignedOutClientState } from "@/features/auth/signOut";
import {
  setUser,
  selectCurrentUser,
  selectIsAuthenticated,
} from "@/features/auth";
import { setSelectedRole, selectSelectedRole } from "@/features/onboarding";
import {
  setActiveWorkspaceId,
  selectActiveWorkspaceId,
  selectRecentWorkspaceIds,
} from "@/features/workspace";
import { openModal, selectActiveModal } from "@/features/ui";

describe("RTK Query authentication and company API contracts", () => {
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
        return new Response(JSON.stringify({ message: request.method }), {
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

  it("normalizes a Render host into an HTTPS API base URL", () => {
    expect(getApiBaseUrl("contractflow-api.onrender.com")).toBe(
      "https://contractflow-api.onrender.com/api",
    );
    expect(getApiBaseUrl("https://api.example.com/api/")).toBe(
      "https://api.example.com/api",
    );
    expect(getApiBaseUrl()).toBe("http://localhost:3001/api");
  });

  it("posts registration data to the expected route with cookie credentials enabled", async () => {
    const input = {
      email: "user@example.com",
      password: "StrongPassword123!",
      firstName: "User",
      middleName: "",
      lastName: "Person",
      phoneNumber: "",
      timezone: "UTC",
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Check your email." }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      store.dispatch(authApi.endpoints.register.initiate(input)).unwrap(),
    ).resolves.toEqual({ message: "Check your email." });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:3001/api/auth/register");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    await expect(request.clone().json()).resolves.toEqual(input);
  });

  it("posts password reset requests with the token only in the body and no company context", async () => {
    store.dispatch(setActiveWorkspaceId("01JCOMPANY00000000000000000"));
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    for (let i = 0; i < 2; i++) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "ok" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    await store
      .dispatch(
        authApi.endpoints.forgotPassword.initiate({ email: "user@example.com" }),
      )
      .unwrap();
    await store
      .dispatch(
        authApi.endpoints.resetPassword.initiate({
          token,
          password: "New-Password-123",
        }),
      )
      .unwrap();

    const [forgot, reset] = fetchMock.mock.calls.map((call) => call[0] as Request);
    expect(forgot.url).toBe("http://localhost:3001/api/auth/forgot-password");
    expect(forgot.method).toBe("POST");
    await expect(forgot.clone().json()).resolves.toEqual({
      email: "user@example.com",
    });
    expect(reset.url).toBe("http://localhost:3001/api/auth/reset-password");
    expect(reset.url).not.toContain(token);
    await expect(reset.clone().json()).resolves.toEqual({
      token,
      password: "New-Password-123",
    });
    for (const request of [forgot, reset]) {
      expect(request.credentials).toBe("include");
      expect(request.headers.get("X-Company-Id")).toBeNull();
    }
  });

  it("posts logout with cookies and clears authenticated client state and caches", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await store.dispatch(authApi.endpoints.logout.initiate()).unwrap();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:3001/api/auth/logout");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");

    store.dispatch(
      setUser({
        id: "01JUSER0000000000000000000",
        email: "user@example.com",
        firstName: "User",
        lastName: "Person",
        status: EUserStatus.ACTIVE,
      }),
    );
    store.dispatch(setSelectedRole(ECompanyRole.MEMBER));
    store.dispatch(setActiveWorkspaceId("company-1"));
    store.dispatch(openModal({ modalId: "CREATE_CONTRACT_MODAL" }));
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate()).unwrap();

    expect(Object.keys(store.getState().api.queries)).not.toHaveLength(0);
    clearSignedOutClientState(store.dispatch);

    const state = store.getState();
    expect(selectCurrentUser(state)).toBeNull();
    expect(selectIsAuthenticated(state)).toBe(false);
    expect(selectSelectedRole(state)).toBeNull();
    expect(selectActiveWorkspaceId(state)).toBeNull();
    expect(selectRecentWorkspaceIds(state)).toEqual([]);
    expect(selectActiveModal(state)).toBeNull();
    expect(state.api.queries).toEqual({});
    expect(state.api.mutations).toEqual({});
  });

  it("surfaces expired verification responses without reporting success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message:
            "This verification link is invalid, expired, or already used.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    let error: unknown;
    try {
      await store
        .dispatch(
          authApi.endpoints.verifyEmail.initiate({
            token: "expired-verification-token",
          }),
        )
        .unwrap();
    } catch (caught) {
      error = caught;
    }

    expect(getApiErrorStatus(error)).toBe(400);
    expect(getApiErrorMessage(error, "Verification failed")).toContain(
      "expired",
    );
  });

  it("matches the company creation response and handles authorization errors", async () => {
    const company = {
      id: "01JCOMPANY00000000000000000",
      name: "Test Company",
      legalName: "Test Company Ltd",
      registrationNumber: "REG-1",
      taxIdentificationNumber: "TAX-1",
      email: "company@example.com",
      phoneNumber: "+10000000000",
      website: "",
      addressLine1: "1 Test Street",
      addressLine2: "",
      city: "Test City",
      stateRegion: "Test Region",
      postalCode: "00000",
      countryCode: ECountryCode.US,
      defaultCurrencyCode: ECurrencyCode.USD,
      status: EUserStatus.ACTIVE,
    };
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          company,
          membership: {
            id: "01JMEMBER000000000000000000",
            companyId: company.id,
            companyRole: "Company Administrator",
            status: "active",
            canManageCompany: true,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await store
      .dispatch(
        companiesApi.endpoints.createCompany.initiate({
          name: company.name,
          legalName: company.legalName,
          registrationNumber: company.registrationNumber,
          taxIdentificationNumber: company.taxIdentificationNumber,
          email: company.email,
          phoneNumber: company.phoneNumber,
          website: "",
          addressLine1: company.addressLine1,
          addressLine2: "",
          city: company.city,
          stateRegion: company.stateRegion,
          postalCode: company.postalCode,
          countryCode: company.countryCode,
          defaultCurrencyCode: company.defaultCurrencyCode,
        }),
      )
      .unwrap();

    expect(result.company.id).toBe(company.id);
    expect(result.membership.canManageCompany).toBe(true);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:3001/api/companies");
    expect(request.credentials).toBe("include");

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
    const currentUserRequest = store.dispatch(
      authApi.endpoints.getCurrentUser.initiate(),
    );
    await expect(currentUserRequest.unwrap()).rejects.toMatchObject({
      status: 401,
    });
  });

  it("scopes member management, invitation, and profile requests by company", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [],
          meta: {
            totalItems: 0,
            itemCount: 0,
            itemsPerPage: 20,
            totalPages: 0,
            currentPage: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await store
      .dispatch(
        companiesApi.endpoints.getCompanyMembers.initiate({
          companyId: "company-1",
          page: 1,
          limit: 20,
          search: "person",
        }),
      )
      .unwrap();

    let request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe(
      "http://localhost:3001/api/company/members?page=1&limit=20&search=person",
    );
    expect(request.headers.get("X-Company-Id")).toBe("company-1");
    expect(request.credentials).toBe("include");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "invite-1", status: "pending" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await store
      .dispatch(
        companiesApi.endpoints.inviteCompanyMember.initiate({
          companyId: "company-1",
          data: {
            email: "person@example.com",
            companyRole: ECompanyRole.MEMBER,
          },
        }),
      )
      .unwrap();

    request = fetchMock.mock.calls[1][0] as Request;
    expect(request.url).toBe(
      "http://localhost:3001/api/company/invitations",
    );
    expect(request.headers.get("X-Company-Id")).toBe("company-1");
    expect(request.method).toBe("POST");
    await expect(request.clone().json()).resolves.toMatchObject({
      email: "person@example.com",
      companyRole: "Member",
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: "Updated Company" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await store
      .dispatch(
        companiesApi.endpoints.updateCompanyProfile.initiate({
          companyId: "company-1",
          data: { name: "Updated Company" },
        }),
      )
      .unwrap();
    request = fetchMock.mock.calls[2][0] as Request;
    expect(request.url).toBe(
      "http://localhost:3001/api/company/profile",
    );
    expect(request.headers.get("X-Company-Id")).toBe("company-1");
    expect(request.method).toBe("PATCH");
  });

  it("posts invitation decisions without putting the token in the request URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "accepted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await store
      .dispatch(
        companiesApi.endpoints.respondToCompanyInvitation.initiate({
          token: "invitation-token",
          decision: "accept",
        }),
      )
      .unwrap();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost:3001/api/invitations/respond");
    expect(request.method).toBe("POST");
    expect(request.url).not.toContain("invitation-token");
    await expect(request.clone().json()).resolves.toEqual({
      token: "invitation-token",
      decision: "accept",
    });
  });
});
