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
  EDocumentCategory,
  EDocumentVisibility,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
} from "@contractflow/contracts-schema";
import {
  decision,
  document,
  evidence,
  loaded,
  milestone,
  mutation,
  noPermissions,
  outstandingItem,
  page,
  plannerPermissions,
  projectContext,
  stage,
  submission,
  submitterPermissions,
} from "./project-fixtures";
import { MilestoneDetail } from "./milestone-detail";
import { isEligibleEvidence } from "./milestone-submission-form";
import type { ProjectPermissions } from "./project-rules";

// jsdom has no PointerEvent, which Base UI's checkbox and radio create on click.
window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;
vi.setConfig({ testTimeout: 30_000 });

const mocks = vi.hoisted(() => ({
  milestone: vi.fn(),
  submissions: vi.fn(),
  items: vi.fn(),
  documents: vi.fn(),
  submit: vi.fn(),
  submitState: { isLoading: false, error: undefined as unknown },
  decide: vi.fn(),
  decideState: { isLoading: false, error: undefined as unknown },
  start: vi.fn(),
  download: vi.fn(),
  createUpload: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/services/deliveryApi", () => ({
  useGetMilestoneQuery: mocks.milestone,
  useGetMilestoneSubmissionsQuery: mocks.submissions,
  useGetMilestoneOutstandingItemsQuery: mocks.items,
  useGetContractStageQuery: () => loaded(stage),
  useGetContractStagesQuery: () => loaded(page([stage])),
  useStartMilestoneMutation: () => mutation(mocks.start),
  useSubmitMilestoneMutation: () => mutation(mocks.submit, mocks.submitState),
  useDecideMilestoneSubmissionMutation: () =>
    mutation(mocks.decide, mocks.decideState),
  useCreateMilestoneMutation: () => mutation(vi.fn()),
  useUpdateMilestoneMutation: () => mutation(vi.fn()),
}));
vi.mock("@/services/documentsApi", () => ({
  useGetContractDocumentsQuery: mocks.documents,
  useCreateDocumentDownloadUrlMutation: () => [
    (args: unknown) => ({ unwrap: () => mocks.download(args) }),
    { isLoading: false },
  ],
  useCreateDocumentUploadMutation: () => [
    (args: unknown) => ({ unwrap: () => mocks.createUpload(args) }),
  ],
  useCreateDocumentVersionUploadMutation: () => [vi.fn()],
  useCompleteDocumentUploadMutation: () => [
    (args: unknown) => ({ unwrap: () => mocks.complete(args) }),
  ],
}));
vi.mock("@/lib/presignedUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/presignedUpload")>()),
  sha256Hex: async () => "b".repeat(64),
  uploadToPresignedUrl: async () => undefined,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const shared = document();
const otherDocuments = [
  document({
    id: "01J0000000000000000000DOC2",
    title: "Private memo",
    visibility: EDocumentVisibility.PRIVATE,
  }),
  document({
    id: "01J0000000000000000000DOC3",
    title: "Client drawing",
    ownerCompanyId: "company-2",
  }),
  document({
    id: "01J0000000000000000000DOC4",
    title: "Incident photo",
    category: EDocumentCategory.HSE,
  }),
  document({
    id: "01J0000000000000000000DOC5",
    title: "Unfinished upload",
    currentVersion: null,
  }),
];

function setup({
  permissions,
  status = EMilestoneStatus.IN_PROGRESS,
  overrides = {},
  history = [],
  items = [],
}: {
  permissions: ProjectPermissions;
  status?: EMilestoneStatus;
  overrides?: Partial<typeof milestone>;
  history?: ReturnType<typeof submission>[];
  items?: ReturnType<typeof outstandingItem>[];
}) {
  mocks.milestone.mockReturnValue(
    loaded({ ...milestone, status, ...overrides }),
  );
  mocks.submissions.mockReturnValue(loaded(history));
  mocks.items.mockReturnValue(loaded(items));
  const user = userEvent.setup({ delay: null });
  render(
    <MilestoneDetail
      project={projectContext(permissions)}
      milestoneId={milestone.id}
    />,
  );
  return user;
}

const pending = submission({ id: "01J0000000000000000000SUB2", sequence: 1 });
const partial = submission({
  decision: decision(),
});
const outstanding = outstandingItem();

