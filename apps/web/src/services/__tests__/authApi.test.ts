import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/store";
import { api } from "@/services/api";
import { authApi } from "@/services/authApi";
import { companiesApi } from "@/features/companies/companiesApi";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";

describe("RTK Query authentication and company API contracts", () => {
  const fetchMock = vi.fn<
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

  it("surfaces expired verification responses without reporting success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: "This verification link is invalid, expired, or already used.",
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
          authApi.endpoints.verifyEmail
            .initiate({ token: "expired-verification-token" }),
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
      countryCode: "US",
      defaultCurrencyCode: "USD",
      status: "active",
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
        JSON.stringify({ statusCode: 401, message: "Authentication required." }),
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
});
