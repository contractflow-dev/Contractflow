"use client";

import Link from "next/link";
import { EContractStatus } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataPagination } from "@/components/pagination/data-pagination";
import { PageHeader } from "@/components/page-header/page-header";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  formatCalendarDate,
  formatMoneyMinor,
  humanizeEnumValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContractListItem } from "@/services/contractApi";
import { contractSectionHref } from "../contract-sections";
import { useContractsList } from "../_hooks/use-contracts-list";
import { Counterparties } from "./contracts-screens";

const contractStatuses = Object.values(EContractStatus);

/**
 * The signed-in user's own contracts: those they hold an active role on in
 * this company. The server decides which those are (`assignedToMe`); being
 * a company administrator adds nothing here.
 */
export function MyContracts({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const {
    searchInput,
    setSearchInput,
    status,
    setStatus,
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
  } = useContractsList(companyId, {
    canViewArchived: false,
    assignedToMe: true,
  });
  const initialLoading = isLoading || (isFetching && !currentData);
  const contracts = currentData?.data ?? [];
  const total = currentData?.meta.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Contracts"
        description="View and manage the contracts assigned to you."
      />

      <section aria-labelledby="my-contracts-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="my-contracts-heading" className="text-base font-semibold">
            Your contract roles in {companyName}
          </h2>
          {currentData && !hasFilters && total > 0 ? (
            <p className="text-sm text-muted-foreground">
              You hold a role on {total} contract{total === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        <form
          role="search"
          aria-label="My contracts"
          onSubmit={submitSearch}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end"
        >
          <Field>
            <FieldLabel htmlFor="my-contract-search">Search my contracts</FieldLabel>
            <Input
              id="my-contract-search"
              type="search"
              value={searchInput}
              maxLength={100}
              placeholder="Title or reference"
              autoComplete="off"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="my-contract-status">Status</FieldLabel>
            <NativeSelect
              id="my-contract-status"
              className="w-full"
              value={status}
              onChange={(event) => {
                const value = event.target.value;
                setStatus(
                  contractStatuses.find((candidate) => candidate === value) ?? "",
                );
              }}
            >
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              {contractStatuses.map((contractStatus) => (
                <NativeSelectOption key={contractStatus} value={contractStatus}>
                  {humanizeEnumValue(contractStatus)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </form>
        {hasFilters ? (
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(error, "Unable to load your contracts.")}
              </span>
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {initialLoading ? (
          <div role="status" aria-label="Loading your contracts" className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-3 rounded-2xl border p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
            <span className="sr-only">Loading your contracts…</span>
          </div>
        ) : contracts.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {contracts.map((contract) => (
              <MyContractCard key={contract.id} contract={contract} />
            ))}
          </ul>
        ) : !error ? (
          hasFilters ? (
            <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                None of your contracts match your search or filters.
              </p>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
              <h3 className="font-semibold">No contracts assigned to you yet</h3>
              <p className="mx-auto max-w-prose text-sm leading-6 text-muted-foreground">
                A contract appears here once you hold a role on it in{" "}
                {companyName}. Company Administrators assign contract roles, and
                role invitations arrive by email. Open the link in the email to
                accept one, or ask your Company Administrator for access.
              </p>
              <Link
                href="/dashboards/contracts"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View the company’s contracts
              </Link>
            </div>
          )
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
      </section>
    </div>
  );
}

function MyContractCard({ contract }: { contract: ContractListItem }) {
  const roles = contract.myRoles ?? [];
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={contractSectionHref(contract.id, "overview")}
            className="font-semibold break-words text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
          >
            {contract.title}
          </Link>
          <p className="mt-0.5 text-xs break-words text-muted-foreground">
            {contract.referenceNumber} · {humanizeEnumValue(contract.contractType)}
          </p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      {roles.length ? (
        <div>
          <p className="sr-only">Your roles</p>
          <ul aria-label="Your roles" className="flex flex-wrap gap-1.5">
            {roles.map((assignment) => (
              <li key={`${assignment.role}-${assignment.workspace}`}>
                <Badge variant="outline" className="h-auto whitespace-normal py-0.5 text-left">
                  {assignment.role} · {humanizeEnumValue(assignment.workspace)}
                  {assignment.isWorkspaceAdmin ? " · Workspace admin" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Counterparty</dt>
        <dd className="min-w-0 text-end">
          <Counterparties contract={contract} />
        </dd>
        <dt className="text-muted-foreground">Value</dt>
        <dd className="text-end tabular-nums">
          {formatMoneyMinor(contract.currentValueMinor, contract.currencyCode)}
        </dd>
        <dt className="text-muted-foreground">Dates</dt>
        <dd className="text-end">
          {formatCalendarDate(contract.startDate)} –{" "}
          {formatCalendarDate(contract.revisedEndDate || contract.endDate)}
        </dd>
      </dl>
    </li>
  );
}
