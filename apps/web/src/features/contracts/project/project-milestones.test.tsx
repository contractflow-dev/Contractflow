// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMilestoneStatus } from "@contractflow/contracts-schema";
import {
  loaded,
  milestone,
  mutation,
  noPermissions,
  page,
  plannerPermissions,
  projectContext,
  stage,
} from "./project-fixtures";
import { MilestoneSheet } from "./milestone-form";
import {
  NO_MILESTONE_FILTERS,
  ProjectMilestones,
  toMilestoneQueryFilters,
} from "./project-milestones";

// jsdom has no PointerEvent, which Base UI's checkbox and radio create on click.
window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  milestones: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/services/deliveryApi", () => ({
  useGetContractStagesQuery: () => loaded(page([stage])),
  useGetContractStageQuery: () => loaded(stage),
  useGetMilestonesQuery: mocks.milestones,
  useCreateMilestoneMutation: () => mutation(mocks.create),
  useUpdateMilestoneMutation: () => mutation(mocks.update),
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));
vi.mock("@/hooks/use-debounced-value", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const overdueLegacy = {
  ...milestone,
  id: "01J0000000000000000000MS02",
  title: "Cable trenching",
  isOverdue: true,
  legacyStatus: "at_risk",
  revisedDueDate: "2027-04-15",
  approvedBps: 4000,
  progressBps: 6000,
  submittedAt: "2027-03-02T12:00:00.000Z",
};

beforeEach(() => {
  mocks.milestones.mockReset();
  mocks.milestones.mockReturnValue(
    loaded(page([milestone, overdueLegacy], 42)),
  );
  for (const fn of [mocks.create, mocks.update]) {
    fn.mockReset();
    fn.mockResolvedValue({ data: {} });
  }
});
afterEach(cleanup);

const lastQuery = () => mocks.milestones.mock.calls.at(-1)?.[0];

describe("toMilestoneQueryFilters", () => {
  it("sends submission days as whole days in the contract's time zone", () => {
    const { filters, rangeError } = toMilestoneQueryFilters(
      {
        ...NO_MILESTONE_FILTERS,
        submittedFromDay: "2026-11-10",
        submittedToDay: "2026-11-12",
      },
      "Africa/Lagos",
    );
    expect(rangeError).toBeNull();
    // Lagos is UTC+1: its 10 Nov starts at 23:00 UTC on 9 Nov.
    expect(filters.submittedFrom).toBe("2026-11-09T23:00:00.000Z");
    expect(filters.submittedTo).toBe("2026-11-12T22:59:59.999Z");
  });

  it("falls back to UTC days, and reports a reversed range instead of sending it", () => {
    expect(
      toMilestoneQueryFilters(
        { ...NO_MILESTONE_FILTERS, submittedFromDay: "2026-11-10" },
        "Not/AZone",
      ).filters.submittedFrom,
    ).toBe("2026-11-10T00:00:00.000Z");
    const reversed = toMilestoneQueryFilters(
      {
        ...NO_MILESTONE_FILTERS,
        submittedFromDay: "2026-11-12",
        submittedToDay: "2026-11-10",
      },
      "UTC",
    );
    expect(reversed.rangeError).toBeTruthy();
    expect(reversed.filters.submittedFrom).toBeUndefined();
  });

  it("maps the quick filters to the API's own flags", () => {
    expect(
      toMilestoneQueryFilters(
        { ...NO_MILESTONE_FILTERS, quick: "overdue" },
        "UTC",
      ).filters,
    ).toMatchObject({ overdue: true, pendingReview: undefined });
  });
});

describe("ProjectMilestones", () => {
  it("lists milestones with the API's overdue verdict and any legacy status as context", () => {
    render(<ProjectMilestones project={projectContext(noPermissions)} />);
    const table = screen.getByRole("table", { name: "Milestones" });
    const rows = within(table).getAllByRole("row");
    expect(rows[1].textContent).toContain("Install 100 streetlights");
    expect(rows[1].textContent).not.toContain("Overdue");
    const legacy = rows[2];
    expect(legacy.textContent).toContain("Overdue");
    expect(legacy.textContent).toContain("Earlier status: At risk");
    // The current status is shown as it is, not replaced by the legacy one.
    expect(legacy.textContent).toContain("In progress");
    expect(legacy.textContent).toContain("Originally");
    expect(legacy.textContent).toContain("Reported 60%");
    expect(
      within(legacy)
        .getByRole("link", { name: "Cable trenching" })
        .getAttribute("href"),
    ).toBe(
      "/dashboards/contracts/contract-1/workspaces/project/milestones/01J0000000000000000000MS02",
    );
    expect(screen.getByText(/42 milestones|of 42/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add milestone" })).toBeNull();
  });

  it("filters on the API: stage, status, awaiting review and overdue, back to page 1", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProjectMilestones project={projectContext(noPermissions)} />);
    expect(lastQuery()).toMatchObject({ page: 1, limit: 20 });

    await user.selectOptions(screen.getByLabelText("Stage"), stage.id);
    expect(lastQuery()).toMatchObject({ contractStageId: stage.id });
    await user.selectOptions(
      screen.getByLabelText("Status"),
      EMilestoneStatus.REJECTED,
    );
    expect(lastQuery()).toMatchObject({ status: EMilestoneStatus.REJECTED });
    await user.click(screen.getByRole("button", { name: "Overdue" }));
    expect(lastQuery()).toMatchObject({ overdue: true, page: 1 });
    await user.click(screen.getByRole("button", { name: "Awaiting review" }));
    expect(lastQuery()).toMatchObject({ pendingReview: true });
    expect(lastQuery().overdue).toBeUndefined();

    await user.click(
      screen.getByRole("button", {
        name: "Remove filter: Stage: 1. Civil works",
      }),
    );
    expect(lastQuery().contractStageId).toBeUndefined();
  });

  it("says when nothing matches, and clears the filters", async () => {
    mocks.milestones.mockReturnValue(loaded(page([])));
    const user = userEvent.setup({ delay: null });
    render(<ProjectMilestones project={projectContext(noPermissions)} />);
    await user.click(screen.getByRole("button", { name: "Overdue" }));
    expect(screen.getByText("No milestones match these filters")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastQuery().overdue).toBeUndefined();
  });
});

describe("MilestoneSheet", () => {
  function open(milestoneToEdit = null as typeof milestone | null) {
    render(
      <MilestoneSheet
        project={projectContext(plannerPermissions)}
        open
        stage={milestoneToEdit ? null : stage}
        milestone={milestoneToEdit}
        onClose={vi.fn()}
      />,
    );
  }

  it("creates within its stage: the stage is in the path, never the body", async () => {
    const user = userEvent.setup({ delay: null });
    open();
    const form = await screen.findByRole("form", { name: "Add a milestone" });
    await user.type(within(form).getByLabelText(/^Title/), "Pole foundations");
    await user.type(
      within(form).getByLabelText(/Acceptance criteria/),
      "Cured 28 days",
    );
    await user.type(within(form).getByLabelText(/Share of the stage/), "25");
    await user.type(within(form).getByLabelText(/Target quantity/), "100");
    await user.type(within(form).getByLabelText(/^Unit/), "poles");
    await user.type(within(form).getByLabelText(/Due date/), "2027-05-31");
    await user.click(
      within(form).getByRole("button", { name: "Add milestone" }),
    );

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const [call] = mocks.create.mock.calls[0];
    expect(call.stageId).toBe(stage.id);
    expect(call.body).not.toHaveProperty("contractStageId");
    expect(call.body).toMatchObject({
      title: "Pole foundations",
      acceptanceCriteria: "Cured 28 days",
      weightBps: 2500,
      targetQuantity: 100,
      quantityUnit: "poles",
      dueDate: "2027-05-31",
      isPaymentMilestone: false,
    });
    expect(call.body).not.toHaveProperty("dateOverrideReason");
  });

  it("asks for a date override reason when the dates fall outside the stage", async () => {
    const user = userEvent.setup({ delay: null });
    open();
    const form = await screen.findByRole("form", { name: "Add a milestone" });
    await user.type(within(form).getByLabelText(/^Title/), "Late works");
    await user.type(within(form).getByLabelText(/Share of the stage/), "10");
    await user.type(within(form).getByLabelText(/Due date/), "2027-08-01");
    expect(
      within(form).getByText(
        /due date falls outside its stage's planned dates/,
      ),
    ).toBeTruthy();
    await user.click(
      within(form).getByRole("button", { name: "Add milestone" }),
    );
    expect(mocks.create).not.toHaveBeenCalled();

    await user.type(
      within(form).getByLabelText(/Date override reason/),
      "Agreed extension",
    );
    await user.click(
      within(form).getByRole("button", { name: "Add milestone" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0].body.dateOverrideReason).toBe(
      "Agreed extension",
    );
  });

  it("fixes the scope once work was submitted and sends only the dates", async () => {
    const user = userEvent.setup({ delay: null });
    open({ ...milestone, submittedAt: "2027-03-01T09:00:00.000Z" });
    const form = await screen.findByRole("form", {
      name: `Edit ${milestone.title}`,
    });
    expect(within(form).getByText(/the scope is fixed/)).toBeTruthy();
    expect(
      (within(form).getByLabelText(/^Title/) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(form).getByLabelText(/Share of the stage/) as HTMLInputElement)
        .disabled,
    ).toBe(true);

    await user.type(
      within(form).getByLabelText(/Revised due date/),
      "2027-04-30",
    );
    await user.click(
      within(form).getByRole("button", { name: "Save milestone" }),
    );
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][0]).toEqual({
      companyId: "company-1",
      contractId: "contract-1",
      milestoneId: milestone.id,
      body: { revisedDueDate: "2027-04-30" },
    });
  });
});
