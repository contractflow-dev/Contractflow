import { renderToStaticMarkup } from "react-dom/server";
import type { ChangeEvent, ComponentProps, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_ACTIVITY_ACTIONS,
  type ContractActivityActor,
  type ContractActivityItem,
  type IPaginatedResponse,
} from "@contractflow/contracts-schema";
import {
  ACTION_FILTER_GROUPS,
  NO_ACTIVITY_FILTERS,
  activityActor,
  activityDestination,
  activityViewKey,
  readActivityView,
  activityCategory,
  activityLabel,
  actorOptionLabel,
  ContractActivity,
  describeActivityFilters,
  STATUS_CHANGE_ACTION,
  toActivityQueryFilters,
} from "./contract-activity";

const mocks = vi.hoisted(() => ({
  activity: vi.fn(),
  actors: vi.fn(),
  buttons: [] as Array<ComponentProps<"button">>,
  fields: new Map<string, ComponentProps<"input"> | ComponentProps<"select">>(),
}));

/**
 * The web tests render to static markup, which keeps no state between
 * renders. This keeps each useState slot across renders and runs effects
 * after each one, so a test can change a control and render again to see the
 * result. Only this file's renders use it.
 */
const hooks = vi.hoisted(() => ({
  store: [] as unknown[],
  index: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: <T,>(initial: T | (() => T)) => {
      const slot = hooks.index++;
      if (!(slot in hooks.store)) {
        hooks.store[slot] =
          typeof initial === "function" ? (initial as () => T)() : initial;
      }
      const set = (next: SetStateAction<T>) => {
        hooks.store[slot] =
          typeof next === "function"
            ? (next as (current: T) => T)(hooks.store[slot] as T)
            : next;
      };
      return [hooks.store[slot] as T, set] as const;
    },
    useEffect: (effect: () => void) => {
      hooks.effects.push(effect);
    },
  };
});

