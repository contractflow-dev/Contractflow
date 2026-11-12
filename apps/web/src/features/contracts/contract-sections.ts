/**
 * The sections of a contract's detail page. Each has its own URL:
 * Overview at /dashboards/contracts/:id, the rest at /dashboards/contracts/:id/:section.
 */
export const CONTRACT_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "parties", label: "Parties" },
  { id: "roles", label: "Roles" },
  { id: "sites", label: "Sites" },
  { id: "signatories", label: "Signatories" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "History" },
] as const;

export type ContractSection = (typeof CONTRACT_SECTIONS)[number]["id"];

/**
 * Why a contract can be missing. The API answers 404 alike for a contract
 * that doesn't exist, is archived, or isn't visible to the viewer (no contract
 * role, and not a Company Administrator of a party company), so the copy
 * never says which.
 */
export const CONTRACT_UNAVAILABLE_TEXT =
  "It may have been archived, or you don't have access to it. Contracts appear here once you're given a role on them.";

/**
 * Sections whose content only some users can use. Their tab is shown only
 * when the API's permissions allow it; the API still enforces access.
 */
export const RESTRICTED_CONTRACT_SECTIONS = [
  "roles",
  "sites",
  "signatories",
] as const satisfies readonly ContractSection[];

export type RestrictedContractSection =
  (typeof RESTRICTED_CONTRACT_SECTIONS)[number];

export function contractSectionHref(
  contractId: string,
  section: ContractSection,
  target?: ContractActivityTarget | null,
): string {
  const base = `/dashboards/contracts/${encodeURIComponent(contractId)}`;
  const path = section === "overview" ? base : `${base}/${section}`;
  if (!target || target.section !== section) return path;
  const params = new URLSearchParams({
    targetType: target.type,
    targetId: target.id,
    targetSection: target.section,
  });
  if (target.versionId) params.set("targetVersionId", target.versionId);
  if (target.workspace) params.set("targetWorkspace", target.workspace);
  return `${path}?${params.toString()}#activity-target-${encodeURIComponent(target.id)}`;
}

/** The section named by a URL segment, or null for an unknown one. */
export function parseContractSection(segment: string): ContractSection | null {
  return CONTRACT_SECTIONS.find(({ id }) => id === segment)?.id ?? null;
}

export function isRestrictedContractSection(
  section: ContractSection,
): section is RestrictedContractSection {
  return (RESTRICTED_CONTRACT_SECTIONS as readonly string[]).includes(section);
}
import type { ContractActivityTarget } from "@contractflow/contracts-schema";
