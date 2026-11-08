import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getApiErrorStatus } from "./apiError";

describe("getApiErrorMessage", () => {
  const fallback = "Unable to save.";

  it("uses the API's validation or conflict message", () => {
    expect(
      getApiErrorMessage(
        { status: 400, data: { message: ["email must be an email"] } },
        fallback,
      ),
    ).toBe("email must be an email");
    expect(
      getApiErrorMessage(
        { status: 409, data: { message: "Already a member." } },
        fallback,
      ),
    ).toBe("Already a member.");
  });

  it("explains permission, session, and network failures", () => {
    expect(getApiErrorMessage({ status: 403 }, fallback)).toBe(
      "You do not have permission to perform this action.",
    );
    expect(getApiErrorMessage({ status: 401 }, fallback)).toBe(
      "Your session has expired. Sign in and try again.",
    );
    expect(
      getApiErrorMessage({ status: "FETCH_ERROR", error: "TypeError" }, fallback),
    ).toBe("Could not reach the server. Check your connection.");
    expect(
      getApiErrorMessage({ status: "TIMEOUT_ERROR", error: "x" }, fallback),
    ).toMatch(/took too long/);
  });

  it("never shows a server error's internal message", () => {
    const message = getApiErrorMessage(
      {
        status: 500,
        data: { message: 'relation "contracts" does not exist' },
      },
      fallback,
    );
    expect(message).not.toContain("relation");
    expect(message).toContain(fallback);
  });

  it("falls back for unknown shapes", () => {
    expect(getApiErrorMessage(undefined, fallback)).toBe(fallback);
    expect(getApiErrorMessage("boom", fallback)).toBe(fallback);
    expect(
      getApiErrorMessage({ status: "PARSING_ERROR", data: "<html>" }, fallback),
    ).toBe(fallback);
  });
});

describe("getApiErrorStatus", () => {
  it("returns only numeric HTTP statuses", () => {
    expect(getApiErrorStatus({ status: 404 })).toBe(404);
    expect(getApiErrorStatus({ status: "FETCH_ERROR" })).toBeNull();
    expect(getApiErrorStatus(null)).toBeNull();
  });
});
