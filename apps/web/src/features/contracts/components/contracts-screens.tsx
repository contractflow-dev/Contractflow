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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { ListCard } from "@/components/data-table/list-card";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import {
  DataTableSearch,
  DataTableToolbar,
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
  todayAsCalendarDate,
} from "@/lib/format";
import type {
  Contract,
  ContractListItem,
  ContractPartySummary,
  ContractStatusHistory,
} from "@/services/contractApi";
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
import { ContractActivity } from "./contract-activity";
import {
  ParentContractLine,
  SubcontractNote,
  SubcontractsSection,
} from "./related-contracts";
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
  const sortId = useId();
  const initialLoading = isLoading || (isFetching && !currentData);
  const contracts = currentData?.data ?? [];
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
      {/* Only the page title sits above the register; everything about the
          register, its description and action included, is in its card. */}
      <PageHeader title="Contract Register" />

      <ListCard
        title="Contracts"
        description={
          canCreateContracts
            ? "Manage and monitor the contracts your company is a party to. Open one to see its parties, roles, sites and history."
            : "Contracts you hold a role on. Open one to see its parties and history, and your workspaces."
        }
        action={canCreateContracts ? newContractLink : null}
      >
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
            <DataTableFilters
              label="contracts"
              fields={[
                {
                  kind: "select",
                  id: "status",
                  label: "Status",
                  value: status,
                  options: CONTRACT_STATUS_FILTERS.map((value) => ({
                    value,
                    label: value ? humanizeEnumValue(value) : "All contracts",
                    count: counts[value],
                  })),
                },
                ...(canViewArchived
                  ? [
                      {
                        kind: "checkbox" as const,
                        id: "archived",
                        label: "Show archived contracts only",
                        checked: includeDeleted,
                      },
                    ]
                  : []),
              ]}
              onApply={(next) => {
                setStatus(next.status as typeof status);
                if (canViewArchived) {
                  setIncludeDeleted(next.archived === "true");
                }
              }}
            />
          </DataTableToolbar>
        </div>

        <DataTable
          label="Contracts"
          columns={REGISTER_COLUMNS}
          rows={contracts}
          getRowKey={(contract) => contract.id}
          sort={{
            columnId: registerSortColumn(sortBy),
            direction: sortOrder === ESortOrder.ASC ? "asc" : "desc",
            onSort: (columnId) => {
              const field = REGISTER_SORT_FIELDS[columnId];
              if (field) toggleSort(field);
            },
          }}
          rowActions={(contract) => (
            <>
              {/* Restoring is the archived contract's main action, so it stays
                in the row rather than in the menu. */}
              {contract.deletedAt ? (
                <RestoreContractButton
                  companyId={companyId}
                  contract={contract}
                />
              ) : null}
              <ContractRowActions contract={contract} />
            </>
          )}
          renderCard={(contract) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ContractTitle contract={contract} />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {contract.referenceNumber} ·{" "}
                    {humanizeEnumValue(contract.contractType)}
                    <SubcontractNote contract={contract} />
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
            </>
          )}
          isLoading={initialLoading}
          loadingLabel="Loading contracts…"
          error={
            error
              ? getApiErrorMessage(error, "Unable to load contracts.")
              : null
          }
          onRetry={() => void refetch()}
          empty={registerEmptyState()}
          pagination={
            currentData
              ? {
                  meta: currentData.meta,
                  itemLabel: "contracts",
                  isFetching,
                  onPageChange: setPage,
                  onPageSizeChange: setLimit,
                }
              : undefined
          }
        />
      </ListCard>
    </div>
  );

  /**
   * Says why the register is empty: nothing exists yet, or nothing matches
   * the search, the status filter or the archived filter, each with the
   * action that undoes it.
   */
  function registerEmptyState() {
    if (!hasFilters) {
      return (
        <DataTableEmpty
          title="No contracts yet."
          description={
            canCreateContracts
              ? "Contracts your company creates, or joins when invited, will appear here."
              : "Contracts appear here once a Company Administrator or workspace administrator gives you a role on them."
          }
          action={canCreateContracts ? newContractLink : undefined}
        />
      );
    }
    if (search) {
      const otherFilters = Boolean(status || includeDeleted);
      return (
        <DataTableEmpty
          title={`No contracts match “${search}”.`}
          description={
            otherFilters
              ? "Nothing matches this search with the filters you've chosen. Try another search, or clear the filters."
              : "Try searching for another title or reference."
          }
          action={
            <Button
              type="button"
              variant="outline"
              onClick={otherFilters ? clearFilters : clearSearch}
            >
              {otherFilters ? "Clear filters" : "Clear search"}
            </Button>
          }
        />
      );
    }
    if (status) {
      return (
        <DataTableEmpty
          title={`No ${humanizeEnumValue(status).toLowerCase()} contracts.`}
          description={
            includeDeleted
              ? "None of the archived contracts has this status."
              : "No contracts you can see have this status."
          }
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatus("")}
            >
              Show all contracts
            </Button>
          }
        />
      );
    }
    return (
      <DataTableEmpty
        title="No archived contracts."
        description="Contracts your company created and then archived appear here."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setIncludeDeleted(false)}
          >
            Show contracts in use
          </Button>
        }
      />
    );
  }
}

