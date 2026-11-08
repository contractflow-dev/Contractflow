"use client";

import Link from "next/link";
import { ContractLifecycleManagement } from "./contract-lifecycle-management";
import { EContractStatus } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
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
import { CreateContractForm } from "./contract-lifecycle-management";
import { useRestoreContractMutation } from "@/services/contractApi";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";
import { ContractSignatoryManagement } from "./contract-signatory-management";
import { ContractSiteManagement } from "./contract-site-management";
import { useContractDetails } from "../_hooks/use-contract-details";
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

export function ContractsList({ companyId }: { companyId: string }) {
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
  } = useContractsList(companyId);
  const initialLoading = isLoading || (isFetching && !currentData);

  return (
    <div className="space-y-6">
      <CreateContractForm companyId={companyId} />
      <header>
        <h2 className="type-page-title">Contracts</h2>
        <p className="mt-1 type-lead">Contracts shared with this company.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contract register</CardTitle>
          <CardDescription>
            Search by contract title or reference, filter by status, and choose
            the order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={submitSearch}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]"
          >
            <Field>
              <FieldLabel htmlFor="contract-search">
                Search contracts
              </FieldLabel>
              <Input
                id="contract-search"
                value={searchInput}
                maxLength={100}
                placeholder="Title or reference"
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
            <div className="flex items-end">
              <Button type="submit" disabled={isFetching}>
                Search
              </Button>
            </div>
          </form>
          <div className="space-y-1">
            <label className="flex min-h-7 w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeDeleted}
                onChange={(event) => setIncludeDeleted(event.target.checked)}
              />
              Include archived contracts
            </label>
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
          ) : currentData?.data.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>End date</TableHead>
                  {includeDeleted ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.data.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      {contract.deletedAt ? (
                        contract.referenceNumber
                      ) : (
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          href={`/dashboards/contracts/${encodeURIComponent(contract.id)}`}
                        >
                          {contract.referenceNumber}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>
                      {humanizeEnumValue(contract.contractType)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          contract.deletedAt ? ARCHIVED_STATUS : contract.status
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCalendarDate(
                        contract.revisedEndDate || contract.endDate,
                      )}
                    </TableCell>
                    {includeDeleted ? (
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
          ) : !error && !initialLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No contracts match these filters.
            </p>
          ) : null}

          {currentData ? (
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
}: {
  companyId: string;
  contractId: string;
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
            <h2 className="mt-1 type-page-title break-words">
              {contract.title}
            </h2>
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

      <Card>
        <CardHeader>
          <CardTitle>Contract details</CardTitle>
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
            label={contract.revisedEndDate ? "Revised end date" : "End date"}
            value={formatCalendarDate(
              contract.revisedEndDate || contract.endDate,
            )}
          />
        </CardContent>
      </Card>

      <ContractRoleAssignmentManagement
        companyId={companyId}
        contractId={contractId}
      />
      <ContractLifecycleManagement companyId={companyId} contract={contract} />
      <ContractSignatoryManagement companyId={companyId} contract={contract} />
      <ContractSiteManagement companyId={companyId} contract={contract} />

      <Card>
        <CardHeader>
          <CardTitle>Contract parties</CardTitle>
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
                    <TableCell>{humanizeEnumValue(party.partyType)}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
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
    </div>
  );
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