beforeEach(() => {
  mocks.documents.mockReturnValue(loaded(page([shared, ...otherDocuments])));
  for (const fn of [
    mocks.submit,
    mocks.decide,
    mocks.start,
    mocks.download,
    mocks.createUpload,
    mocks.complete,
  ]) {
    fn.mockReset();
  }
  mocks.submit.mockResolvedValue({ data: {} });
  mocks.decide.mockResolvedValue({ data: {} });
  mocks.start.mockResolvedValue({ data: {} });
  mocks.download.mockResolvedValue({ url: "https://storage.example/file" });
  mocks.submitState = { isLoading: false, error: undefined };
  mocks.decideState = { isLoading: false, error: undefined };
});
afterEach(cleanup);

const button = (name: string | RegExp) =>
  screen.queryByRole("button", { name });

describe("milestone controls by role and contract status", () => {
  it("offers the Contractor Project Lead submission, never edits or decisions", () => {
    setup({ permissions: submitterPermissions });
    expect(button("Submit for review")).toBeTruthy();
    expect(button(/Edit milestone|Change dates/)).toBeNull();
    expect(button("Review submission")).toBeNull();
  });

  it("offers the Contractor Project Lead a start on a planned milestone", async () => {
    const user = setup({
      permissions: submitterPermissions,
      status: EMilestoneStatus.PLANNED,
    });
    await user.click(screen.getByRole("button", { name: "Start work" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Africa/Lagos");
    await user.click(
      within(dialog).getByRole("button", { name: "Start work" }),
    );
    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        companyId: "company-1",
        contractId: "contract-1",
        milestoneId: milestone.id,
      }),
    );
  });

  it("offers the Client Project Manager the review of a waiting submission, never a submission", () => {
    setup({
      permissions: plannerPermissions,
      status: EMilestoneStatus.PENDING_APPROVAL,
      overrides: { submittedAt: pending.submittedAt },
      history: [pending],
    });
    expect(button("Review submission")).toBeTruthy();
    // The scope is fixed after a submission: only the dates can change.
    expect(button("Change dates")).toBeTruthy();
    expect(button(/Submit/)).toBeNull();
  });

  it("gives other members read-only access", () => {
    setup({
      permissions: noPermissions,
      status: EMilestoneStatus.PENDING_APPROVAL,
      history: [pending],
    });
    for (const name of [
      /Submit/,
      "Review submission",
      "Start work",
      /Edit milestone|Change dates/,
    ]) {
      expect(button(name)).toBeNull();
    }
    expect(screen.getByText("Submission 1")).toBeTruthy();
  });

  it("removes every action on a suspended or completed contract and says why", () => {
    setup({
      permissions: {
        ...submitterPermissions,
        canSubmit: false,
        statusNotice:
          "This contract is completed: its stages and milestones can be read but not changed.",
      },
    });
    expect(button(/Submit/)).toBeNull();
    expect(screen.getByText(/This contract is completed/)).toBeTruthy();
  });
});

