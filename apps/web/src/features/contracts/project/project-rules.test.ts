import { describe, expect, it } from "vitest";
import {
  EClientContractRole,
  EContractStatus,
  EContractorContractRole,
  EMilestoneStatus,
  EPartyType,
  ELifecycleStageCode,
  EStatus,
  contractRoleLabel,
} from "@contractflow/contracts-schema";
import {
  actorLabel,
  addDays,
  asksForDateOverride,
  contractToday,
  datesOutsideStage,
  isScopeFrozen,
  isSubmittable,
  legacyStatusLabel,
  milestonesOutsideDates,
  projectPermissions,
  projectRoleNames,
  shareForQuantity,
  stageBlocksWork,
  stageOpen,
  stageTransitions,
} from "./project-rules";

const CPM = EClientContractRole.CLIENT_PROJECT_MANAGER;
const CPL = EContractorContractRole.CONTRACTOR_PROJECT_LEAD;

describe("projectPermissions", () => {
  const base = {
    contractStatus: EContractStatus.ACTIVE,
    archived: false,
  };

  it("lets the client's Client Project Manager plan and decide, and nothing else", () => {
    const permissions = projectPermissions({
      ...base,
      roles: [CPM],
      partyType: EPartyType.AWARDING,
    });
    expect(permissions).toMatchObject({
      isPlanner: true,
      isSubmitter: false,
      canPlan: true,
      canOperateAsPlanner: true,
      canSubmit: false,
      statusNotice: null,
    });
  });

  it("lets the awarded party's Contractor Project Lead submit, never plan or decide", () => {
    for (const partyType of [EPartyType.AWARDED]) {
      expect(
        projectPermissions({ ...base, roles: [CPL], partyType }),
      ).toMatchObject({
        isPlanner: false,
        isSubmitter: true,
        canPlan: false,
        canOperateAsPlanner: false,
        canSubmit: true,
      });
    }
  });

  it("gives other Project roles, and members without one, read-only access", () => {
    for (const roles of [
      [EClientContractRole.CLIENT_SITE_ENGINEER],
      [EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR],
      // A Company Administrator without a Project role holds no role here.
      [],
    ]) {
      const permissions = projectPermissions({
        ...base,
        roles,
        partyType: EPartyType.AWARDING,
      });
      expect(permissions.canPlan || permissions.canSubmit).toBe(false);
      expect(permissions.canOperateAsPlanner).toBe(false);
    }
  });

  it("follows the side of the contract, not the role value alone", () => {
    expect(
      projectPermissions({
        ...base,
        roles: [CPM],
        partyType: EPartyType.AWARDED,
      }).isPlanner,
    ).toBe(false);
    expect(
      projectPermissions({
        ...base,
        roles: [CPL],
        partyType: EPartyType.AWARDING,
      }).isSubmitter,
    ).toBe(false);
    expect(
      projectPermissions({ ...base, roles: [CPL], partyType: undefined })
        .isSubmitter,
    ).toBe(false);
  });

  it("allows planning only on a draft, and nothing on a suspended, completed or archived contract", () => {
    const draft = projectPermissions({
      roles: [CPM],
      partyType: EPartyType.AWARDING,
      contractStatus: EContractStatus.DRAFT,
      archived: false,
    });
    expect(draft).toMatchObject({ canPlan: true, canOperateAsPlanner: false });
    expect(draft.statusNotice).toContain("still a draft");
    expect(
      projectPermissions({
        roles: [CPL],
        partyType: EPartyType.AWARDED,
        contractStatus: EContractStatus.DRAFT,
        archived: false,
      }).canSubmit,
    ).toBe(false);

    for (const contractStatus of [
      EContractStatus.SUSPENDED,
      EContractStatus.COMPLETED,
    ]) {
      const planner = projectPermissions({
        roles: [CPM],
        partyType: EPartyType.AWARDING,
        contractStatus,
        archived: false,
      });
      const lead = projectPermissions({
        roles: [CPL],
        partyType: EPartyType.AWARDED,
        contractStatus,
        archived: false,
      });
      expect(planner.canPlan || planner.canOperateAsPlanner).toBe(false);
      expect(lead.canSubmit).toBe(false);
      expect(planner.statusNotice).toContain(`is ${contractStatus}`);
      // Still who they are, so the screens can say so.
      expect(planner.isPlanner && lead.isSubmitter).toBe(true);
    }

    const archived = projectPermissions({
      roles: [CPM],
      partyType: EPartyType.AWARDING,
      contractStatus: EContractStatus.ACTIVE,
      archived: true,
    });
    expect(archived.canPlan || archived.canOperateAsPlanner).toBe(false);
    expect(archived.statusNotice).toContain("archived");
  });
});

