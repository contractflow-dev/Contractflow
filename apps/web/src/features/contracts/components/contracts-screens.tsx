"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { ContractLifecycleManagement } from "./contract-lifecycle-management";
import { EContractStatus } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { DataPagination } from "@/components/pagination/data-pagination";
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
import { getApiErrorMessage } from "@/lib/apiError";
import {
  EMPTY_VALUE,
  formatCalendarDate,
  formatDateTime,
  formatMoneyMinor,
  humanizeEnumValue,
} from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { CreateContractForm } from "./create-contract-form";
import {
  useRestoreContractMutation,
  type Contract,
  type ContractListItem,
} from "@/services/contractApi";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";
import { ContractSignatoryManagement } from "./contract-signatory-management";
import { ContractSiteManagement } from "./contract-site-management";
import { useContractDetails } from "../_hooks/use-contract-details";
import { useContractSectionAccess } from "../_hooks/use-contract-section-access";
import {
  contractSectionHref,
  isRestrictedContractSection,
  type ContractSection,
} from "../contract-sections";
import { ContractSectionNav } from "./contract-section-nav";
import {
  contractSortOptions,
  useContractsList,
} from "../_hooks/use-contracts-list";

const contractStatuses = Object.values(EContractStatus);

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
    status,
    setStatus,
    includeDeleted,
    setIncludeDeleted,
    sort,
    setSort,
    setPage,
    setLimit,
    currentData,
    error,
    isFetching,
    isLoading,
    refetch,
    submitSearch,
    hasFilters,
    clearFilters,
  } = useContractsList(companyId, { canViewArchived });
  const includeArchivedId = useId();
  const initialLoading = isLoading || (isFetching && !currentData);
  const contracts = currentData?.data ?? [];
  const showActions = includeDeleted;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Contracts your company is a party to. Open one to see its parties, roles, sites and history."
      />
      <CreateContractForm
        companyId={companyId}
        canCreate={canCreateContracts}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Contract register</h2>
          </CardTitle>
          <CardDescription>
            Search by title or reference, filter by status, and choose the
            order. Results update as you type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            role="search"
            aria-label="Contracts"
            onSubmit={submitSearch}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_14rem]"
          >
            <Field className="sm:col-span-2 lg:col-span-1">
              <FieldLabel htmlFor="contract-search">
                Search contracts
              </FieldLabel>
              <Input
                id="contract-search"
                type="search"
                value={searchInput}
                maxLength={100}
                placeholder="Title or reference"
                autoComplete="off"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contract-status">Status</FieldLabel>
              <NativeSelect
                id="contract-status"
                className="w-full"
                value={status}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatus(
                    contractStatuses.find((candidate) => candidate === value) ??
                      "",
                  );
                }}
              >
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                {contractStatuses.map((contractStatus) => (
                  <NativeSelectOption
                    key={contractStatus}
                    value={contractStatus}
                  >
                    {humanizeEnumValue(contractStatus)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="contract-sort">Sort by</FieldLabel>
              <NativeSelect
                id="contract-sort"
                className="w-full"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {contractSortOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* The API lists archived contracts only to company administrators,
                and returns only the archived contracts this company created. */}
            {canViewArchived ? (
              <Field orientation="horizontal" className="w-fit">
                <Checkbox
                  id={includeArchivedId}
                  checked={includeDeleted}
                  onCheckedChange={setIncludeDeleted}
                />
                <FieldLabel htmlFor={includeArchivedId} className="font-normal">
                  Show archived contracts only
                </FieldLabel>
              </Field>
            ) : (
              <span />
            )}
            {hasFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <StatusLegendDisclosure
            label="What do contract statuses mean?"
            items={
              includeDeleted
                ? [...contractStatusLegend, archivedStatusLegend]
                : contractStatusLegend
            }
          />

          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {getApiErrorMessage(error, "Unable to load contracts.")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {initialLoading ? (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Loading contracts…
            </p>
          ) : contracts.length ? (
            <>
              {/* Narrow screens: one card per contract instead of a wide table. */}
              <ul className="divide-y rounded-2xl border md:hidden">
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
                      <StatusBadge
                        status={
                          contract.deletedAt ? ARCHIVED_STATUS : contract.status
                        }
                      />
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
                    {showActions && contract.deletedAt ? (
                      <RestoreContractButton
                        companyId={companyId}
                        contractId={contract.id}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-end">Value</TableHead>
                      <TableHead>Start date</TableHead>
                      <TableHead>End date</TableHead>
                      {showActions ? <TableHead>Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="min-w-56 whitespace-normal">
                          <ContractTitle contract={contract} />
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {contract.referenceNumber}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-44 whitespace-normal">
                          <Counterparties contract={contract} />
                        </TableCell>
                        <TableCell>
                          {humanizeEnumValue(contract.contractType)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={
                              contract.deletedAt
                                ? ARCHIVED_STATUS
                                : contract.status
                            }
                          />
                        </TableCell>
                        <TableCell className="text-end whitespace-nowrap tabular-nums">
                          {formatMoneyMinor(
                            contract.currentValueMinor,
                            contract.currencyCode,
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatCalendarDate(contract.startDate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatCalendarDate(
                            contract.revisedEndDate || contract.endDate,
                          )}
                        </TableCell>
                        {showActions ? (
                          <TableCell>
                            {contract.deletedAt ? (
                              <RestoreContractButton
                                companyId={companyId}
                                contractId={contract.id}
                              />
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : !error ? (
            <div className="space-y-3 py-8 text-center">
              {hasFilters ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    No contracts match your search or filters.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No contracts yet. Contracts your company creates, or joins
                  when invited, will appear here.
                </p>
              )}
            </div>
          ) : null}

          {currentData && contracts.length ? (
            <DataPagination
              className="border-t pt-4"
              meta={currentData.meta}
              itemLabel="contracts"
              isFetching={isFetching}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
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
 * The contract's title, linking to its detail page. Archived contracts can't
 * be opened, so their title is plain text.
 */
function ContractTitle({ contract }: { contract: Contract }) {
  if (contract.deletedAt) {
    return <p className="font-medium break-words">{contract.title}</p>;
  }
  return (
    <Link
      className="font-medium break-words text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
      href={contractSectionHref(contract.id, "overview")}
    >
      {contract.title}
    </Link>
  );
}

function RestoreContractButton({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const [restore, state] = useRestoreContractMutation();

  async function restoreContract() {
    const result = await restore({ companyId, contractId });
    if (!("error" in result)) {
      notifySuccess(
        "Contract restored",
        "It is back in the contract register. Assign roles again to give members access.",
      );
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state.isLoading}
        aria-busy={state.isLoading || undefined}
        onClick={() => void restoreContract()}
      >
        {state.isLoading ? "Restoring…" : "Restore"}
      </Button>
      {state.error ? (
        <p className="max-w-48 text-xs text-destructive">
          {getApiErrorMessage(state.error, "Unable to restore contract.")}
        </p>
      ) : null}
    </div>
  );
}

export function ContractDetail({
  companyId,
  contractId,
  section,
}: {
  companyId: string;
  contractId: string;
  section: ContractSection;
}) {
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
    history,
    historyError,
    historyLoading,
    historyFetching,
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
              {getApiErrorMessage(
                contractError,
                "Unable to load this contract.",
              )}
            </span>
            {contractError ? (
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
          <StatusBadge status={contract.status} />
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
                <Alert variant="destructive">
                  <AlertDescription>
                    {getApiErrorMessage(
                      partiesError,
                      "Unable to load contract parties.",
                    )}
                  </AlertDescription>
                </Alert>
              ) : partiesLoading ? (
                <p role="status" className="py-4 text-sm text-muted-foreground">
                  Loading parties…
                </p>
              ) : parties?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Party type</TableHead>
                      <TableHead>Signed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parties.map((party) => (
                      <TableRow key={party.id}>
                        <TableCell>{party.companyName}</TableCell>
                        <TableCell>
                          {humanizeEnumValue(party.partyType)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {/* Recorded as a signing date, so shown as one. */}
                          {formatCalendarDate(party.signedAt, {
                            fallback: "Not signed",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No party details are available.
                </p>
              )}
            </CardContent>
          </Card>
          <ContractLifecycleManagement
            companyId={companyId}
            contract={contract}
            part="invitations"
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
            />
          ) : section === "sites" ? (
            <ContractSiteManagement companyId={companyId} contract={contract} />
          ) : (
            <ContractSignatoryManagement
              companyId={companyId}
              contract={contract}
            />
          )}
        </RestrictedSection>
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
              <Alert variant="destructive">
                <AlertDescription>
                  {getApiErrorMessage(
                    historyError,
                    "Unable to load status history.",
                  )}
                </AlertDescription>
              </Alert>
            ) : historyLoading ? (
              <p role="status" className="py-4 text-sm text-muted-foreground">
                Loading status history…
              </p>
            ) : history?.data.length ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Changed</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
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
                </Table>
                <DataPagination
                  meta={history.meta}
                  itemLabel="status changes"
                  isFetching={historyFetching}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={setHistoryPageSize}
                />
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                No status changes have been recorded.
              </p>
            )}
          </CardContent>
        </Card>
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
