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
import {
  EContractStatus,
  ELifecycleStageCode,
  EMilestoneStatus,
  EStatus,
} from "@contractflow/contracts-schema";
import {
  loaded,
  milestone,
  mutation,
  noPermissions,
  page,
  contract,
  plannerPermissions,
  projectContext,
  stage,
} from "./project-fixtures";
import { ProjectStages } from "./project-stages";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  stages: vi.fn(),
  milestones: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  applicability: vi.fn(),
  transitionState: { isLoading: false, error: undefined as unknown },
}));

vi.mock("@/services/deliveryApi", () => ({
  useGetContractStagesQuery: mocks.stages,
  useGetContractStageQuery: () => loaded(undefined),
  useGetMilestonesQuery: mocks.milestones,
  useCreateContractStageMutation: () => mutation(mocks.create),
  useUpdateContractStageMutation: () => mutation(mocks.update),
  useTransitionContractStageMutation: () =>
    mutation(mocks.transition, mocks.transitionState),
  useSetContractStageApplicabilityMutation: () => mutation(mocks.applicability),
  useCreateMilestoneMutation: () => mutation(vi.fn()),
  useUpdateMilestoneMutation: () => mutation(vi.fn()),
}));
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

beforeEach(() => {
  mocks.stages.mockReturnValue(loaded(page([stage])));
  // Counts for the row (limit 1) and the edited stage's milestones.
  mocks.milestones.mockImplementation(
    (args: { status?: string; limit: number }) =>
      loaded(
        args.limit === 1
          ? page([], args.status === EMilestoneStatus.APPROVED ? 1 : 3)
          : page([milestone]),
      ),
  );
  for (const fn of [
    mocks.create,
    mocks.update,
    mocks.transition,
    mocks.applicability,
  ]) {
    fn.mockReset();
    fn.mockResolvedValue({ data: {} });
  }
  mocks.transitionState = { isLoading: false, error: undefined };
});
afterEach(cleanup);

