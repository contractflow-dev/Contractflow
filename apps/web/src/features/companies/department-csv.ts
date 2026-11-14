import type { DepartmentContract } from "@contractflow/contracts-schema";
import { PARTY_TYPE_LABELS } from "@/components/party-type-badge/party-type-badge";
import { humanizeEnumValue } from "@/lib/format";

/** A CSV cell: quoted when it holds a separator, quote or line break. */
function cell(value: string | number): string {
  const text = String(value);
  // Leading =, +, - or @ would be read as a formula by spreadsheets.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const name = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

/** Who a blocker waits on, in the words the table uses. */
export function waitingOnLabel(row: DepartmentContract): string {
  const holder = row.primaryBlocker?.holder;
  if (!holder) return "";
  if (holder.myCompany) return "Us";
  return holder.companyName ?? "Unknown";
}

export const DEPARTMENT_CSV_HEADERS = [
  "Reference",
  "Contract",
  "Our party type",
  "Status",
  "Members from our company",
  "Workspace admins",
  "Holding progress",
  "Waiting on",
  "Other blockers",
  "Days since last movement",
  "Last movement",
];

/** The filtered department table as CSV, one row per contract. */
export function departmentContractsCsv(rows: DepartmentContract[]): string {
  const lines = rows.map((row) =>
    [
      row.referenceNumber,
      row.title,
      PARTY_TYPE_LABELS[row.partyType] ?? row.partyType,
      row.archived ? "Archived" : humanizeEnumValue(row.status),
      row.memberCount,
      row.workspaceAdmins.map(name).join("; ") || "No admin",
      row.primaryBlocker?.label ?? "",
      waitingOnLabel(row),
      row.otherBlockerCount,
      row.daysSinceMovement,
      row.lastMovementAt,
    ]
      .map(cell)
      .join(","),
  );
  return [DEPARTMENT_CSV_HEADERS.map(cell).join(","), ...lines].join("\r\n");
}