// Records each control's props so a test can press or change one.
vi.mock("@workspace/ui/components/button", () => ({
  Button: (props: ComponentProps<"button">) => {
    mocks.buttons.push(props);
    return <button {...props} />;
  },
}));
vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: ComponentProps<"input">) => {
    if (props.id) mocks.fields.set(props.id, props);
    return <input {...props} />;
  },
}));
vi.mock("@workspace/ui/components/native-select", () => ({
  NativeSelect: (props: ComponentProps<"select">) => {
    if (props.id) mocks.fields.set(props.id, props);
    return <select {...props} />;
  },
  NativeSelectOption: (props: ComponentProps<"option">) => (
    <option {...props} />
  ),
  NativeSelectOptGroup: (props: ComponentProps<"optgroup">) => (
    <optgroup {...props} />
  ),
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractActivityQuery: mocks.activity,
  useGetContractActivityActorsQuery: mocks.actors,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));

beforeEach(() => {
  hooks.store = [];
  mocks.fields.clear();
  mocks.actors.mockReset().mockReturnValue({ currentData: undefined });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const viewer = { membershipId: "member-self", companyName: "Acme Works" };

function entry(
  overrides: Partial<ContractActivityItem> = {},
): ContractActivityItem {
  return {
    id: "act-1",
    action: "contract.site_created",
    entityType: "contract",
    entityId: "6f1c2a4e-0000-4000-8000-000000000001",
    summary: "Added site SITE-01 to CTR-001.",
    actorUserId: "member-self",
    actorName: "Max Verifier",
    target: null,
    occurredAt: "2026-11-09T14:30:00.000Z",
    ...overrides,
  };
}

function page(
  items: ContractActivityItem[],
  totalItems = items.length,
): IPaginatedResponse<ContractActivityItem> {
  return {
    data: items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: 10,
      totalPages: Math.max(1, Math.ceil(totalItems / 10)),
      currentPage: 1,
    },
  };
}

function respond(state: {
  currentData?: IPaginatedResponse<ContractActivityItem>;
  error?: unknown;
  isLoading?: boolean;
  isFetching?: boolean;
  refetch?: () => void;
}) {
  mocks.activity.mockReturnValue({
    currentData: undefined,
    error: undefined,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
    // RTK Query's `data`: the latest result, kept while new arguments load.
    data: state.currentData,
    ...state,
  });
}

/** Renders, then runs the effects, as the browser would after a commit. */
function render() {
  hooks.index = 0;
  hooks.effects = [];
  mocks.buttons.length = 0;
  const markup = renderToStaticMarkup(
    <ContractActivity
      companyId="company-1"
      contractId="contract-1"
      viewer={viewer}
    />,
  );
  for (const effect of hooks.effects) effect();
  return markup;
}

describe("activity helpers", () => {
  it("gives every recorded action an understandable label and category", () => {
    expect(activityLabel("contract.site_created")).toBe("Site added");
    expect(activityLabel("document.version_added")).toBe(
      "New document version",
    );
    expect(activityLabel("contract.workspace_admin_granted")).toBe(
      "Workspace Admin rights granted",
    );
    expect(activityCategory("document.downloaded")).toBe("documents");
    expect(activityCategory("contract.role_invitation_created")).toBe("roles");
    expect(activityCategory("contract.workspace_admin_revoked")).toBe("roles");
    expect(activityCategory("contract.party_invitation_accepted")).toBe(
      "parties",
    );
    expect(activityCategory("contract.site_updated")).toBe("sites");
    expect(activityCategory("contract.signatory_recorded")).toBe("signatories");
    expect(activityCategory("contract.restored")).toBe("contract");
  });

  it("reads an action the API adds later as words, not the raw identifier", () => {
    expect(activityLabel("contract.milestone_added")).toBe("Milestone added");
    expect(activityLabel("contract.milestone_added")).not.toContain(".");
  });

  it("says You for the viewer and uses the API's name for everyone else", () => {
    const self = { actorUserId: "member-self", actorName: "Max Verifier" };
    const other = { actorUserId: "member-other", actorName: "Bola Adeyemi" };
    expect(activityActor(self, viewer)).toBe("You");
    expect(activityActor(other, viewer)).toBe("Bola Adeyemi");
    expect(activityActor(other)).toBe("Bola Adeyemi");
  });

  it("falls back to the company, never an invented name, when there is no name", () => {
    for (const actorName of [null, "", "   "]) {
      const other = { actorUserId: "member-other", actorName };
      expect(activityActor(other, viewer)).toBe("A member of Acme Works");
      expect(activityActor(other)).toBe("A member of your company");
    }
    // The viewer's own entry is still "You" even without a resolved name.
    expect(
      activityActor({ actorUserId: "member-self", actorName: null }, viewer),
    ).toBe("You");
  });
});

describe("ContractActivity", () => {
  beforeEach(() => {
    mocks.activity.mockReset();
    mocks.buttons.length = 0;
  });

  it("asks for the contract's activity through the scoped query, fresh on open", () => {
    respond({ currentData: page([]) });
    render();

    expect(mocks.activity).toHaveBeenCalledWith(
      { companyId: "company-1", contractId: "contract-1", page: 1, limit: 10 },
      { refetchOnMountOrArgChange: true },
    );
  });

  it("renders entries with label, category, summary, actor and time", () => {
    respond({
      currentData: page([
        entry(),
        entry({
          id: "act-2",
          action: "document.deleted",
          summary: "Deleted document Drawing A.",
          actorUserId: "member-other",
          actorName: "Bola Adeyemi",
        }),
        entry({
          id: "act-3",
          action: "contract.role_assigned",
          summary: "Assigned a role.",
          actorUserId: "member-unknown",
          actorName: null,
        }),
      ]),
    });
    const markup = render();

    expect(markup).toContain('aria-label="Contract activity"');
    expect(markup.match(/<li class="relative/g)).toHaveLength(3);
    expect(markup).toContain("Site added");
    expect(markup).toContain(">Sites<");
    expect(markup).toContain("Added site SITE-01 to CTR-001.");
    expect(markup).toContain("Document deleted");
    expect(markup).toContain(">Documents<");
    expect(markup).toContain(">You<");
    expect(markup).toContain(">Bola Adeyemi<");
    // An actor the API couldn't name falls back to the company.
    expect(markup).toContain(">A member of Acme Works<");
    // The viewer's own entry never repeats their name, and ids stay hidden.
    expect(markup).not.toContain("Max Verifier");
    expect(markup).not.toContain("member-other");
    expect(markup).toContain('dateTime="2026-11-09T14:30:00.000Z"');
    expect(markup).toMatch(/<time[^>]*>[^<]*2026[^<]*<\/time>/);
    // Raw identifiers stay out of the visible text (the action filter's
    // option values are identifiers, but never shown).
    expect(markup).not.toContain(">contract.site_created<");
    expect(markup.replace(/value="[^"]*"/g, "")).not.toContain(
      "contract.site_created",
    );
    expect(markup).not.toContain("6f1c2a4e");
  });

  it("leaves status changes to the status history instead of listing them twice", () => {
    respond({
      currentData: page([
        entry({
          id: "status-1",
          action: STATUS_CHANGE_ACTION,
          summary: "Changed CTR-001 from draft to active.",
        }),
        entry(),
      ]),
    });
    const markup = render();

    expect(markup).not.toContain("Changed CTR-001 from draft to active.");
    expect(markup).toContain("Site added");
    expect(markup).toContain(
      "1 status change on this page is listed in the status history above.",
    );
  });

  it("does not claim there is no activity when a page holds only status changes", () => {
    respond({
      currentData: page([
        entry({ id: "s1", action: STATUS_CHANGE_ACTION }),
        entry({ id: "s2", action: STATUS_CHANGE_ACTION }),
      ]),
    });
    const markup = render();

    expect(markup).not.toContain("No activity yet");
    expect(markup).toContain("2 status changes on this page are");
  });

  it("renders an entry with missing optional text without breaking", () => {
    respond({
      currentData: page([
        entry({ summary: "", actorUserId: "", actorName: null }),
      ]),
    });
    const markup = render();

    expect(markup).toContain("Site added");
    expect(markup).toContain("A member of Acme Works");
  });

  it("wraps long descriptions and lists every entry of a large page", () => {
    const long = `Updated ${"a very long site description ".repeat(30)}`;
    const items = Array.from({ length: 50 }, (_, index) =>
      entry({ id: `act-${index}`, summary: index === 0 ? long : "Short." }),
    );
    respond({ currentData: page(items, 120) });
    const markup = render();

    expect(markup.match(/<li class="relative/g)).toHaveLength(50);
    expect(markup).toMatch(
      /class="[^"]*break-words[^"]*"[^>]*>Updated a very long/,
    );
    expect(markup).toContain("activity records");
  });

  it("shows a loading skeleton, not an empty state, while loading", () => {
    respond({ isLoading: true, isFetching: true });
    const markup = render();

    expect(markup).toContain('aria-label="Loading contract activity"');
    expect(markup).toContain('data-slot="skeleton"');
    expect(markup).not.toContain("No activity yet");
  });

  it("shows an error with Retry, not an empty state, when the request fails", () => {
    // Server failures are described generically, never with their message.
    respond({ error: { status: 500, data: { message: "Internal detail" } } });
    const markup = render();

    expect(markup).toContain("Unable to load contract activity.");
    expect(markup).not.toContain("Internal detail");
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(markup).not.toContain("No activity yet");
  });

  it("retries the request when Retry is pressed", () => {
    const refetch = vi.fn();
    respond({ error: { status: 500, data: {} }, refetch });
    render();
    // Static rendering cannot click, so press the rendered button's handler.
    const retry = mocks.buttons.find((props) => props.children === "Retry");
    // The component's handler ignores the click event.
    (retry?.onClick as (() => void) | undefined)?.();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("explains that activity is for the contract team when the API refuses (403)", () => {
    respond({ error: { status: 403, data: {} } });
    const markup = render();

    expect(markup).toContain("Activity is shared with the contract team");
    expect(markup).not.toContain("Retry");
  });

  it("shows an empty state when the API returns no activity", () => {
    respond({ currentData: page([]) });
    const markup = render();

    expect(markup).toContain("No activity yet");
    expect(markup).not.toContain('aria-label="Contract activity"');
  });
});

describe("activity filters", () => {
  const actors: ContractActivityActor[] = [
    { actorUserId: "member-self", actorName: "Max Verifier" },
    { actorUserId: "member-2", actorName: "Bola Adeyemi" },
    { actorUserId: "member-3", actorName: null },
  ];

  beforeEach(() => {
    mocks.activity.mockReset();
    respond({ currentData: page([entry()], 30) });
    mocks.actors.mockReturnValue({ currentData: actors });
  });

  const lastArgs = () => mocks.activity.mock.lastCall?.[0];

  /** The id of the control a visible label names. */
  function controlId(markup: string, label: string): string {
    const match = new RegExp(
      `<label[^>]*for="([^"]+)"[^>]*>${label}</label>`,
    ).exec(markup);
    if (!match) throw new Error(`No control labelled ${label}`);
    return match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  function change(markup: string, label: string, value: string) {
    const props = mocks.fields.get(controlId(markup, label));
    props?.onChange?.({ target: { value } } as ChangeEvent<
      HTMLInputElement & HTMLSelectElement
    >);
  }
  function press(name: string) {
    const button = mocks.buttons.find(
      (props) => props.children === name || props["aria-label"] === name,
    );
    (button?.onClick as (() => void) | undefined)?.();
  }

  it("offers labelled date, member and action controls", () => {
    render();
    const markup = render();

    expect(markup).toContain('aria-label="Filter activity"');
    for (const label of ["From", "To", "Member", "Action"]) {
      expect(() => controlId(markup, label)).not.toThrow();
    }
    expect(markup).toMatch(/<input[^>]*type="date"/);
    expect(markup).toContain(">All members<");
    expect(markup).toContain(">Max Verifier (you)<");
    expect(markup).toContain(">Bola Adeyemi<");
    expect(markup).toContain(">Unnamed member<");
    expect(markup).toContain(">All actions<");
    expect(markup).toContain('<optgroup label="Documents">');
    expect(markup).toContain(">Site added<");
    // Status changes live in the status history, not in this filter.
    expect(markup).not.toContain(`value="${STATUS_CHANGE_ACTION}"`);
    // The same responsive grid as the contract register's filters.
    expect(markup).toContain("sm:grid-cols-2 lg:grid-cols-4");
  });

  it("asks for members only once the activity has loaded, and never on a 403", () => {
    respond({ isLoading: true, isFetching: true });
    render();
    expect(mocks.actors.mock.lastCall?.[1]).toEqual({ skip: true });

    respond({ error: { status: 403, data: {} } });
    const refused = render();
    expect(mocks.actors.mock.lastCall?.[1]).toEqual({ skip: true });
    expect(refused).not.toContain('aria-label="Filter activity"');

    respond({ currentData: page([entry()]) });
    render();
    render();
    expect(mocks.actors.mock.lastCall).toEqual([
      { companyId: "company-1", contractId: "contract-1" },
      { skip: false },
    ]);
  });

  it("sends member and action to the API at once, back on page 1", () => {
    let markup = render();
    press("Go to next page");
    markup = render();
    expect(lastArgs()).toMatchObject({ page: 2 });

    change(markup, "Member", "member-2");
    markup = render();
    expect(lastArgs()).toMatchObject({ page: 1, actorUserId: "member-2" });

    press("Go to next page");
    markup = render();
    change(markup, "Action", "contract.site_created");
    render();
    expect(lastArgs()).toMatchObject({
      companyId: "company-1",
      contractId: "contract-1",
      page: 1,
      limit: 10,
      actorUserId: "member-2",
      action: "contract.site_created",
    });
  });

  it("keeps the filters while paging", () => {
    let markup = render();
    change(markup, "Action", "document.deleted");
    markup = render();
    press("Go to next page");
    render();

    expect(lastArgs()).toMatchObject({ page: 2, action: "document.deleted" });
  });

  it("applies dates once typing pauses, as whole days in the viewer's zone", () => {
    let markup = render();
    change(markup, "From", "2026-11-01");
    change(markup, "To", "2026-11-03");
    markup = render();
    expect(lastArgs()).toMatchObject({
      fromDate: undefined,
      toDate: undefined,
    });

    vi.advanceTimersByTime(400);
    render();
    expect(lastArgs()).toMatchObject({
      page: 1,
      fromDate: "2026-11-01T00:00:00.000Z",
      toDate: "2026-11-03T23:59:59.999Z",
    });
  });

  it("reports an end date before the start instead of sending it", () => {
    let markup = render();
    change(markup, "From", "2026-11-10");
    change(markup, "To", "2026-11-01");
    render();
    vi.advanceTimersByTime(400);
    markup = render();

    expect(markup).toMatch(
      /role="alert"[^>]*>The end date is before the start date\.</,
    );
    expect(markup).toMatch(/aria-invalid="true"/);
    expect(lastArgs()).toMatchObject({
      fromDate: undefined,
      toDate: undefined,
    });
  });

  it("names the active filters and clears one or all of them", () => {
    let markup = render();
    change(markup, "Member", "member-2");
    change(markup, "Action", "contract.site_created");
    markup = render();
    expect(markup).toContain("Filtered: Bola Adeyemi · Site added");

    change(markup, "Member", "");
    markup = render();
    expect(lastArgs()).toMatchObject({
      actorUserId: undefined,
      action: "contract.site_created",
    });
    expect(markup).toContain("Filtered: Site added");

    change(markup, "From", "2026-11-01");
    render();
    vi.advanceTimersByTime(400);
    markup = render();
    press("Clear filters");
    markup = render();
    expect(lastArgs()).toMatchObject({
      page: 1,
      fromDate: undefined,
      toDate: undefined,
      actorUserId: undefined,
      action: undefined,
    });
    expect(markup).not.toContain("Filtered:");
    expect(markup).not.toContain(">Clear filters<");
  });

  it("shows a filtered empty state with a way out, not the first-use one", () => {
    let markup = render();
    respond({ currentData: page([]) });
    change(markup, "Action", "document.deleted");
    markup = render();

    expect(markup).toContain("No activity matches these filters");
    expect(markup).not.toContain("No activity yet");
    expect(
      mocks.buttons.filter((props) => props.children === "Clear filters"),
    ).toHaveLength(2);
  });

  it("keeps the controls while a filtered page loads", () => {
    let markup = render();
    respond({ isLoading: false, isFetching: true, currentData: undefined });
    change(markup, "Action", "document.deleted");
    markup = render();

    expect(markup).toContain('aria-label="Loading contract activity"');
    expect(markup).toContain('aria-label="Filter activity"');
    expect(markup).not.toContain("No activity matches these filters");
  });
});

describe("activity filter helpers", () => {
  it("turns days into the viewer's whole days, and leaves unset filters out", () => {
    expect(toActivityQueryFilters(NO_ACTIVITY_FILTERS, "UTC")).toEqual({
      filters: {
        fromDate: undefined,
        toDate: undefined,
        actorUserId: undefined,
        action: undefined,
      },
      rangeError: null,
    });
    expect(
      toActivityQueryFilters(
        {
          fromDay: "2026-03-16",
          toDay: "2026-03-16",
          actorUserId: "m1",
          action: "document.deleted",
        },
        "Africa/Lagos",
      ),
    ).toEqual({
      filters: {
        fromDate: "2026-03-15T23:00:00.000Z",
        toDate: "2026-03-16T22:59:59.999Z",
        actorUserId: "m1",
        action: "document.deleted",
      },
      rangeError: null,
    });
  });

  it("offers every recorded action except status changes, once, in its category", () => {
    const offered = ACTION_FILTER_GROUPS.flatMap((group) => group.actions);
    expect([...offered].sort()).toEqual(
      CONTRACT_ACTIVITY_ACTIONS.filter(
        (action) => action !== STATUS_CHANGE_ACTION,
      ).sort(),
    );
    for (const group of ACTION_FILTER_GROUPS) {
      expect(
        group.actions.every(
          (action) => activityCategory(action) === group.category,
        ),
      ).toBe(true);
      // Every option reads as words.
      expect(
        group.actions.every((action) => !activityLabel(action).includes(".")),
      ).toBe(true);
    }
  });

  it("describes the filters in words and marks the viewer", () => {
    const actors = [{ actorUserId: "me", actorName: "Max Verifier" }];
    expect(actorOptionLabel(actors[0], "me")).toBe("Max Verifier (you)");
    expect(actorOptionLabel({ actorUserId: "x", actorName: "  " })).toBe(
      "Unnamed member",
    );
    expect(describeActivityFilters(NO_ACTIVITY_FILTERS, actors)).toBeNull();
    expect(
      describeActivityFilters(
        {
          fromDay: "2026-11-01",
          toDay: "2026-11-03",
          actorUserId: "me",
          action: "contract.site_created",
        },
        actors,
        "me",
      ),
    ).toMatch(
      /^Filtered: .*2026 to .*2026 · Max Verifier \(you\) · Site added$/,
    );
    expect(
      describeActivityFilters(
        { ...NO_ACTIVITY_FILTERS, fromDay: "2026-11-01" },
        actors,
      ),
    ).toMatch(/^Filtered: from /);
  });
});

describe("related-record navigation", () => {
  const allAccess = { roles: true, sites: true, signatories: true };
  const LINKED: Record<string, string> = {
    "contract.site_created": "sites",
    "contract.site_updated": "sites",
    "contract.signatory_recorded": "signatories",
    "contract.party_invitation_created": "parties",
    "contract.party_invitation_revoked": "parties",
    "contract.party_invitation_accepted": "parties",
    "contract.party_invitation_rejected": "parties",
    "contract.role_assigned": "roles",
    "contract.role_revoked": "roles",
    "contract.role_invitation_created": "roles",
    "contract.role_invitation_revoked": "roles",
    "contract.workspace_admin_granted": "roles",
    "contract.workspace_admin_revoked": "roles",
    "document.upload_initiated": "documents",
    "document.upload_completed": "documents",
    "document.upload_failed": "documents",
    "document.version_added": "documents",
    "document.downloaded": "documents",
  };
  // The record is the contract already open, or no longer exists.
  const NOT_LINKED = [
    "contract.deleted",
    "contract.restored",
    "contract.workspaces_removed",
    "contract.status_transitioned",
    "document.deleted",
  ];

  it("decides a destination for every recorded action", () => {
    expect([...Object.keys(LINKED), ...NOT_LINKED].sort()).toEqual(
      [...CONTRACT_ACTIVITY_ACTIONS].sort(),
    );
    for (const [action, section] of Object.entries(LINKED)) {
      expect(activityDestination(action, allAccess)).toBe(section);
    }
    for (const action of [...NOT_LINKED, "contract.updated", "anything.else"]) {
      expect(activityDestination(action, allAccess)).toBeNull();
    }
  });

  it("links to a restricted section only when the viewer can use it", () => {
    for (const access of [{}, { sites: false }, { sites: undefined }]) {
      expect(activityDestination("contract.site_created", access)).toBeNull();
    }
    expect(
      activityDestination("contract.role_assigned", { roles: false }),
    ).toBeNull();
    expect(
      activityDestination("contract.signatory_recorded", { signatories: true }),
    ).toBe("signatories");
    // Documents and Parties are open to everyone who can see the activity.
    expect(activityDestination("document.downloaded")).toBe("documents");
    expect(activityDestination("contract.party_invitation_created")).toBe(
      "parties",
    );
  });

  function renderWith(
    items: ContractActivityItem[],
    sectionAccess?: Record<string, boolean | undefined>,
  ) {
    respond({ currentData: page(items) });
    hooks.index = 0;
    hooks.effects = [];
    return renderToStaticMarkup(
      <ContractActivity
        companyId="company-1"
        contractId="contract-1"
        viewer={viewer}
        sectionAccess={sectionAccess}
      />,
    );
  }

  it("shows a labelled link to the right tab of the open contract", () => {
    const markup = renderWith(
      [
        entry({ id: "a", action: "contract.site_created" }),
        entry({ id: "b", action: "document.upload_completed" }),
        entry({ id: "c", action: "contract.role_assigned" }),
      ],
      allAccess,
    );

    // Each link: its href, an accessible name starting with the visible
    // text, and that visible text.
    const links = [...markup.matchAll(/<a ([^>]*)>([^<]*)/g)].map(
      ([, attributes, text]) => ({
        href: /href="([^"]*)"/.exec(attributes)?.[1],
        name: /aria-label="([^"]*)"/.exec(attributes)?.[1],
        text: text.trim(),
      }),
    );
    expect(links).toEqual([
      {
        href: "/dashboards/contracts/contract-1/sites",
        name: "Open Sites: Site added",
        text: "Open Sites",
      },
      {
        href: "/dashboards/contracts/contract-1/documents",
        name: "Open Documents: Document uploaded",
        text: "Open Documents",
      },
      {
        href: "/dashboards/contracts/contract-1/roles",
        name: "Open Roles: Contract role assigned",
        text: "Open Roles",
      },
    ]);
    // Links never come from the entry's entityId.
    expect(markup).not.toContain("6f1c2a4e");
  });

  it("leaves entries without a destination, or without access, unlinked", () => {
    const markup = renderWith([
      entry({ id: "a", action: "document.deleted" }),
      entry({ id: "b", action: "contract.restored" }),
      entry({ id: "c", action: "contract.site_created" }), // no sites access
      entry({ id: "d", action: "contract.updated" }), // not a recorded action
    ]);

    expect(markup).not.toMatch(/<a[^>]*href=/);
    expect(markup).not.toContain("Open ");
    expect(markup.match(/<li class="relative/g)).toHaveLength(4);
  });

  it("keeps the summary, actor, time and badge beside the link", () => {
    const markup = renderWith(
      [
        entry({
          action: "contract.site_created",
          actorName: "Bola Adeyemi",
          actorUserId: "m2",
        }),
      ],
      allAccess,
    );
    expect(markup).toContain("Added site SITE-01 to CTR-001.");
    expect(markup).toContain(">Bola Adeyemi<");
    expect(markup).toContain('dateTime="2026-11-09T14:30:00.000Z"');
    expect(markup).toContain(">Sites<");
    expect(markup).toContain(">Open Sites");
  });
});

describe("activity view across tabs", () => {
  let storage: Map<string, string>;
  const key = "contractflow:contract-activity:company-1:contract-1";

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (name: string) => storage.get(name) ?? null,
        setItem: (name: string, value: string) => void storage.set(name, value),
      },
    });
    mocks.activity.mockReset();
    respond({ currentData: page([entry()], 60) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const saved = {
    values: {
      fromDay: "2026-11-01",
      toDay: "",
      actorUserId: "01M72Q9WP6NR672Y0TJ79ZJHMZ",
      action: "document.deleted",
    },
    page: 3,
    limit: 20,
  };

  it("restores the filters and page saved for this company and contract", () => {
    storage.set(key, JSON.stringify(saved));
    // Another contract's view must not leak in.
    storage.set(
      "contractflow:contract-activity:company-1:contract-2",
      JSON.stringify({ ...saved, page: 9 }),
    );
    render();
    vi.advanceTimersByTime(400);
    const markup = render();

    expect(mocks.activity.mock.lastCall?.[0]).toMatchObject({
      page: 3,
      limit: 20,
      fromDate: "2026-11-01T00:00:00.000Z",
      actorUserId: "01M72Q9WP6NR672Y0TJ79ZJHMZ",
      action: "document.deleted",
    });
    expect(markup).toMatch(/<input[^>]*type="date"[^>]*value="2026-11-01"/);
  });

  it("saves the current view as it changes", () => {
    render();
    expect(JSON.parse(storage.get(key) ?? "null")).toEqual({
      values: NO_ACTIVITY_FILTERS,
      page: 1,
      limit: 10,
    });
  });

  it("ignores a saved view that is malformed or out of range", () => {
    for (const bad of [
      "not json",
      JSON.stringify({ ...saved, page: 0 }),
      JSON.stringify({ ...saved, limit: 7 }),
      JSON.stringify({
        ...saved,
        values: { ...saved.values, action: "contract.hacked" },
      }),
      JSON.stringify({
        ...saved,
        values: { ...saved.values, actorUserId: "x' OR 1=1" },
      }),
      JSON.stringify({
        ...saved,
        values: { ...saved.values, fromDay: "yesterday" },
      }),
    ]) {
      storage.set(key, bad);
      expect(readActivityView(key)).toBeNull();
    }
    storage.set(key, JSON.stringify(saved));
    expect(readActivityView(key)).toEqual(saved);
  });

  it("works without storage", () => {
    vi.stubGlobal("window", undefined);
    expect(readActivityView(key)).toBeNull();
    expect(() => render()).not.toThrow();
    expect(activityViewKey("c", "k")).toBe(
      "contractflow:contract-activity:c:k",
    );
  });
});