describe("contract days", () => {
  it("uses the contract's time zone, as the API judges overdue", () => {
    // 23:30 UTC on 9 Nov: already 10 Nov in Lagos, still 9 Nov in Pago Pago.
    const now = new Date("2026-11-09T23:30:00.000Z");
    expect(contractToday("Africa/Lagos", now)).toBe("2026-11-10");
    expect(contractToday("Pacific/Pago_Pago", now)).toBe("2026-11-09");
  });

  it("falls back to UTC for a missing or unknown time zone, as the API does", () => {
    const now = new Date("2026-11-09T23:30:00.000Z");
    expect(contractToday("Not/AZone", now)).toBe("2026-11-09");
    expect(contractToday(null, now)).toBe("2026-11-09");
  });

  it("adds whole days across month ends", () => {
    expect(addDays("2027-01-25", 14)).toBe("2027-02-08");
  });
});

describe("stages", () => {
  it("offers only the moves the API allows", () => {
    expect(stageTransitions(EStatus.PLANNED)).toEqual(["start", "cancel"]);
    expect(stageTransitions(EStatus.IN_PROGRESS)).toEqual([
      "hold",
      "complete",
      "cancel",
    ]);
    expect(stageTransitions(EStatus.ON_HOLD)).toEqual(["resume", "cancel"]);
    expect(stageTransitions(EStatus.COMPLETED)).toEqual([]);
    expect(stageTransitions(EStatus.CANCELLED)).toEqual([]);
  });

  it("allows only the post-contract obligations stage during defects liability", () => {
    expect(
      stageOpen(EContractStatus.DEFECTS_LIABILITY, {
        stageCode: ELifecycleStageCode.MOBILISATION,
      }),
    ).toBe(false);
    expect(
      stageOpen(EContractStatus.DEFECTS_LIABILITY, {
        stageCode: ELifecycleStageCode.POST_CONTRACT_OBLIGATIONS,
      }),
    ).toBe(true);
    expect(stageOpen(EContractStatus.ACTIVE, { stageCode: null })).toBe(true);
  });

  it("blocks work while a stage is on hold or closed", () => {
    expect(stageBlocksWork({ status: EStatus.ON_HOLD })).toContain("on hold");
    expect(stageBlocksWork({ status: EStatus.COMPLETED })).toContain("closed");
    expect(stageBlocksWork({ status: EStatus.IN_PROGRESS })).toBeNull();
  });
});