describe("ProjectStages", () => {
  it("lists each stage with its status, dates, progress, weight and milestone counts", () => {
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    const table = screen.getByRole("table", { name: "Stages" });
    const row = within(table).getAllByRole("row")[1];
    expect(row.textContent).toContain("1. Civil works");
    expect(row.textContent).toContain("In progress");
    expect(row.textContent).toContain("40%");
    expect(row.textContent).toContain("1 of 3");
    expect(
      within(row).getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe("25");
    expect(screen.getByText(/stages that apply add up to 40%/)).toBeTruthy();
  });

  it("offers no planning or status actions to a read-only member", () => {
    render(<ProjectStages project={projectContext(noPermissions)} />);
    expect(screen.queryByRole("button", { name: "Add stage" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Actions for stage/ }),
    ).toBeNull();
  });

  it("explains a read-only contract status", () => {
    render(
      <ProjectStages
        project={projectContext({
          ...plannerPermissions,
          canPlan: false,
          canOperateAsPlanner: false,
          statusNotice:
            "This contract is suspended: its stages and milestones can be read but not changed.",
        })}
      />,
    );
    expect(screen.getByText(/This contract is suspended/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add stage" })).toBeNull();
  });

  it("creates a stage with the weight in basis points and validates first", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    await user.click(screen.getByRole("button", { name: "Add stage" }));
    const form = await screen.findByRole("form", { name: "Add a stage" });
    await user.click(within(form).getByRole("button", { name: "Add stage" }));
    expect(within(form).getByText("Enter the stage's name.")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText(/^Name/), "Electrical");
    await user.type(
      within(form).getByLabelText(/Share of the contract/),
      "12.5",
    );
    await user.type(within(form).getByLabelText(/Planned start/), "2027-07-01");
    await user.type(within(form).getByLabelText(/Planned end/), "2027-09-30");
    await user.click(within(form).getByRole("button", { name: "Add stage" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      body: {
        name: "Electrical",
        description: null,
        weightBps: 1250,
        plannedStartDate: "2027-07-01",
        plannedEndDate: "2027-09-30",
      },
    });
  });

  it("names the milestones new dates would leave outside and requires an override reason", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    await user.click(
      screen.getByRole("button", { name: "Actions for stage Civil works" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Edit stage" }),
    );
    const form = await screen.findByRole("form", {
      name: "Edit stage Civil works",
    });

    // The milestone is due 2027-03-31; ending the stage in February leaves it out.
    const end = within(form).getByLabelText(/Planned end/);
    await user.clear(end);
    await user.type(end, "2027-02-28");
    expect(
      within(form).getByText(/1 milestone would fall outside these dates/),
    ).toBeTruthy();
    expect(within(form).getByText(/Install 100 streetlights/)).toBeTruthy();

    await user.click(within(form).getByRole("button", { name: "Save stage" }));
    expect(
      within(form).getByText(
        "Explain why the stage's milestones may fall outside these dates.",
      ),
    ).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();

    await user.type(
      within(form).getByLabelText(/Date override reason/),
      "Re-sequenced works",
    );
    await user.click(within(form).getByRole("button", { name: "Save stage" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    // Only the changed field, with the reason; the milestone isn't touched.
    expect(mocks.update).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      stageId: stage.id,
      body: {
        plannedEndDate: "2027-02-28",
        dateOverrideReason: "Re-sequenced works",
      },
    });
  });

  it("requires a reason to put a stage on hold, and shows the API's refusal", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    await user.click(
      screen.getByRole("button", { name: "Actions for stage Civil works" }),
    );
    // From in progress: hold or complete, never start.
    expect(screen.queryByRole("menuitem", { name: "Start stage" })).toBeNull();
    await user.click(
      await screen.findByRole("menuitem", { name: "Put on hold" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Put on hold" }),
    );
    expect(within(dialog).getByText("Give a reason.")).toBeTruthy();
    expect(mocks.transition).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText(/Reason/),
      "Awaiting permits",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Put on hold" }),
    );
    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith({
        companyId: "company-1",
        contractId: "contract-1",
        stageId: stage.id,
        body: { status: EStatus.ON_HOLD, reason: "Awaiting permits" },
      }),
    );
  });

  it("disables the confirmation while the change is saving", async () => {
    mocks.transitionState = { isLoading: true, error: undefined };
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    await user.click(
      screen.getByRole("button", { name: "Actions for stage Civil works" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Complete stage" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Saving…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("ProjectStages lifecycle", () => {
  const planned = {
    ...stage,
    status: EStatus.PLANNED,
    actualStartDate: null,
    stageCode: ELifecycleStageCode.MOBILISATION,
  };
  const openActions = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) => {
    await user.click(
      screen.getByRole("button", { name: `Actions for stage ${name}` }),
    );
  };

  it("marks a planned stage as not applying, requiring a reason", async () => {
    mocks.stages.mockReturnValue(loaded(page([planned])));
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);

    await openActions(user, planned.name);
    await user.click(
      await screen.findByRole("menuitem", { name: "Mark as not applying" }),
    );
    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Mark as not applying" }),
    );
    expect(
      within(dialog).getByText(
        "Say why the stage doesn't apply to this contract.",
      ),
    ).toBeTruthy();
    expect(mocks.applicability).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText(/Reason/),
      "Contractor already mobilised.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Mark as not applying" }),
    );
    await waitFor(() =>
      expect(mocks.applicability).toHaveBeenCalledWith({
        companyId: "company-1",
        contractId: "contract-1",
        stageId: planned.id,
        body: { isApplicable: false, reason: "Contractor already mobilised." },
      }),
    );
  });

  it("shows a stage that doesn't apply, with its reason, and offers to reinstate it", async () => {
    mocks.stages.mockReturnValue(
      loaded(
        page([
          {
            ...planned,
            isApplicable: false,
            applicabilityReason: "No mobilisation needed",
          },
        ]),
      ),
    );
    const user = userEvent.setup({ delay: null });
    render(<ProjectStages project={projectContext(plannerPermissions)} />);
    expect(
      screen.getByText(/Doesn.t apply: No mobilisation needed/),
    ).toBeTruthy();

    await openActions(user, planned.name);
    expect(
      await screen.findByRole("menuitem", { name: "Reinstate stage" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "Add milestone" }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Start stage" })).toBeNull();
  });

  it("offers no new stage once a lifecycle contract's plan is fixed", () => {
    render(
      <ProjectStages
        project={projectContext(
          { ...plannerPermissions, canChangePlan: false },
          {
            contract: {
              ...contract,
              lifecycleTemplateVersionId: "version-1",
            },
          },
        )}
      />,
    );
    expect(screen.queryByRole("button", { name: "Add stage" })).toBeNull();
  });

  it("offers actions on the post-contract obligations stage only, during defects liability", async () => {
    const warranty = {
      ...planned,
      id: "01J0000000000000000000STG9",
      name: "Warranty",
      sequence: 9,
      stageCode: ELifecycleStageCode.POST_CONTRACT_OBLIGATIONS,
    };
    mocks.stages.mockReturnValue(loaded(page([planned, warranty])));
    render(
      <ProjectStages
        project={projectContext(plannerPermissions, {
          contract: { ...contract, status: EContractStatus.DEFECTS_LIABILITY },
        })}
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: `Actions for stage ${planned.name}`,
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Actions for stage Warranty" }),
    ).toBeTruthy();
  });
});
