import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EInvitationStatus } from "@contractflow/contracts-schema";
import { InvitationResponseView } from "@/features/companies/_views/invitation-response-view";
import { MyInvitationsView } from "./_views/my-invitations-view";
import {
  activateJoinedCompany,
  classifyInvitationAnswer,
  invitationRegisterPath,
  invitationSignInPath,
  joinedCompanyLandingPath,
} from "./joinedCompany";
import { invitationTokenFromRedirect } from "@/features/auth/signInRedirect";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  currentUser: vi.fn(),
  myInvitations: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: mocks.currentUser,
  useLogoutMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/features/companies", () => ({
  useGetPublicCompanyInvitationQuery: mocks.preview,
  useRespondToCompanyInvitationMutation: () => [vi.fn(), { isLoading: false }],
  useGetMyCompanyInvitationsQuery: mocks.myInvitations,
  useRespondToMyCompanyInvitationMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
}));

const TOKEN = "invitation-token-123";
const pendingInvitation = {
  status: EInvitationStatus.PENDING,
  companyName: "Acme Works",
  inviterName: "Ada Admin",
  email: "ari@example.com",
  companyRole: "Member",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const signedOut = {
  data: undefined,
  error: { status: 401, data: { message: "Authentication required." } },
  isLoading: false,
};
const signedInAs = (email: string) => ({
  data: {
    id: "user-1",
    email,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  },
  error: undefined,
  isLoading: false,
});

function renderLanding(token = TOKEN) {
  return renderToStaticMarkup(<InvitationResponseView token={token} />);
}

const escapedHref = (href: string) => href.replaceAll("&", "&amp;");

describe("the invitation link page", () => {
  beforeEach(() => {
    mocks.preview.mockReturnValue({
      currentData: pendingInvitation,
      error: undefined,
      isLoading: false,
    });
    mocks.currentUser.mockReturnValue(signedOut);
  });

  it("shows a loading state while the invitation is checked", () => {
    mocks.preview.mockReturnValue({
      currentData: undefined,
      error: undefined,
      isLoading: true,
    });

    expect(renderLanding()).toContain("Checking your invitation");
  });

  it("treats a missing token as an invalid link", () => {
    expect(renderLanding("")).toContain(
      "We couldn&#x27;t find this invitation",
    );
  });

  it("treats an unknown token as an invalid link", () => {
    mocks.preview.mockReturnValue({
      currentData: undefined,
      error: { status: 404, data: { message: "Invitation was not found." } },
      isLoading: false,
    });

    expect(renderLanding()).toContain("We couldn&#x27;t find this invitation");
  });

  it.each([
    [
      EInvitationStatus.EXPIRED,
      "This invitation has expired",
      "send you a new invitation",
    ],
    [
      EInvitationStatus.REVOKED,
      "This invitation was withdrawn",
      "revoked this invitation",
    ],
    [
      EInvitationStatus.ACCEPTED,
      "Invitation already accepted",
      "already been accepted",
    ],
    [EInvitationStatus.DECLINED, "Invitation declined", "was declined"],
  ])(
    "explains a %s invitation without offering to accept it",
    (status, title, detail) => {
      mocks.preview.mockReturnValue({
        currentData: { status },
        error: undefined,
        isLoading: false,
      });

      const markup = renderLanding();

      expect(markup).toContain(title);
      expect(markup).toContain(detail);
      expect(markup).not.toContain("Accept invitation");
      expect(markup).not.toContain("Acme Works");
    },
  );

  describe("signed out", () => {
    it("shows who invited which email, to which company and role", () => {
      const markup = renderLanding();

      expect(markup).toContain("Join Acme Works on ContractFlow");
      expect(markup).toContain(
        "Ada Admin invited you to join Acme Works as Member.",
      );
      for (const value of [
        "Acme Works",
        "Ada Admin",
        "ari@example.com",
        "Member",
      ]) {
        expect(markup).toContain(value);
      }
      expect(markup).toContain("You don&#x27;t need to set up a company.");
    });

    it("offers registration and sign-in that both keep the invitation", () => {
      const markup = renderLanding();

      expect(markup).toContain(
        `href="${escapedHref(invitationRegisterPath(TOKEN))}"`,
      );
      expect(markup).toContain(
        `href="${escapedHref(invitationSignInPath(TOKEN))}"`,
      );
      expect(markup).not.toContain("Accept invitation");
    });
  });

  describe("signed in", () => {
    it("lets the invited account accept or decline, and says what joining gives", () => {
      mocks.currentUser.mockReturnValue(signedInAs("ARI@example.com"));

      const markup = renderLanding();

      expect(markup).toMatch(/<button[^>]*>Accept invitation<\/button>/);
      expect(markup).toMatch(/<button[^>]*>Decline<\/button>/);
      expect(markup).not.toMatch(
        /<button[^>]*disabled=""[^>]*>Accept invitation/,
      );
      expect(markup).toContain(
        "won&#x27;t have access to any contract until a Company Administrator",
      );
    });

    it("refuses another account and offers to switch to the invited email", () => {
      mocks.currentUser.mockReturnValue(signedInAs("someone.else@example.com"));

      const markup = renderLanding();

      expect(markup).toContain("This invitation is for another email address");
      expect(markup).toContain("someone.else@example.com");
      expect(markup).toContain("Sign out and use the invited email");
      expect(markup).not.toContain("Accept invitation");
    });
  });
});

describe("the signed-in user's invitations", () => {
  beforeEach(() => {
    mocks.currentUser.mockReturnValue(signedInAs("ari@example.com"));
  });

  it("lists each pending invitation with its details and both answers", () => {
    mocks.myInvitations.mockReturnValue({
      data: [{ id: "invitation-1", ...pendingInvitation }],
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<MyInvitationsView />);

    expect(markup).toContain("Join Acme Works");
    expect(markup).toContain("Ada Admin");
    expect(markup).toContain(
      'aria-label="Accept the invitation from Acme Works"',
    );
    expect(markup).toContain(
      'aria-label="Decline the invitation from Acme Works"',
    );
    // The token is never part of this page.
    expect(markup).not.toContain(TOKEN);
  });

  it("says when there are no invitations, with a way to set up a company", () => {
    mocks.myInvitations.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<MyInvitationsView />);

    expect(markup).toContain("No pending invitations");
    expect(markup).toContain('href="/onboarding"');
  });

  it("shows a retry when the invitations can't be loaded", () => {
    mocks.myInvitations.mockReturnValue({
      data: undefined,
      error: { status: 500, data: {} },
      isLoading: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<MyInvitationsView />);

    expect(markup).toContain("Your invitations couldn&#x27;t be loaded.");
    expect(markup).toContain("Try again");
  });
});

describe("invitation answers", () => {
  it("counts only an accepted answer that names the company as joining", () => {
    expect(
      classifyInvitationAnswer({
        status: EInvitationStatus.ACCEPTED,
        companyId: "company-1",
      }),
    ).toEqual({ kind: "joined", companyId: "company-1" });
    expect(
      classifyInvitationAnswer({ status: EInvitationStatus.ACCEPTED }),
    ).toEqual({ kind: "expired" });
    expect(
      classifyInvitationAnswer({ status: EInvitationStatus.DECLINED }),
    ).toEqual({ kind: "declined" });
    expect(
      classifyInvitationAnswer({ status: EInvitationStatus.EXPIRED }),
    ).toEqual({ kind: "expired" });
  });

  it("starts administrators on the overview and members on their contracts", () => {
    expect(joinedCompanyLandingPath("Company Administrator" as never)).toBe(
      "/dashboards",
    );
    expect(joinedCompanyLandingPath("Member" as never)).toBe(
      "/dashboards/contracts",
    );
  });
});

describe("activating a joined company", () => {
  const stored = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    stored.clear();
  });

  it("selects the company and remembers it for the user", () => {
    const dispatch = vi.fn();

    activateJoinedCompany(dispatch as never, "user-1", "company-1");

    expect(dispatch).toHaveBeenCalledWith({
      type: "workspace/setActiveWorkspaceId",
      payload: "company-1",
    });
    expect(stored.get("contractflow.activeCompanyId:user-1")).toBe("company-1");
  });
});

describe("invitation links through sign-in", () => {
  it("reads the token back from a sign-in redirect to the invitation", () => {
    expect(
      invitationTokenFromRedirect(
        new URL(
          invitationSignInPath(TOKEN),
          "https://app.example.com",
        ).searchParams.get("redirect"),
      ),
    ).toBe(TOKEN);
  });

  it.each([
    null,
    "/dashboards",
    "//evil.example.com/invitations/respond?token=x",
    "https://evil.example.com/invitations/respond?token=x",
    "/invitations/respond",
  ])("ignores %s", (redirect) => {
    expect(invitationTokenFromRedirect(redirect)).toBeNull();
  });
});
