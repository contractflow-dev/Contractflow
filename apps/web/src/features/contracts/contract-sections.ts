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
): string {
  const base = `/dashboards/contracts/${encodeURIComponent(contractId)}`;
  return section === "overview" ? base : `${base}/${section}`;
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
