// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EStatus,
  type ContractActivityItem,
} from "@contractflow/contracts-schema";
import {
  decision,
  loaded,
  milestone,
  page,
  plannerPermissions,
  projectContext,
  stage,
  submission,
} from "./project-fixtures";
import {
  ProjectActivity,
  activityReasonLabel,
  projectActivityHref,
} from "./project-activity";
import { ProjectOverview, overallProgressBps } from "./project-overview";
import { ProjectReviews } from "./project-reviews";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  stages: vi.fn(),
  milestones: vi.fn(),
  submissions: vi.fn(),
  activity: vi.fn(),
}));

vi.mock("@/services/deliveryApi", () => ({
  useGetContractStagesQuery: mocks.stages,
  useGetMilestonesQuery: mocks.milestones,
  useGetMilestoneSubmissionsQuery: mocks.submissions,
}));
vi.mock("@/services/contractApi", () => ({
  useGetContractActivityQuery: mocks.activity,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const waiting = {
  ...milestone,
  status: EMilestoneStatus.PENDING_APPROVAL,
  submittedAt: "2027-03-12T09:00:00.000Z",
  isOverdue: true,
};

beforeEach(() => {
  mocks.stages.mockReturnValue(loaded(page([stage])));
  mocks.milestones.mockReset();
  mocks.milestones.mockReturnValue(loaded(page([waiting])));
  mocks.submissions.mockReturnValue(
    loaded([
      submission({ decision: decision() }),
      submission({
        id: "01J0000000000000000000SUB2",
        sequence: 2,
        submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      }),
    ]),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ProjectReviews", () => {
  it("asks the API for the milestones waiting for a decision and summarises each", () => {
    render(<ProjectReviews project={projectContext(plannerPermissions)} />);
    expect(mocks.milestones.mock.calls.at(-1)?.[0]).toMatchObject({
      pendingReview: true,
      page: 1,
    });
    const row = within(
      screen.getByRole("table", { name: "Milestones awaiting review" }),
    ).getAllByRole("row")[1];
    expect(row.textContent).toContain("Install 100 streetlights");
    expect(row.textContent).toContain("1. Civil works");
    expect(row.textContent).toContain("Overdue");
    expect(row.textContent).toContain("Outstanding work");
    expect(row.textContent).toContain("1 evidence file");
    expect(row.textContent).toContain("1 earlier decision");
  });

  it("says when nothing is waiting", () => {
    mocks.milestones.mockReturnValue(loaded(page([])));
    render(<ProjectReviews project={projectContext(plannerPermissions)} />);
    expect(screen.getByText("Nothing is waiting for review")).toBeTruthy();
  });
});

function entry(overrides: Partial<ContractActivityItem>): ContractActivityItem {
  return {
    id: "a1",
    action: "milestone.partially_approved",
    entityType: "milestone",
    entityId: milestone.id,
    workspace: "project",
    reason: "Twenty lights fail",
    summary:
      "Partially approved submission 1 of milestone Install 100 streetlights.",
    actorUserId: "member-self",
    actorName: "Ada Obi",
    target: null,
    occurredAt: "2027-03-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectActivity", () => {
  beforeEach(() => {
    mocks.activity.mockReturnValue(
      loaded(
        page([
          entry({}),
          entry({
            id: "a2",
            action: "stage.updated",
            entityType: "contract_stage",
            entityId: stage.id,
            reason: "Re-sequenced works",
            summary: "Updated stage 1: Civil works.",
            actorUserId: "member-2",
            actorName: "Bola Ade",
          }),
        ]),
      ),
    );
  });

  it("reads only the Project workspace's entries, with meaningful labels, reasons and links", () => {
    render(
      <ProjectActivity
        companyId="company-1"
        contractId="contract-1"
        viewer={{ membershipId: "member-self", companyName: "Acme" }}
      />,
    );
    expect(mocks.activity.mock.calls.at(-1)?.[0]).toMatchObject({
      workspace: "project",
      action: undefined,
    });
    const list = screen.getByRole("list", { name: "Project activity" });
    const [decided, planned] = within(list).getAllByRole("listitem");
    expect(decided.textContent).toContain("Milestone partially approved");
    expect(decided.textContent).toContain(
      "Partial approval reason: Twenty lights fail",
    );
    expect(decided.textContent).toContain("You");
    expect(within(decided).getByRole("link").getAttribute("href")).toBe(
      `/dashboards/contracts/contract-1/workspaces/project/milestones/${milestone.id}`,
    );
    expect(planned.textContent).toContain("Stage plan changed");
    expect(planned.textContent).toContain(
      "Date override reason: Re-sequenced works",
    );
    expect(planned.textContent).toContain("Bola Ade");
  });

  it("filters by action on the API", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProjectActivity companyId="company-1" contractId="contract-1" />);
    await user.selectOptions(
      screen.getByLabelText("Action"),
      "milestone.rejected",
    );
    expect(mocks.activity.mock.calls.at(-1)?.[0]).toMatchObject({
      workspace: "project",
      action: "milestone.rejected",
      page: 1,
    });
  });

  it("labels reasons and destinations by action", () => {
    expect(activityReasonLabel("milestone.updated")).toBe(
      "Date override reason",
    );
    expect(activityReasonLabel("milestone.rejected")).toBe("Rejection reason");
    expect(activityReasonLabel("stage.status_changed")).toBe("Reason");
    expect(
      projectActivityHref("contract-1", {
        entityType: "document",
        entityId: "d",
      }),
    ).toBeNull();
  });
});

describe("ProjectOverview", () => {
  it("weights each stage's approved progress by its share of the contract", () => {
    expect(
      overallProgressBps([
        { weightBps: 4000, progressBps: 5000 },
        { weightBps: 6000, progressBps: 2500 },
      ]),
    ).toBe(3500);
  });

  it("shows the API's totals and asks for deadlines from today in the contract's time zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Already 10 Nov in Lagos.
    vi.setSystemTime(new Date("2026-11-09T23:30:00.000Z"));
    mocks.stages.mockReturnValue(
      loaded(
        page([
          stage,
          {
            ...stage,
            id: "s2",
            sequence: 2,
            status: EStatus.COMPLETED,
            weightBps: 6000,
            progressBps: 10000,
          },
        ]),
      ),
    );
    mocks.milestones.mockImplementation((args: Record<string, unknown>) =>
      loaded(
        args.limit === 1
          ? page(
              [],
              args.pendingReview
                ? 2
                : args.overdue
                  ? 1
                  : args.status === EMilestoneStatus.APPROVED
                    ? 3
                    : 7,
            )
          : page([waiting]),
      ),
    );
    render(<ProjectOverview project={projectContext(plannerPermissions)} />);

    // 40% × 25% + 60% × 100% = 70%.
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "70",
    );
    const stat = (label: string) =>
      screen.getByRole("link", { name: new RegExp(`^${label}`) });
    expect(stat("Stages").textContent).toContain("2");
    expect(stat("Stages").textContent).toContain("1 completed · 1 in progress");
    expect(stat("Milestones").textContent).toContain("7");
    expect(stat("Milestones").textContent).toContain("3 approved");
    expect(stat("Awaiting review").textContent).toContain("2");
    expect(stat("Awaiting review").getAttribute("href")).toContain("/reviews");
    expect(stat("Overdue").textContent).toContain("1");

    const upcoming = mocks.milestones.mock.calls.find(
      ([args]) => args.dueFrom,
    )?.[0];
    expect(upcoming).toMatchObject({
      dueFrom: "2026-11-10",
      dueTo: "2026-11-24",
    });
    // Invoicing isn't reported by the API, so it isn't shown.
    expect(screen.queryByText(/invoiced/i)).toBeNull();
  });
});