describe("dates within the stage", () => {
  const stage = {
    plannedStartDate: "2027-01-01",
    plannedEndDate: "2027-06-30",
  };

  it("names the dates outside the stage; the revised due date isn't checked", () => {
    expect(
      datesOutsideStage(stage, {
        plannedStartDate: "2026-12-20",
        dueDate: "2027-07-02",
      }),
    ).toEqual(["plannedStartDate", "dueDate"]);
    expect(
      datesOutsideStage(stage, {
        plannedStartDate: null,
        dueDate: "2027-06-30",
      }),
    ).toEqual([]);
  });

  it("finds the milestones new stage dates would leave outside", () => {
    const milestones = [
      {
        id: "a",
        title: "A",
        plannedStartDate: "2027-01-10",
        dueDate: "2027-02-01",
      },
      { id: "b", title: "B", plannedStartDate: null, dueDate: "2027-06-15" },
    ];
    expect(
      milestonesOutsideDates(milestones, "2027-01-01", "2027-05-31").map(
        ({ id }) => id,
      ),
    ).toEqual(["b"]);
  });

  it("recognises the API asking for an override reason", () => {
    expect(
      asksForDateOverride(
        "The milestone’s its due date (2027-07-02) fall outside the stage's planned dates. Give a dateOverrideReason to plan it this way anyway.",
      ),
    ).toBe(true);
    expect(asksForDateOverride("Stage was not found.")).toBe(false);
  });
});

describe("milestones", () => {
  it("allows submitting from the statuses the API allows", () => {
    expect(isSubmittable(EMilestoneStatus.REJECTED)).toBe(true);
    expect(isSubmittable(EMilestoneStatus.PARTIALLY_APPROVED)).toBe(true);
    expect(isSubmittable(EMilestoneStatus.PENDING_APPROVAL)).toBe(false);
    expect(isSubmittable(EMilestoneStatus.APPROVED)).toBe(false);
    // Legacy statuses are left for the operator's transition.
    expect(isSubmittable(EMilestoneStatus.AT_RISK)).toBe(false);
  });

  it("fixes the scope from the first submission", () => {
    expect(isScopeFrozen({ submittedAt: null })).toBe(false);
    expect(isScopeFrozen({ submittedAt: "2027-03-01T09:00:00.000Z" })).toBe(
      true,
    );
  });

  it("describes a legacy status as earlier context, without mapping it", () => {
    expect(legacyStatusLabel("at_risk")).toBe("Earlier status: At risk");
    expect(legacyStatusLabel(null)).toBeNull();
  });

  it("names the viewer as You and the other side by role", () => {
    expect(actorLabel("m1", "m1", "Client Project Manager")).toBe("You");
    expect(actorLabel("m2", "m1", "Client Project Manager")).toBe(
      "Client Project Manager",
    );
  });

  it("works out a quantity-based share as the API requires", () => {
    // 80 of 100 accepted: 80%.
    expect(
      shareForQuantity({
        targetQuantity: 100,
        approvedQuantity: 0,
        approvedBps: 0,
        quantity: 80,
      }),
    ).toBe(8000);
    // 1 of 3 more after 1 of 3: floor(6666) − 3333.
    expect(
      shareForQuantity({
        targetQuantity: 3,
        approvedQuantity: 1,
        approvedBps: 3333,
        quantity: 1,
      }),
    ).toBe(3333);
  });
});

describe("role names on a subcontract", () => {
  it("reads main contractor and subcontractor on a subcontract only", () => {
    expect(projectRoleNames({ parentContractId: null })).toEqual({
      planner: "Client Project Manager",
      lead: "Contractor Project Lead",
    });
    expect(
      projectRoleNames({ parentContractId: "01J0000000000000000000MAIN" }),
    ).toEqual({
      planner: "Main Contractor Project Manager",
      lead: "Subcontractor Project Lead",
    });
  });

  it("renames the four Project roles and leaves HSE and Finance roles alone", () => {
    expect(
      contractRoleLabel(EClientContractRole.CLIENT_SITE_ENGINEER, true),
    ).toBe("Main Contractor Site Engineer");
    expect(
      contractRoleLabel(
        EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
        true,
      ),
    ).toBe("Subcontractor Site Supervisor");
    expect(contractRoleLabel(EClientContractRole.HSE_MANAGER, true)).toBe(
      "HSE Manager",
    );
    expect(
      contractRoleLabel(EClientContractRole.CLIENT_PROJECT_MANAGER, false),
    ).toBe("Client Project Manager");
  });
});
