"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ContractLifecycleManagement } from "./contract-lifecycle-management";
import {
  EContractSortField,
  EContractStatus,
  ESortOrder,
  type ContractActivityTarget,
} from "@contractflow/contracts-schema";
import { RiAddLine } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { DataPagination } from "@/components/pagination/data-pagination";
import {
  ActionsTableHead,
  DataTable,
  DataTableEmpty,
  DataTableError,
  DataTableRowActions,
  DataTableSkeleton,
  SortableTableHead,
} from "@/components/data-table/data-table";
import {
  DataTableActiveFilters,
  DataTableFilterChips,
  DataTableMoreFilters,
  DataTableSearch,
  DataTableToolbar,
  type ActiveFilter,
} from "@/components/data-table/data-table-toolbar";
import { DropdownMenuLinkItem } from "@workspace/ui/components/dropdown-menu";
import {
  ARCHIVED_STATUS,
  StatusBadge,
} from "@/components/status-badge/status-badge";
import {
  StatusLegendDisclosure,
  type StatusLegendItem,
} from "@/components/status-badge/status-legend";
import { PageHeader } from "@/components/page-header/page-header";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  EMPTY_VALUE,
  formatCalendarDate,
  formatDateTime,
  formatMoneyMinor,
  humanizeEnumValue,
} from "@/lib/format";
import type { Contract, ContractListItem } from "@/services/contractApi";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";
import { parseContractWorkspace } from "../contract-workspaces";
import { ContractSignatoryManagement } from "./contract-signatory-management";
import { ContractDocuments } from "./contract-documents";
import { ContractSiteManagement } from "./contract-site-management";
import { useContractDetails } from "../_hooks/use-contract-details";
import { useContractSectionAccess } from "../_hooks/use-contract-section-access";
import {
  CONTRACT_UNAVAILABLE_TEXT,
  NEW_CONTRACT_PATH,
  contractSectionHref,
  isRestrictedContractSection,
  type ContractSection,
} from "../contract-sections";
import { ContractSectionNav } from "./contract-section-nav";
import { ContractActivity } from "./contract-activity";
import { ContractWorkspacesCard } from "./contract-workspace-screens";
import { ContractWorkspaceManagement } from "./contract-workspace-management";
import {
  ArchivedContractNotice,
  RestoreContractButton,
} from "./contract-archive";
import {
  contractSortOptions,
  useContractsList,
} from "../_hooks/use-contracts-list";
import {
  CONTRACT_STATUS_FILTERS,
  useContractStatusCounts,
} from "../_hooks/use-contract-status-counts";

/** What each contract status means, in the terms the lifecycle actions use. */
const contractStatusLegend: StatusLegendItem[] = [
  {
    status: EContractStatus.DRAFT,
    description: "Created and being set up. It can be activated.",
  },
  {
    status: EContractStatus.ACTIVE,
    description: "In progress. It can be suspended or completed.",
  },
  {
    status: EContractStatus.SUSPENDED,
    description: "On hold until someone resumes it.",
  },
  {
    status: EContractStatus.COMPLETED,
    description: "Finished. A completed contract can't change status again.",
  },
];

const archivedStatusLegend: StatusLegendItem = {
  status: ARCHIVED_STATUS,
  description:
    "Removed from the register. A Company Administrator can restore it.",
};

function parseActivityTarget(
  params: ReturnType<typeof useSearchParams>,
): ContractActivityTarget | null {
  const type = params.get("targetType");
  const id = params.get("targetId");
  const section = params.get("targetSection");
  const validTypes = [
    "contract_site",
    "contract_party",
    "contract_party_invitation",
    "contract_role_assignment",
    "contract_role_invitation",
    "document",
  ] as const;
  const validSections = [
    "parties",
    "roles",
    "sites",
    "signatories",
    "documents",
  ] as const;
  if (
    !id ||
    !validTypes.includes(type as (typeof validTypes)[number]) ||
    !validSections.includes(section as (typeof validSections)[number])
  ) {
    return null;
  }
  const target: ContractActivityTarget = {
    type: type as ContractActivityTarget["type"],
    id,
    section: section as ContractActivityTarget["section"],
  };
  const versionId = params.get("targetVersionId");
  const workspace = params.get("targetWorkspace");
  if (versionId) target.versionId = versionId;
  if (
    workspace === "project" ||
    workspace === "hse" ||
    workspace === "finance"
  ) {
    target.workspace = workspace;
  }
  return target;
}