describe("Contractor Project Lead workflow", () => {
  it("shows the rejection reason and offers a resubmission", () => {
    const rejected = submission({
      decision: decision({
        decision: EMilestoneDecisionType.REJECTED,
        reason: "Photos are missing",
        approvedBps: 0,
        cumulativeApprovedBps: 0,
        approvedWork: null,
        raisedItemIds: [],
      }),
    });
    setup({
      permissions: submitterPermissions,
      status: EMilestoneStatus.REJECTED,
      overrides: {
        rejectionReason: "Photos are missing",
        submittedAt: rejected.submittedAt,
      },
      history: [rejected],
    });
    expect(screen.getByText("The latest submission was rejected")).toBeTruthy();
    expect(screen.getAllByText(/Photos are missing/).length).toBeGreaterThan(0);
    expect(button("Resubmit")).toBeTruthy();
  });

  it("offers only documents the API accepts as evidence", () => {
    expect(isEligibleEvidence(shared, "company-1")).toBe(true);
    for (const other of otherDocuments) {
      expect(isEligibleEvidence(other, "company-1")).toBe(false);
    }
  });

  it("submits the whole milestone with evidence, after a review step, once", async () => {
    const user = setup({ permissions: submitterPermissions });
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    const form = await screen.findByRole("form", {
      name: `Submit ${milestone.title}`,
    });
    // Acceptance criteria are shown before submitting.
    expect(form.textContent).toContain(
      "All lights working at night inspection",
    );
    const offered = within(form).getByRole("list", {
      name: "Documents you can attach",
    });
    expect(within(offered).getAllByRole("listitem")).toHaveLength(1);

    await user.click(
      within(form).getByRole("button", { name: "Review submission" }),
    );
    expect(
      within(form).getByText("Describe the work you are submitting."),
    ).toBeTruthy();
    expect(
      within(form).getByText("Attach at least one evidence file."),
    ).toBeTruthy();

    await user.type(
      within(form).getByLabelText(/Completion notes/),
      "Installed and tested",
    );
    await user.type(
      within(form).getByLabelText(/Your measure of completion/),
      "100",
    );
    await user.click(
      within(form).getByRole("checkbox", { name: /Night inspection report/ }),
    );
    await user.type(within(form).getByLabelText(/Caption/), "Night test");
    await user.click(
      within(form).getByRole("button", { name: "Review submission" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("1 file");
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit.mock.calls[0][0]).toEqual({
      companyId: "company-1",
      contractId: "contract-1",
      milestoneId: milestone.id,
      body: {
        notes: "Installed and tested",
        reportedProgressBps: 10000,
        evidence: [{ documentId: shared.id, caption: "Night test" }],
      },
    });
  });

  it("can't send a submission twice while one is on its way", async () => {
    mocks.submitState = { isLoading: true, error: undefined };
    const user = setup({ permissions: submitterPermissions });
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    const form = await screen.findByRole("form", {
      name: `Submit ${milestone.title}`,
    });
    await user.type(within(form).getByLabelText(/Completion notes/), "Done");
    await user.click(
      within(form).getByRole("checkbox", { name: /Night inspection report/ }),
    );
    await user.click(
      within(form).getByRole("button", { name: "Review submission" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const sending = within(dialog).getByRole("button", {
      name: "Submitting…",
    }) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
  });

  it("after a partial approval, keeps the accepted work and submits only the outstanding items", async () => {
    const user = setup({
      permissions: submitterPermissions,
      status: EMilestoneStatus.PARTIALLY_APPROVED,
      overrides: { approvedBps: 8000, submittedAt: partial.submittedAt },
      history: [partial],
      items: [outstanding],
    });
    // Approved and outstanding work shown apart.
    const approved = screen.getByRole("heading", {
      name: "Approved work",
    }).parentElement!;
    expect(approved.textContent).toContain("Eighty lights accepted");
    const open = screen.getByRole("heading", {
      name: "Outstanding work",
    }).parentElement!;
    expect(open.textContent).toContain("Repair twenty lights");
    expect(screen.getByText(/80% is accepted and stays accepted/)).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Submit outstanding work" }),
    );
    const form = await screen.findByRole("form", {
      name: `Submit ${milestone.title}`,
    });
    expect(form.textContent).toContain(
      "80% of this milestone is already accepted",
    );
    const covered = within(form).getByRole("list", {
      name: "Outstanding items covered",
    });
    expect(covered.textContent).toContain("Repair twenty lights");

    await user.type(
      within(form).getByLabelText(/Completion notes/),
      "Repaired",
    );
    await user.click(
      within(form).getByRole("checkbox", { name: /Night inspection report/ }),
    );
    await user.click(
      within(form).getByRole("button", { name: "Review submission" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("covers the 1 outstanding item only");
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit.mock.calls[0][0].body.outstandingItemIds).toEqual([
      outstanding.id,
    ]);
  });

  it("uploads new evidence shared with all parties and attaches it", async () => {
    mocks.createUpload.mockResolvedValue({
      document: { id: "01J0000000000000000000DOC9" },
      version: { id: "01J0000000000000000000VER9" },
      upload: {
        url: "https://storage.example/put",
        method: "PUT",
        headers: {},
        expiresAt: "",
      },
    });
    mocks.complete.mockResolvedValue({
      id: "01J0000000000000000000DOC9",
      title: "Test certificate",
    });
    const user = setup({ permissions: submitterPermissions });
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    const form = await screen.findByRole("form", {
      name: `Submit ${milestone.title}`,
    });
    await user.click(
      within(form).getByRole("button", { name: "Upload a new file" }),
    );
    const upload = within(form).getByRole("group", { name: "Upload evidence" });
    await user.type(
      within(upload).getByLabelText(/^Title/),
      "Test certificate",
    );
    await user.selectOptions(
      within(upload).getByLabelText(/Category/),
      EDocumentCategory.CERTIFICATE,
    );
    await user.upload(
      within(upload).getByLabelText(/^File/),
      new File(["%PDF-1.7"], "certificate.pdf", { type: "application/pdf" }),
    );
    await user.click(
      within(upload).getByRole("button", { name: "Upload and attach" }),
    );
    await waitFor(() => expect(mocks.complete).toHaveBeenCalled());
    expect(mocks.createUpload.mock.calls[0][0].body).toMatchObject({
      title: "Test certificate",
      category: EDocumentCategory.CERTIFICATE,
      visibility: EDocumentVisibility.PUBLIC,
      fileName: "certificate.pdf",
    });

    await user.type(within(form).getByLabelText(/Completion notes/), "Done");
    await user.click(
      within(form).getByRole("button", { name: "Review submission" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit.mock.calls[0][0].body.evidence).toEqual([
      { documentId: "01J0000000000000000000DOC9", caption: null },
    ]);
  });
});

describe("Client Project Manager review", () => {
  async function openReview(options: Parameters<typeof setup>[0]) {
    const user = setup(options);
    await user.click(screen.getByRole("button", { name: "Review submission" }));
    const form = await screen.findByRole("form", {
      name: `Review ${milestone.title}`,
    });
    return { user, form };
  }
  const waiting = {
    permissions: plannerPermissions,
    status: EMilestoneStatus.PENDING_APPROVAL,
    overrides: { submittedAt: pending.submittedAt },
    history: [pending],
  };

  it("shows the evidence in the review and downloads the submitted version", async () => {
    const { user, form } = await openReview(waiting);
    expect(form.textContent).toContain("All lights installed");
    await user.click(
      within(form).getByRole("button", {
        name: `Download ${evidence.title}, version 2`,
      }),
    );
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith({
        companyId: "company-1",
        contractId: "contract-1",
        documentId: evidence.documentId,
        versionId: evidence.documentVersionId,
      }),
    );
  });

  it("approves after confirming", async () => {
    const { user, form } = await openReview(waiting);
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("can't be changed or withdrawn");
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm: approved" }),
    );
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
    expect(mocks.decide.mock.calls[0][0]).toEqual({
      companyId: "company-1",
      contractId: "contract-1",
      milestoneId: milestone.id,
      submissionId: pending.id,
      body: { decision: EMilestoneDecisionType.APPROVED, reason: null },
    });
  });

  it("requires a reason to reject", async () => {
    const { user, form } = await openReview(waiting);
    await user.click(within(form).getByRole("radio", { name: /^Reject/ }));
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    expect(within(form).getByText("A rejection needs a reason.")).toBeTruthy();
    await user.type(
      within(form).getByLabelText(/^Reason/),
      "Lights fail at night",
    );
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Confirm: rejected",
      }),
    );
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
    expect(mocks.decide.mock.calls[0][0].body).toEqual({
      decision: EMilestoneDecisionType.REJECTED,
      reason: "Lights fail at night",
    });
  });

  it("approves in part: the share, the approved work and the outstanding items", async () => {
    const { user, form } = await openReview(waiting);
    await user.click(
      within(form).getByRole("radio", { name: /^Approve in part/ }),
    );
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    expect(
      within(form).getByText("Describe the work this decision accepts."),
    ).toBeTruthy();
    expect(
      within(form).getByText("List the work that is still outstanding."),
    ).toBeTruthy();

    await user.type(
      within(form).getByLabelText(/^Approved work/),
      "Eighty lights",
    );
    await user.type(
      within(form).getByLabelText(/Share of the whole milestone/),
      "100",
    );
    await user.type(
      within(form).getByLabelText(/^Item 1/),
      "Repair twenty lights",
    );
    await user.type(within(form).getByLabelText(/^Reason/), "Twenty fail");
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    // 100% is the whole milestone: that is an approval, not a partial one.
    expect(
      within(form).getByText(
        "A partial approval accepts more than 0% and less than the 100% not yet accepted.",
      ),
    ).toBeTruthy();

    const share = within(form).getByLabelText(/Share of the whole milestone/);
    await user.clear(share);
    await user.type(share, "80");
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("80% approved");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Confirm: partially approved",
      }),
    );
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
    expect(mocks.decide.mock.calls[0][0].body).toEqual({
      decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
      reason: "Twenty fail",
      approvedWork: "Eighty lights",
      approvedBps: 8000,
      outstandingItems: [
        { description: "Repair twenty lights", quantity: null },
      ],
    });
  });

  it("derives the share from the quantity when the milestone has a target", async () => {
    const { user, form } = await openReview({
      ...waiting,
      overrides: {
        ...waiting.overrides,
        targetQuantity: 100,
        quantityUnit: "lights",
        approvedQuantity: 0,
      },
    });
    await user.click(
      within(form).getByRole("radio", { name: /^Approve in part/ }),
    );
    await user.type(
      within(form).getByLabelText(/^Approved work/),
      "Eighty lights",
    );
    await user.type(within(form).getByLabelText(/Quantity accepted/), "80");
    expect(form.textContent).toContain("This accepts 80% of the milestone");
    await user.type(within(form).getByLabelText(/^Item 1/), "Repair");
    await user.type(within(form).getByLabelText(/^Quantity lights/), "10");
    await user.type(within(form).getByLabelText(/^Reason/), "Some fail");
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    expect(
      within(form).getByText(/must add up to the 100 lights not yet accepted/),
    ).toBeTruthy();

    const itemQuantity = within(form).getByLabelText(/^Quantity lights/);
    await user.clear(itemQuantity);
    await user.type(itemQuantity, "20");
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Confirm: partially approved",
      }),
    );
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
    expect(mocks.decide.mock.calls[0][0].body).toMatchObject({
      approvedBps: 8000,
      approvedQuantity: 80,
      outstandingItems: [{ description: "Repair", quantity: 20 }],
    });
  });

  it("accepts some of the outstanding items an outstanding-work submission covers", async () => {
    const second = outstandingItem({
      id: "01J0000000000000000000ITM2",
      description: "Replace two poles",
    });
    const resubmitted = submission({
      id: "01J0000000000000000000SUB3",
      sequence: 2,
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      previousDecisionId: partial.decision!.id,
      addressedItemIds: [outstanding.id, second.id],
    });
    const { user, form } = await openReview({
      permissions: plannerPermissions,
      status: EMilestoneStatus.PENDING_APPROVAL,
      overrides: { approvedBps: 8000, submittedAt: resubmitted.submittedAt },
      history: [partial, resubmitted],
      items: [outstanding, second],
    });
    await user.click(
      within(form).getByRole("radio", { name: /^Approve in part/ }),
    );
    await user.type(
      within(form).getByLabelText(/^Approved work/),
      "Repairs done",
    );
    await user.type(within(form).getByLabelText(/^Reason/), "Poles pending");
    await user.type(
      within(form).getByLabelText(/Share of the whole milestone/),
      "15",
    );
    await user.click(
      within(form).getByRole("checkbox", { name: /Repair twenty lights/ }),
    );
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Confirm: partially approved",
      }),
    );
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
    expect(mocks.decide.mock.calls[0][0].body).toEqual({
      decision: EMilestoneDecisionType.PARTIALLY_APPROVED,
      reason: "Poles pending",
      approvedWork: "Repairs done",
      approvedBps: 1500,
      acceptedItemIds: [outstanding.id],
    });
  });

  it("can't send a decision twice, and shows the API's refusal", async () => {
    mocks.decideState = {
      isLoading: false,
      error: {
        status: 409,
        data: { message: "This submission has already been decided." },
      },
    };
    const { user, form } = await openReview(waiting);
    await user.click(
      within(form).getByRole("button", { name: "Review decision" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(
      "This submission has already been decided.",
    );
    cleanup();

    mocks.decideState = { isLoading: true, error: undefined };
    const again = await openReview(waiting);
    await again.user.click(
      within(again.form).getByRole("button", { name: "Review decision" }),
    );
    const busy = within(await screen.findByRole("alertdialog")).getByRole(
      "button",
      {
        name: "Saving decision…",
      },
    ) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });
});

describe("submission and decision history", () => {
  it("shows each submission, its kind, its link to the earlier decision and the decision on it", () => {
    const resubmitted = submission({
      id: "01J0000000000000000000SUB3",
      sequence: 2,
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      previousDecisionId: partial.decision!.id,
      addressedItemIds: [outstanding.id],
      submittedById: "member-contractor",
    });
    setup({
      permissions: plannerPermissions,
      status: EMilestoneStatus.PENDING_APPROVAL,
      overrides: { approvedBps: 8000, submittedAt: resubmitted.submittedAt },
      history: [partial, resubmitted],
      items: [outstanding],
    });
    const history = screen.getByRole("list", { name: "Submission history" });
    const [first, second] = within(history)
      .getAllByRole("listitem", { name: undefined })
      .filter((item) => item.id.startsWith("submission-"));
    expect(first.textContent).toContain("First submission");
    // The viewer submitted the first one; the decision was the client's.
    expect(first.textContent).toContain("You");
    const decided = within(first).getByRole("group", {
      name: "Decision: Partially approved",
    });
    expect(decided.textContent).toContain("Client Project Manager");
    expect(decided.textContent).toContain("Twenty lights are not working");
    expect(decided.textContent).toContain("the milestone is 80% approved");
    expect(decided.textContent).toContain("Repair twenty lights");

    expect(second.textContent).toContain("Outstanding work");
    expect(second.textContent).toContain(
      "Answers the partially approved decision on submission 1",
    );
    expect(second.textContent).toContain("Contractor Project Lead");
    expect(second.textContent).toContain(
      "Waiting for the Client Project Manager",
    );
  });
});