/** The register's sortable columns and the API field each sorts by. */
const REGISTER_SORT_FIELDS: Record<string, EContractSortField> = {
  contract: EContractSortField.TITLE,
  status: EContractSortField.STATUS,
  startDate: EContractSortField.START_DATE,
  endDate: EContractSortField.END_DATE,
};

/** The column the register is sorted by, if it is one of its columns. */
function registerSortColumn(sortBy: EContractSortField): string | null {
  return (
    Object.keys(REGISTER_SORT_FIELDS).find(
      (columnId) => REGISTER_SORT_FIELDS[columnId] === sortBy,
    ) ?? null
  );
}

/** A contract's parties: the companies recorded on it, and when they signed. */
const PARTY_COLUMNS: ReadonlyArray<DataTableColumn<ContractPartySummary>> = [
  {
    id: "company",
    header: "Company",
    wrap: true,
    className: "min-w-40",
    cell: (party) => party.companyName,
  },
  {
    id: "partyType",
    header: "Party type",
    cell: (party) => humanizeEnumValue(party.partyType),
  },
  {
    id: "signed",
    header: "Signed",
    className: "tabular-nums",
    // Recorded as a signing date, so shown as one.
    cell: (party) =>
      formatCalendarDate(party.signedAt, { fallback: "Not signed" }),
  },
];

/**
 * The status history's predefined filters: every contract status, matching
 * changes to or from it (the API's rule). "" is all changes.
 */
const STATUS_HISTORY_FILTERS = [
  "",
  EContractStatus.DRAFT,
  EContractStatus.ACTIVE,
  EContractStatus.SUSPENDED,
  EContractStatus.COMPLETED,
] as const;

/** A contract's status changes, with times in the viewer's time zone. */
function historyColumns(
  timeZone: string | undefined,
): ReadonlyArray<DataTableColumn<ContractStatusHistory>> {
  return [
    {
      id: "changed",
      header: "Changed",
      className: "tabular-nums",
      cell: (entry) => (
        <time dateTime={entry.changedAt}>
          {formatDateTime(entry.changedAt, { timeZone })}
        </time>
      ),
    },
    {
      id: "from",
      header: "From",
      cell: (entry) =>
        entry.fromStatus ? (
          <StatusBadge status={entry.fromStatus} />
        ) : (
          EMPTY_VALUE
        ),
    },
    {
      id: "to",
      header: "To",
      cell: (entry) => <StatusBadge status={entry.toStatus} />,
    },
    {
      id: "reason",
      header: "Reason",
      wrap: true,
      className: "min-w-48",
      cell: (entry) => entry.reason || EMPTY_VALUE,
    },
  ];
}

