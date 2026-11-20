"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RiDownloadLine, RiTeamLine } from "@remixicon/react";
import {
  DEFAULT_PAGE_LIMIT,
  ECompanyDepartment,
  EContractStatus,
  EDepartmentContractSort,
  EPartyType,
  MAX_PAGE_LIMIT,
  type DepartmentContract,
  type DepartmentContractsQuery,
  type DepartmentWaitingOn,
} from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataTable, DataTableEmpty } from "@/components/data-table/data-table";
import { ListCard } from "@/components/data-table/list-card";
import { PageHeader } from "@/components/page-header/page-header";
import {
  PARTY_TYPE_LABELS,
  PartyTypeBadge,
} from "@/components/party-type-badge/party-type-badge";
import {
  ARCHIVED_STATUS,
  StatusBadge,
} from "@/components/status-badge/status-badge";
import { contractSectionHref } from "@/features/contracts/contract-sections";
import { contractWorkspaceHref } from "@/features/contracts/contract-workspaces";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { formatDate, formatNumber, humanizeEnumValue } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  useGetCompanyDepartmentContractsQuery,
  useLazyGetCompanyDepartmentContractsQuery,
} from "@/services/contractApi";
import { CompanyAdminShell } from "../CompanyAdminShell";
import { departmentContractsCsv } from "../department-csv";
import {
  DEPARTMENTS,
  contractRolesHref,
  departmentStaffingHref,
} from "../departments";

const SORT_LABELS: Record<EDepartmentContractSort, string> = {
  [EDepartmentContractSort.WAITING_ON_US]: "Waiting on us first",
  [EDepartmentContractSort.LONGEST_STALLED]: "Longest without movement",
  [EDepartmentContractSort.REFERENCE]: "Reference",
  [EDepartmentContractSort.TITLE]: "Contract name",
};

const WAITING_LABELS: Record<DepartmentWaitingOn, string> = {
  us: "Waiting on us",
  others: "Waiting on other companies",
};

const oneOf = <T extends string>(
  values: readonly T[],
  value: string | null,
): T | undefined => values.find((option) => option === value);

const personName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

