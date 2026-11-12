import type { AssignableContractWorkspace } from "@contractflow/contracts-schema";
import type { ContractSection } from "./contract-sections";

/**
 * The Project, HSE and Finance workspaces of a contract. Entering one needs
 * an explicit contract role in it (the API decides; see
 * `GET /contract/workspaces/:workspace`). Company Administrator rights alone
 * never open a workspace.
 */
export const CONTRACT_WORKSPACES: Array<{
  id: AssignableContractWorkspace;
  label: string;
  /** What the workspace is for, from the user stories. */
  purpose: string;
  /** Existing contract sections that hold this workspace's current records. */
  sections: ContractSection[];
  /** What the workspace will hold, not built yet. Shown as planned. */
  planned: string[];
}> = [
  {
    id: "project",
    label: "Project",
    purpose:
      "Delivery of the contract: its stages, milestones, variations and the contractor's daily site logs, shared between the client's project team and the contractor's.",
    sections: ["overview", "sites", "documents", "history"],
    planned: [
      "Stages and milestones, with submission and approval",
      "Variations and their cost and time impact",
      "Daily site logs",
    ],
  },
  {
    id: "hse",
    label: "HSE",
    purpose:
      "Health, safety and environment on the contract: incidents, inspections, corrective actions and compliance records.",
    sections: ["documents", "history"],
    planned: [
      "Incidents and the people involved",
      "Inspections and findings",
      "Corrective actions",
      "Compliance records and their expiry",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    purpose:
      "The money side of the contract: invoices, certification and payments.",
    sections: ["documents", "history"],
    planned: ["Invoices", "Certification", "Payments"],
  },
];

export type ContractWorkspaceView = "overview" | "team";

export function workspaceMeta(workspace: AssignableContractWorkspace) {
  return CONTRACT_WORKSPACES.find(({ id }) => id === workspace)!;
}

/** The workspace named by a URL segment, or null for anything else. */
export function parseContractWorkspace(
  segment: string,
): AssignableContractWorkspace | null {
  return CONTRACT_WORKSPACES.find(({ id }) => id === segment)?.id ?? null;
}

export function contractWorkspaceHref(
  contractId: string,
  workspace: AssignableContractWorkspace,
  view: ContractWorkspaceView = "overview",
): string {
  const base = `/dashboards/contracts/${encodeURIComponent(contractId)}/workspaces/${workspace}`;
  return view === "overview" ? base : `${base}/${view}`;
}