/** The register's columns, from the contract list API's fields. */
const REGISTER_COLUMNS: ReadonlyArray<DataTableColumn<ContractListItem>> = [
  {
    id: "contract",
    header: "Contract",
    sortable: true,
    wrap: true,
    className: "min-w-56",
    cell: (contract) => (
      <>
        <ContractTitle contract={contract} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {contract.referenceNumber} ·{" "}
          {humanizeEnumValue(contract.contractType)}
          <SubcontractNote contract={contract} />
        </p>
      </>
    ),
  },
  {
    id: "counterparty",
    header: "Counterparty",
    wrap: true,
    className: "min-w-44",
    cell: (contract) => <Counterparties contract={contract} />,
  },
  {
    id: "value",
    header: "Value",
    numeric: true,
    cell: (contract) =>
      formatMoneyMinor(contract.currentValueMinor, contract.currencyCode),
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    cell: (contract) => (
      <StatusBadge
        status={contract.deletedAt ? ARCHIVED_STATUS : contract.status}
      />
    ),
  },
  {
    id: "startDate",
    header: "Start date",
    sortable: true,
    className: "tabular-nums",
    cell: (contract) => formatCalendarDate(contract.startDate),
  },
  {
    id: "endDate",
    header: "End date",
    sortable: true,
    className: "tabular-nums",
    cell: (contract) =>
      formatCalendarDate(contract.revisedEndDate || contract.endDate),
  },
];

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
    historyFilters,
    setHistoryFilters,
    clearHistoryFilters,
  } = useContractDetails(query, { timeZone });
  const historyFiltered = Boolean(
    historyFilters.status || historyFilters.fromDay || historyFilters.toDay,
  );
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
        <ParentContractLine
          parentContractId={contract.parentContractId}
          parentContract={detail.parentContract ?? null}
        />
      </div>

      <ArchivedContractNotice companyId={companyId} contract={contract} />

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
              isSubcontract={Boolean(contract.parentContractId)}
            />
          )}
          <SubcontractsSection
            companyId={companyId}
            contractId={contractId}
            subcontracts={detail.subcontracts ?? []}
          />
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
          <ListCard
            title="Contract parties"
            description="Companies recorded as parties to this contract."
          >
            <DataTable
              label="Contract parties"
              columns={PARTY_COLUMNS}
              rows={parties ?? []}
              getRowKey={(party) => party.id}
              isLoading={partiesLoading}
              loadingLabel="Loading parties…"
              skeletonRows={3}
              error={
                partiesError
                  ? getApiErrorMessage(
                      partiesError,
                      "Unable to load contract parties.",
                    )
                  : null
              }
              onRetry={() => void refetchParties()}
              empty={<DataTableEmpty title="No party details are available." />}
            />
          </ListCard>
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
              contractLabel={`${contract.referenceNumber} · ${contract.title}`}
              isSubcontract={Boolean(contract.parentContractId)}
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
        <ListCard
          title="Status history"
          description="Recorded status changes, newest first. Filter by a status the contract moved to or from, or by when it changed."
        >
          <DataTableToolbar>
            <DataTableFilters
              label="status history"
              fields={[
                {
                  kind: "select",
                  id: "status",
                  label: "Status",
                  value: historyFilters.status,
                  options: STATUS_HISTORY_FILTERS.map((value) => ({
                    value,
                    label: value ? humanizeEnumValue(value) : "All changes",
                  })),
                },
                {
                  kind: "dateRange",
                  id: "changed",
                  label: "Changed between",
                  from: historyFilters.fromDay,
                  to: historyFilters.toDay,
                  max: todayAsCalendarDate(),
                },
              ]}
              onApply={(next) =>
                setHistoryFilters({
                  status: next.status as typeof historyFilters.status,
                  fromDay: next["changed.from"],
                  toDay: next["changed.to"],
                })
              }
            />
          </DataTableToolbar>
          <DataTable
            label="Status history"
            columns={historyColumns(timeZone)}
            rows={history?.data ?? []}
            getRowKey={(entry) => entry.id}
            isLoading={historyLoading}
            loadingLabel="Loading status history…"
            skeletonRows={3}
            error={
              historyError
                ? getApiErrorMessage(
                    historyError,
                    "Unable to load status history.",
                  )
                : null
            }
            onRetry={() => void refetchHistory()}
            empty={
              historyFiltered ? (
                <DataTableEmpty
                  title="No status changes match these filters."
                  description="Try another status or dates, or clear the filters to see every change."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearHistoryFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <DataTableEmpty title="No status changes have been recorded." />
              )
            }
            pagination={
              history
                ? {
                    meta: history.meta,
                    itemLabel: "status changes",
                    isFetching: historyFetching,
                    onPageChange: setHistoryPage,
                    onPageSizeChange: setHistoryPageSize,
                  }
                : undefined
            }
          />
        </ListCard>
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