const initials = (person: { firstName: string; lastName: string }) =>
  `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();

const plural = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** The page's filters, read from and written to the URL. */
export interface DepartmentFilters {
  search: string;
  status?: EContractStatus;
  partyType?: EPartyType;
  waitingOn?: DepartmentWaitingOn;
  sort: EDepartmentContractSort;
  includeArchived: boolean;
  page: number;
  limit: number;
}

export function readDepartmentFilters(
  params: Pick<URLSearchParams, "get">,
): DepartmentFilters {
  const number = (key: string, fallback: number, max = Infinity) => {
    const value = Number(params.get(key));
    return Number.isInteger(value) && value > 0
      ? Math.min(value, max)
      : fallback;
  };
  return {
    search: params.get("search")?.trim() ?? "",
    status: oneOf(Object.values(EContractStatus), params.get("status")),
    partyType: oneOf(Object.values(EPartyType), params.get("partyType")),
    waitingOn: oneOf(["us", "others"] as const, params.get("waitingOn")),
    sort:
      oneOf(Object.values(EDepartmentContractSort), params.get("sort")) ??
      EDepartmentContractSort.WAITING_ON_US,
    includeArchived: params.get("archived") === "1",
    page: number("page", 1),
    limit: number("limit", DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT),
  };
}

/** The URL query for a set of filters; defaults are left out. */
export function departmentFiltersQuery(filters: DepartmentFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.partyType) params.set("partyType", filters.partyType);
  if (filters.waitingOn) params.set("waitingOn", filters.waitingOn);
  if (filters.sort !== EDepartmentContractSort.WAITING_ON_US) {
    params.set("sort", filters.sort);
  }
  if (filters.includeArchived) params.set("archived", "1");
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit !== DEFAULT_PAGE_LIMIT) {
    params.set("limit", String(filters.limit));
  }
  return params.toString();
}

function apiQuery(filters: DepartmentFilters): DepartmentContractsQuery {
  return {
    page: filters.page,
    limit: filters.limit,
    sort: filters.sort,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.partyType ? { partyType: filters.partyType } : {}),
    ...(filters.waitingOn ? { waitingOn: filters.waitingOn } : {}),
    ...(filters.includeArchived ? { includeArchived: true } : {}),
  };
}

/**
 * `/dashboards/departments/:department`: a Company Administrator's read-only
 * oversight of one department across the company's contracts. Staffing
 * changes happen in Team and in each contract's Roles section; this page
 * only links to them.
 */
export function CompanyDepartmentView({
  department,
}: {
  department: ECompanyDepartment;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <DepartmentContracts
          companyId={access.company.id}
          department={department}
        />
      )}
    </CompanyAdminShell>
  );
}

/** The page's content; exported for tests. */
export function DepartmentContracts({
  companyId,
  department,
}: {
  companyId: string;
  department: ECompanyDepartment;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readDepartmentFilters(searchParams);
  const { label, description } = DEPARTMENTS[department];
  const [searchInput, setSearchInput] = useState(filters.search);
  const [exporting, setExporting] = useState(false);
  const contracts = useGetCompanyDepartmentContractsQuery(
    { companyId, department, ...apiQuery(filters) },
    { refetchOnMountOrArgChange: true },
  );
  const [fetchPage] = useLazyGetCompanyDepartmentContractsQuery();
  const data = contracts.currentData;
  const filtered = Boolean(
    filters.search ||
    filters.status ||
    filters.partyType ||
    filters.waitingOn ||
    filters.includeArchived,
  );

  const hrefFor = (next: Partial<DepartmentFilters>) => {
    const query = departmentFiltersQuery({ ...filters, page: 1, ...next });
    return query ? `${pathname}?${query}` : pathname;
  };
  const update = (next: Partial<DepartmentFilters>) =>
    router.replace(hrefFor(next), { scroll: false });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ search: searchInput.trim() });
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const rows: DepartmentContract[] = [];
      for (let page = 1; ; page += 1) {
        const result = await fetchPage({
          companyId,
          department,
          ...apiQuery({ ...filters, page, limit: MAX_PAGE_LIMIT }),
        }).unwrap();
        rows.push(...result.data);
        if (page >= result.meta.totalPages) break;
      }
      const blob = new Blob([departmentContractsCsv(rows)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${department}-contracts.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifyError(error, "The contracts couldn't be exported.");
    } finally {
      setExporting(false);
    }
  }

  const summary = data?.summary;
  const tiles = summary
    ? [
        {
          label: "Contracts in this workspace",
          value: summary.contractCount,
          href: hrefFor({
            search: "",
            status: undefined,
            partyType: undefined,
            waitingOn: undefined,
            includeArchived: false,
          }),
        },
        {
          label: "Our members in this workspace",
          value: summary.memberCount,
          href: departmentStaffingHref(department),
        },
        {
          label: "Contracts waiting on us",
          value: summary.waitingOnMyCompanyCount,
          href: hrefFor({ waitingOn: "us" }),
        },
        {
          label: "Contracts waiting on other companies",
          value: summary.waitingOnOtherCompaniesCount,
          href: hrefFor({ waitingOn: "others" }),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <PageHeader
          eyebrow="Department workspaces"
          title={label}
          description={description}
        />
        <Link
          href={departmentStaffingHref(department)}
          className={cn(buttonVariants(), "self-start sm:self-auto")}
        >
          <RiTeamLine className="size-4" aria-hidden="true" />
          Manage staffing
        </Link>
      </div>

      {contracts.isLoading ? (
        <div role="status" aria-label="Loading contracts" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : contracts.error ? (
        getApiErrorStatus(contracts.error) === 403 ? (
          <Alert>
            <AlertTitle>This page is for Company Administrators</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(
                contracts.error,
                "Only a Company Administrator can oversee the company’s contracts.",
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Contracts could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(contracts.error, "Please retry.")}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void contracts.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )
      ) : data ? (
        <>
          <section aria-labelledby="department-summary-heading">
            <h2 id="department-summary-heading" className="sr-only">
              Summary
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((tile) => (
                <li key={tile.label}>
                  <Link
                    href={tile.href}
                    className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <Card highlight className="h-full">
                      <CardContent className="space-y-1">
                        <p className="font-heading text-3xl font-semibold tabular-nums">
                          {formatNumber(tile.value)}
                        </p>
                        <p className="text-sm font-medium">{tile.label}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <ListCard
            headingId="department-contracts-heading"
            title="Contracts"
            action={
              <Button
                type="button"
                variant="outline"
                disabled={exporting || data.meta.totalItems === 0}
                aria-busy={exporting || undefined}
                onClick={() => void exportCsv()}
              >
                <RiDownloadLine aria-hidden="true" data-icon="inline-start" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:items-end">
                <form
                  role="search"
                  onSubmit={submitSearch}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <Field>
                    <FieldLabel htmlFor="department-search">Search</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="department-search"
                        type="search"
                        maxLength={100}
                        placeholder="Contract name or reference"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Search
                      </Button>
                    </div>
                  </Field>
                </form>
                <FilterSelect
                  id="department-status"
                  label="Status"
                  value={filters.status ?? ""}
                  options={Object.values(EContractStatus).map((value) => ({
                    value,
                    label: humanizeEnumValue(value),
                  }))}
                  allLabel="All statuses"
                  onChange={(value) =>
                    update({
                      status: oneOf(Object.values(EContractStatus), value),
                    })
                  }
                />
                <FilterSelect
                  id="department-party"
                  label="Our party type"
                  value={filters.partyType ?? ""}
                  options={Object.values(EPartyType).map((value) => ({
                    value,
                    label: PARTY_TYPE_LABELS[value],
                  }))}
                  allLabel="All party types"
                  onChange={(value) =>
                    update({
                      partyType: oneOf(Object.values(EPartyType), value),
                    })
                  }
                />
                <FilterSelect
                  id="department-waiting"
                  label="Waiting on"
                  value={filters.waitingOn ?? ""}
                  options={(["us", "others"] as const).map((value) => ({
                    value,
                    label: WAITING_LABELS[value],
                  }))}
                  allLabel="Anyone or nobody"
                  onChange={(value) =>
                    update({
                      waitingOn: oneOf(["us", "others"] as const, value),
                    })
                  }
                />
                <Field>
                  <FieldLabel htmlFor="department-sort">Sort</FieldLabel>
                  <NativeSelect
                    id="department-sort"
                    className="w-full"
                    value={filters.sort}
                    onChange={(event) =>
                      update({
                        sort:
                          oneOf(
                            Object.values(EDepartmentContractSort),
                            event.target.value,
                          ) ?? EDepartmentContractSort.WAITING_ON_US,
                      })
                    }
                  >
                    {Object.values(EDepartmentContractSort).map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {SORT_LABELS[value]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field orientation="horizontal" className="w-fit">
                <Checkbox
                  id="department-archived"
                  checked={filters.includeArchived}
                  onCheckedChange={(checked) =>
                    update({ includeArchived: checked === true })
                  }
                />
                <FieldLabel
                  htmlFor="department-archived"
                  className="font-normal"
                >
                  Include archived contracts (read-only)
                </FieldLabel>
              </Field>
            </div>

            <DataTable
              label="Department contracts"
              columns={[
                {
                  id: "contract",
                  header: "Contract",
                  wrap: true,
                  className: "max-w-64",
                  cell: (row) => <ContractCell row={row} />,
                },
                {
                  id: "party",
                  header: "Our party",
                  cell: (row) => <PartyTypeBadge partyType={row.partyType} />,
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (row) => <ContractStatus row={row} />,
                },
                {
                  id: "members",
                  header: "Our members",
                  wrap: true,
                  cell: (row) => (
                    <MembersCell row={row} department={department} />
                  ),
                },
                {
                  id: "admin",
                  header: "Workspace admin",
                  wrap: true,
                  className: "max-w-44",
                  cell: (row) => <AdminCell row={row} />,
                },
                {
                  id: "blocker",
                  header: "Holding progress",
                  wrap: true,
                  className: "max-w-64",
                  cell: (row) => <BlockerCell row={row} />,
                },
                {
                  id: "movement",
                  header: "Last movement",
                  cell: (row) => <MovementCell row={row} />,
                },
              ]}
              rows={data.data}
              getRowKey={(row) => row.contractId}
              rowActions={(row) => (
                <RowActions row={row} department={department} />
              )}
              renderCard={(row) => (
                <div className="space-y-3">
                  <ContractCell row={row} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PartyTypeBadge partyType={row.partyType} />
                    <ContractStatus row={row} />
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Our members
                      </dt>
                      <dd>
                        <MembersCell row={row} department={department} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Workspace admin
                      </dt>
                      <dd>
                        <AdminCell row={row} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Holding progress
                      </dt>
                      <dd>
                        <BlockerCell row={row} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Last movement
                      </dt>
                      <dd>
                        <MovementCell row={row} />
                      </dd>
                    </div>
                  </dl>
                  <RowActions row={row} department={department} />
                </div>
              )}
              loadingLabel="Loading contracts…"
              empty={
                filtered ? (
                  <DataTableEmpty
                    title="No contracts match these filters."
                    action={
                      <Link
                        href={pathname}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        Clear filters
                      </Link>
                    }
                  />
                ) : (
                  <DataTableEmpty
                    title={`No contracts have the ${label} workspace yet`}
                    description={`Contracts appear here once your company is a party and the ${label} workspace is enabled on them.`}
                    action={
                      <Link
                        href="/dashboards/contracts"
                        className={buttonVariants({ variant: "outline" })}
                      >
                        Open contracts
                      </Link>
                    }
                  />
                )
              }
              pagination={{
                meta: data.meta,
                itemLabel: "contracts",
                isFetching: contracts.isFetching,
                onPageChange: (page) => update({ page }),
                onPageSizeChange: (limit) => update({ limit }),
              }}
            />
          </ListCard>
        </>
      ) : null}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">{allLabel}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function ContractCell({ row }: { row: DepartmentContract }) {
  return (
    <div className="min-w-0">
      <Link
        href={contractSectionHref(row.contractId, "overview")}
        className="font-medium break-words text-primary underline-offset-4 hover:underline"
      >
        {row.title}
      </Link>
      <p className="text-xs break-words text-muted-foreground">
        {row.referenceNumber}
      </p>
    </div>
  );
}

function ContractStatus({ row }: { row: DepartmentContract }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusBadge status={row.status} />
      {row.archived ? <StatusBadge status={ARCHIVED_STATUS} /> : null}
    </span>
  );
}

function MembersCell({
  row,
  department,
}: {
  row: DepartmentContract;
  department: ECompanyDepartment;
}) {
  if (row.memberCount === 0) {
    return (
      <Badge variant="warning" className="whitespace-nowrap">
        Unstaffed
      </Badge>
    );
  }
  const extra = row.memberCount - row.members.length;
  return (
    <Link
      href={contractRolesHref(row.contractId, department)}
      className="inline-flex items-center gap-2 rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
      aria-label={`${plural(row.memberCount, "member")} from our company on ${row.title}: ${row.members.map(personName).join(", ")}${extra > 0 ? ` and ${extra} more` : ""}`}
    >
      <AvatarGroup aria-hidden="true">
        {row.members.map((member) => (
          <Avatar key={member.companyUserId} size="sm">
            <AvatarFallback>{initials(member)}</AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 ? <AvatarGroupCount>+{extra}</AvatarGroupCount> : null}
      </AvatarGroup>
      <span className="tabular-nums">{plural(row.memberCount, "member")}</span>
    </Link>
  );
}

function AdminCell({ row }: { row: DepartmentContract }) {
  if (!row.workspaceAdmins.length) {
    return row.archived ? (
      <span className="text-muted-foreground">None</span>
    ) : (
      <Badge variant="warning">No admin</Badge>
    );
  }
  return (
    <span className="text-sm">
      {row.workspaceAdmins.map(personName).join(", ")}
    </span>
  );
}

function BlockerCell({ row }: { row: DepartmentContract }) {
  const blocker = row.primaryBlocker;
  if (row.archived) {
    return (
      <span className="text-sm text-muted-foreground">Archived, read-only</span>
    );
  }
  if (!blocker) {
    return (
      <span className="text-sm text-muted-foreground">Nothing recorded</span>
    );
  }
  const holder = blocker.holder;
  return (
    <div className="space-y-1">
      {holder.myCompany ? (
        <Badge variant="warning">Waiting on us</Badge>
      ) : (
        <Badge variant="secondary">
          {holder.companyName
            ? `Waiting on ${holder.companyName}`
            : "Waiting on: unknown"}
        </Badge>
      )}
      <p className="text-sm">{blocker.label}</p>
      {row.otherBlockerCount ? (
        <p className="text-xs text-muted-foreground">
          +{plural(row.otherBlockerCount, "other")}
        </p>
      ) : null}
    </div>
  );
}

function MovementCell({ row }: { row: DepartmentContract }) {
  return (
    <span className="text-sm">
      <span className="tabular-nums">
        {plural(row.daysSinceMovement, "day")}
      </span>{" "}
      <span className="text-xs text-muted-foreground">
        (
        <time dateTime={row.lastMovementAt}>
          {formatDate(row.lastMovementAt)}
        </time>
        )
      </span>
    </span>
  );
}

function RowActions({
  row,
  department,
}: {
  row: DepartmentContract;
  department: ECompanyDepartment;
}) {
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      <Link
        href={contractSectionHref(row.contractId, "overview")}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`Open contract ${row.title}`}
      >
        Open contract
      </Link>
      {row.archived ? null : (
        <Link
          href={contractRolesHref(row.contractId, department)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label={`Assign a member to ${DEPARTMENTS[department].label} on ${row.title}`}
        >
          Assign member
        </Link>
      )}
      {row.hasWorkspaceRole && !row.archived ? (
        <Link
          href={contractWorkspaceHref(row.contractId, department)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label={`Open the ${DEPARTMENTS[department].label} workspace of ${row.title}`}
        >
          Open workspace
        </Link>
      ) : null}
    </div>
  );
}