export function ContractsList({
  companyId,
  canViewArchived,
  canCreateContracts,
}: {
  companyId: string;
  /** The server's membership.canManageCompany for this company. */
  canViewArchived: boolean;
  /** The server's membership.canManageCompany for this company. */
  canCreateContracts: boolean;
}) {
  const {
    searchInput,
    setSearchInput,
    search,
    status,
    setStatus,
    includeDeleted,
    setIncludeDeleted,
    sort,
    setSort,
    sortBy,
    sortOrder,
    toggleSort,
    setPage,
    setLimit,
    currentData,
    error,
    isFetching,
    isLoading,
    refetch,
    submitSearch,
    clearSearch,
    hasFilters,
    clearFilters,
  } = useContractsList(companyId, { canViewArchived });
  const counts = useContractStatusCounts(companyId, {
    search,
    includeDeleted,
  });
  const includeArchivedId = useId();
  const sortId = useId();
  const initialLoading = isLoading || (isFetching && !currentData);
  const contracts = currentData?.data ?? [];
  const sortDirection = (field: EContractSortField) =>
    sortBy === field ? (sortOrder === ESortOrder.ASC ? "asc" : "desc") : null;
  const activeFilters: ActiveFilter[] = [
    ...(search
      ? [{ key: "search", label: `Search: “${search}”`, onRemove: clearSearch }]
      : []),
    ...(includeDeleted
      ? [
          {
            key: "archived",
            label: "Archived only",
            onRemove: () => setIncludeDeleted(false),
          },
        ]
      : []),
  ];
  const newContractLink = (
    // For company administrators; the API makes the same check when the
    // contract is created.
    <Link href={NEW_CONTRACT_PATH} className={buttonVariants()}>
      <RiAddLine aria-hidden="true" data-icon="inline-start" />
      New contract
    </Link>
  );

  return (
    <div className="space-y-6">
      {/* Company Administrators oversee every contract the company is a
          party to; other members see only those they hold a role on. */}
      <PageHeader
        title="Contract register"
        description={
          canCreateContracts
            ? "Manage and monitor the contracts your company is a party to. Open one to see its parties, roles, sites and history."
            : "Contracts you hold a role on. Open one to see its parties and history, and your workspaces."
        }
        actions={canCreateContracts ? newContractLink : undefined}
      />

      <DataTableFilterChips
        label="Filter contracts by status"
        countNoun="contracts"
        value={status}
        onChange={setStatus}
        options={CONTRACT_STATUS_FILTERS.map((value) => ({
          value,
          label: value ? humanizeEnumValue(value) : "All contracts",
          count: counts[value],
        }))}
      />

      <div className="space-y-3">
        <DataTableToolbar
          actions={
            <div className="flex items-center gap-2">
              <label
                htmlFor={sortId}
                className="text-sm whitespace-nowrap text-muted-foreground"
              >
                Sort by
              </label>
              <NativeSelect
                id={sortId}
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {contractSortOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          }
        >
          <DataTableSearch
            id="contract-search"
            label="Search contracts"
            formLabel="Contracts"
            placeholder="Search by title or reference"
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={submitSearch}
            onClear={clearSearch}
          />
          {/* The API lists archived contracts only to company administrators,
              and returns only the archived contracts this company created. */}
          {canViewArchived ? (
            <DataTableMoreFilters
              activeCount={includeDeleted ? 1 : 0}
              onClear={() => setIncludeDeleted(false)}
            >
              <Field orientation="horizontal">
                <Checkbox
                  id={includeArchivedId}
                  checked={includeDeleted}
                  onCheckedChange={setIncludeDeleted}
                />
                <FieldLabel htmlFor={includeArchivedId} className="font-normal">
                  Show archived contracts only
                </FieldLabel>
              </Field>
            </DataTableMoreFilters>
          ) : null}
        </DataTableToolbar>
        <DataTableActiveFilters
          filters={activeFilters}
          onClearAll={() => {
            clearSearch();
            setIncludeDeleted(false);
          }}
        />
        <StatusLegendDisclosure
          label="What do contract statuses mean?"
          items={
            includeDeleted
              ? [...contractStatusLegend, archivedStatusLegend]
              : contractStatusLegend
          }
        />
      </div>

      {error ? (
        <DataTableError
          message={getApiErrorMessage(error, "Unable to load contracts.")}
          onRetry={() => void refetch()}
        />
      ) : initialLoading ? (
        <DataTableSkeleton
          label="Loading contracts…"
          columns={REGISTER_COLUMNS}
        />
      ) : contracts.length ? (
        <div className="space-y-4">
          {/* Narrow screens: one card per contract instead of a wide table. */}
          <ul
            aria-label="Contracts"
            className="divide-y rounded-xl border md:hidden"
          >
            {contracts.map((contract) => (
              <li key={contract.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ContractTitle contract={contract} />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {contract.referenceNumber} ·{" "}
                      {humanizeEnumValue(contract.contractType)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge
                      status={
                        contract.deletedAt ? ARCHIVED_STATUS : contract.status
                      }
                    />
                    <ContractRowActions contract={contract} />
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Counterparty</dt>
                  <dd className="min-w-0 text-end">
                    <Counterparties contract={contract} />
                  </dd>
                  <dt className="text-muted-foreground">Value</dt>
                  <dd className="text-end tabular-nums">
                    {formatMoneyMinor(
                      contract.currentValueMinor,
                      contract.currencyCode,
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Dates</dt>
                  <dd className="text-end">
                    {formatCalendarDate(contract.startDate)} –{" "}
                    {formatCalendarDate(
                      contract.revisedEndDate || contract.endDate,
                    )}
                  </dd>
                </dl>
                {contract.deletedAt ? (
                  <RestoreContractButton
                    companyId={companyId}
                    contract={contract}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          <DataTable label="Contracts" className="hidden md:block">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableTableHead
                  label="Contract"
                  direction={sortDirection(EContractSortField.TITLE)}
                  onSort={() => toggleSort(EContractSortField.TITLE)}
                />
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-end">Value</TableHead>
                <SortableTableHead
                  label="Status"
                  direction={sortDirection(EContractSortField.STATUS)}
                  onSort={() => toggleSort(EContractSortField.STATUS)}
                />
                <SortableTableHead
                  label="Start date"
                  direction={sortDirection(EContractSortField.START_DATE)}
                  onSort={() => toggleSort(EContractSortField.START_DATE)}
                />
                <SortableTableHead
                  label="End date"
                  direction={sortDirection(EContractSortField.END_DATE)}
                  onSort={() => toggleSort(EContractSortField.END_DATE)}
                />
                <ActionsTableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="min-w-56 whitespace-normal">
                    <ContractTitle contract={contract} />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {contract.referenceNumber} ·{" "}
                      {humanizeEnumValue(contract.contractType)}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal">
                    <Counterparties contract={contract} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMoneyMinor(
                      contract.currentValueMinor,
                      contract.currencyCode,
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        contract.deletedAt ? ARCHIVED_STATUS : contract.status
                      }
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCalendarDate(contract.startDate)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCalendarDate(
                      contract.revisedEndDate || contract.endDate,
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      {/* Restoring is the archived contract's main action, so
                          it stays in the row rather than in the menu. */}
                      {contract.deletedAt ? (
                        <RestoreContractButton
                          companyId={companyId}
                          contract={contract}
                        />
                      ) : null}
                      <ContractRowActions contract={contract} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>

          {currentData ? (
            <DataPagination
              meta={currentData.meta}
              itemLabel="contracts"
              isFetching={isFetching}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          ) : null}
        </div>
      ) : hasFilters ? (
        <DataTableEmpty
          title="No contracts match your search or filters."
          description="Try another search, or clear the filters to see every contract."
          action={
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <DataTableEmpty
          title="No contracts yet."
          description={
            canCreateContracts
              ? "Contracts your company creates, or joins when invited, will appear here."
              : "Contracts appear here once a Company Administrator or workspace administrator gives you a role on them."
          }
          action={canCreateContracts ? newContractLink : undefined}
        />
      )}
    </div>
  );
}

/** The register's columns, for its loading skeleton. */
const REGISTER_COLUMNS = [
  "Contract",
  "Counterparty",
  "Value",
  "Status",
  "Start date",
  "End date",
  "",
] as const;

/**
 * A contract's secondary actions: the sections every reader of a listed
 * contract may open. Restricted sections and lifecycle actions stay on the
 * contract, where the API's permissions decide what is offered.
 */
function ContractRowActions({ contract }: { contract: ContractListItem }) {
  return (
    <DataTableRowActions
      label={`Actions for ${contract.referenceNumber} · ${contract.title}`}
    >
      <DropdownMenuLinkItem
        render={<Link href={contractSectionHref(contract.id, "overview")} />}
      >
        View contract
      </DropdownMenuLinkItem>
      <DropdownMenuLinkItem
        render={<Link href={contractSectionHref(contract.id, "parties")} />}
      >
        View parties
      </DropdownMenuLinkItem>
      <DropdownMenuLinkItem
        render={<Link href={contractSectionHref(contract.id, "history")} />}
      >
        View status history
      </DropdownMenuLinkItem>
    </DataTableRowActions>
  );
}

/**
 * The other companies party to the contract, with their role. The API lists
 * them under the same rule as the contract's Parties section, and not for
 * archived contracts.
 */
export function Counterparties({ contract }: { contract: ContractListItem }) {
  const counterparties = contract.counterparties ?? [];
  if (contract.deletedAt) {
    return <span className="text-muted-foreground">Not shown</span>;
  }
  if (!counterparties.length) {
    return <span className="text-muted-foreground">None yet</span>;
  }
  return (
    <ul className="space-y-0.5">
      {counterparties.map((party, index) => (
        <li
          key={`${party.companyName}-${party.partyType}-${index}`}
          className="break-words"
        >
          {party.companyName}{" "}
          <span className="text-xs text-muted-foreground">
            ({humanizeEnumValue(party.partyType)})
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The contract's title, linking to its detail page. An archived contract
 * opens read-only; only its creating company's administrators list it.
 */
function ContractTitle({ contract }: { contract: Contract }) {
  return (
    <Link
      className="font-medium break-words text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
      href={contractSectionHref(contract.id, "overview")}
    >
      {contract.title}
    </Link>
  );
}

export function ContractDetail({
  companyId,
  contractId,
  section,
  viewer,
}: {
  companyId: string;
  contractId: string;
  section: ContractSection;
  /** The signed-in member, so the activity timeline can say "You". */
  viewer?: { membershipId: string; companyName: string };
}) {
  const searchParams = useSearchParams();
  const target = parseActivityTarget(searchParams);
  // "Assign member" links open the Roles section on one workspace.
  const rolesWorkspace = parseContractWorkspace(
    searchParams?.get("workspace") ?? "",
  );
  const query = { companyId, contractId };
  const timeZone = useUserTimeZone();
  const {
    detail,
    error: contractError,
    isLoading: contractLoading,
    refetch: refetchContract,
    parties,
    partiesError,
    partiesLoading,
    refetchParties,
    history,
    historyError,
    historyLoading,
    historyFetching,
    refetchHistory,
    setHistoryPage,
    setHistoryPageSize,
  } = useContractDetails(query);
  const access = useContractSectionAccess({
    companyId,
    contractId,
    contract: detail?.contract,
  });

  if (contractLoading) {
    return (
      <p
        role="status"
        className="py-12 text-center text-sm text-muted-foreground"
      >
        Loading contract…
      </p>
    );
  }

  if (contractError || !detail) {
    // Not found also covers "not visible to you"; retrying can't change that.
    const notFound = getApiErrorStatus(contractError) === 404;
    return (
      <div className="space-y-4">
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/dashboards/contracts"
        >
          Back to contracts
        </Link>
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {notFound
                ? `Contract was not found. ${CONTRACT_UNAVAILABLE_TEXT}`
                : getApiErrorMessage(
                    contractError,
                    "Unable to load this contract.",
                  )}
            </span>
            {contractError && !notFound ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetchContract()}
              >
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const contract = detail.contract;
  return (
    <div className="space-y-6">
      <div>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/dashboards/contracts"
        >
          Back to contracts
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {contract.referenceNumber} ·{" "}
              {humanizeEnumValue(contract.contractType)}
            </p>
            <h1 className="mt-1 type-page-title break-words">
              {contract.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {contract.deletedAt ? (
              <StatusBadge status={ARCHIVED_STATUS} />
            ) : null}
            <StatusBadge status={contract.status} />
          </div>
        </div>
        {contract.description ? (
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            {contract.description}
          </p>
        ) : null}
        {contract.parentContractId ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Subcontract of{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={`/dashboards/contracts/${encodeURIComponent(contract.parentContractId)}`}
            >
              the parent contract
            </Link>
          </p>
        ) : null}
      </div>

      <ArchivedContractNotice companyId={companyId} contract={contract} />

      <ContractSectionNav
        contractId={contractId}
        current={section}
        access={access}
      />

      {section === "overview" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Contract details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailValue
                label="Your party"
                value={humanizeEnumValue(detail.membership.partyType)}
              />
              <DetailValue
                label="Original value"
                value={formatMoneyMinor(
                  contract.originalValueMinor,
                  contract.currencyCode,
                )}
              />
              <DetailValue
                label="Current value"
                value={formatMoneyMinor(
                  contract.currentValueMinor,
                  contract.currencyCode,
                )}
              />
              <DetailValue
                label="Award date"
                value={formatCalendarDate(contract.awardDate)}
              />
              <DetailValue
                label="Start date"
                value={formatCalendarDate(contract.startDate)}
              />
              <DetailValue
                label={
                  contract.revisedEndDate ? "Revised end date" : "End date"
                }
                value={formatCalendarDate(
                  contract.revisedEndDate || contract.endDate,
                )}
              />
            </CardContent>
          </Card>
          {/* Archiving revoked every role: nobody can enter a workspace. */}
          {contract.deletedAt ? null : (
            <ContractWorkspacesCard
              companyId={companyId}
              contractId={contractId}
              canAssignRoles={access.roles === true}
            />
          )}
          <ContractWorkspaceManagement
            companyId={companyId}
            contractId={contractId}
            contractReference={contract.referenceNumber}
          />
          <ContractLifecycleManagement
            companyId={companyId}
            contract={contract}
            part="manage"
          />
        </>
      ) : null}

      {section === "parties" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Contract parties</h2>
              </CardTitle>
              <CardDescription>
                Companies recorded as parties to this contract.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partiesError ? (
                <DataTableError
                  message={getApiErrorMessage(
                    partiesError,
                    "Unable to load contract parties.",
                  )}
                  onRetry={() => void refetchParties()}
                />
              ) : partiesLoading ? (
                <DataTableSkeleton
                  label="Loading parties…"
                  columns={["Company", "Party type", "Signed"]}
                  rows={3}
                />
              ) : parties?.length ? (
                <DataTable label="Contract parties">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Company</TableHead>
                      <TableHead>Party type</TableHead>
                      <TableHead>Signed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parties.map((party) => (
                      <TableRow key={party.id}>
                        <TableCell className="min-w-40 whitespace-normal break-words">
                          {party.companyName}
                        </TableCell>
                        <TableCell>
                          {humanizeEnumValue(party.partyType)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {/* Recorded as a signing date, so shown as one. */}
                          {formatCalendarDate(party.signedAt, {
                            fallback: "Not signed",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              ) : (
                <DataTableEmpty title="No party details are available." />
              )}
            </CardContent>
          </Card>
          <ContractLifecycleManagement
            companyId={companyId}
            contract={contract}
            part="invitations"
            target={target}
          />
        </>
      ) : null}

      {isRestrictedContractSection(section) ? (
        <RestrictedSection
          allowed={access[section]}
          overviewHref={contractSectionHref(contractId, "overview")}
        >
          {section === "roles" ? (
            <ContractRoleAssignmentManagement
              companyId={companyId}
              contractId={contractId}
              initialWorkspace={rolesWorkspace ?? undefined}
              target={target}
            />
          ) : section === "sites" ? (
            <ContractSiteManagement
              companyId={companyId}
              contract={contract}
              target={target}
            />
          ) : (
            <ContractSignatoryManagement
              companyId={companyId}
              contract={contract}
              target={target}
            />
          )}
        </RestrictedSection>
      ) : null}

      {section === "documents" ? (
        <ContractDocuments
          companyId={companyId}
          contract={contract}
          target={target}
        />
      ) : null}

      {section === "history" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Status history</h2>
            </CardTitle>
            <CardDescription>Recent recorded status changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyError ? (
              <DataTableError
                message={getApiErrorMessage(
                  historyError,
                  "Unable to load status history.",
                )}
                onRetry={() => void refetchHistory()}
              />
            ) : historyLoading ? (
              <DataTableSkeleton
                label="Loading status history…"
                columns={["Changed", "From", "To", "Reason"]}
                rows={3}
              />
            ) : history?.data.length ? (
              <div className="space-y-4">
                <DataTable label="Status history">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Changed</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="tabular-nums">
                          <time dateTime={entry.changedAt}>
                            {formatDateTime(entry.changedAt, { timeZone })}
                          </time>
                        </TableCell>
                        <TableCell>
                          {entry.fromStatus ? (
                            <StatusBadge status={entry.fromStatus} />
                          ) : (
                            EMPTY_VALUE
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.toStatus} />
                        </TableCell>
                        <TableCell className="min-w-48 whitespace-normal break-words">
                          {entry.reason || EMPTY_VALUE}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
                <DataPagination
                  meta={history.meta}
                  itemLabel="status changes"
                  isFetching={historyFetching}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={setHistoryPageSize}
                />
              </div>
            ) : (
              <DataTableEmpty title="No status changes have been recorded." />
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* A separate request: each section still works if the other fails. */}
      {section === "history" ? (
        <ContractActivity
          companyId={companyId}
          contractId={contractId}
          viewer={viewer}
          sectionAccess={access}
        />
      ) : null}
    </div>
  );
}

/**
 * A section only some users can use. While the server permissions load it
 * says so; without permission it explains instead of showing an empty page.
 * The API enforces access either way.
 */
function RestrictedSection({
  allowed,
  overviewHref,
  children,
}: {
  allowed: boolean | undefined;
  overviewHref: string;
  children: ReactNode;
}) {
  if (allowed === undefined) {
    return (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Checking your access…
      </p>
    );
  }
  if (!allowed) {
    return (
      <Alert>
        <AlertDescription className="space-y-2">
          <p>
            This section isn&apos;t available to you on this contract. It is
            shown to people who can manage it for their company.
          </p>
          <Link
            className="text-sm text-primary underline-offset-4 hover:underline"
            href={overviewHref}
          >
            Back to the contract overview
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  return children;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-words tabular-nums">
        {value || EMPTY_VALUE}
      </p>
    </div>
  );
}
