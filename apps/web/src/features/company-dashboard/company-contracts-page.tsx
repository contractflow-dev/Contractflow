"use client";

import { useState } from "react";
import Link from "next/link";
import { EContractStatus } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
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
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  useGetContractByIdQuery,
  useGetContractPartiesQuery,
  useGetContractsQuery,
  useGetContractStatusHistoryQuery,
} from "@/services/contractApi";

const pageSize = 20;
const contractStatuses = Object.values(EContractStatus);

export function CompanyContractsPage() {
  return (
    <CompanyAdminShell>
      {(access) => <ContractList companyId={access.company.id} />}
    </CompanyAdminShell>
  );
}

export function CompanyContractDetailPage({
  contractId,
}: {
  contractId: string;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractDetail companyId={access.company.id} contractId={contractId} />
      )}
    </CompanyAdminShell>
  );
}

function ContractList({ companyId }: { companyId: string }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EContractStatus | "">("");
  const [page, setPage] = useState(1);
  const {
    currentData,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetContractsQuery({
    companyId,
    search: search || undefined,
    status: status || undefined,
    page,
    limit: pageSize,
  });
  const pageCount = Math.max(1, Math.ceil((currentData?.total ?? 0) / pageSize));
  const initialLoading = isLoading || (isFetching && !currentData);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Contracts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contracts shared with this company.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contract register</CardTitle>
          <CardDescription>
            Search by contract title or reference and filter by status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={submitSearch}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
          >
            <Field>
              <FieldLabel htmlFor="contract-search">Search contracts</FieldLabel>
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
                  setPage(1);
                }}
              >
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                {contractStatuses.map((contractStatus) => (
                  <NativeSelectOption
                    key={contractStatus}
                    value={contractStatus}
                  >
                    {formatLabel(contractStatus)}
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

          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{getApiErrorMessage(error, "Unable to load contracts.")}</span>
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
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Loading contracts…
            </p>
          ) : currentData?.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>End date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.items.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/dashboards/contracts/${encodeURIComponent(contract.id)}?companyId=${encodeURIComponent(companyId)}`}
                      >
                        {contract.referenceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>{formatLabel(contract.contractType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatLabel(contract.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(contract.revisedEndDate || contract.endDate)}</TableCell>
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
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {currentData.total} contract{currentData.total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm tabular-nums">
                  Page {page} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= pageCount || isFetching}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractDetail({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const query = { companyId, contractId };
  const {
    currentData: detail,
    error: contractError,
    isLoading: contractLoading,
    refetch: refetchContract,
  } = useGetContractByIdQuery(query);
  const {
    currentData: parties,
    error: partiesError,
    isLoading: partiesLoading,
  } = useGetContractPartiesQuery(query);
  const {
    currentData: history,
    error: historyError,
    isLoading: historyLoading,
  } = useGetContractStatusHistoryQuery({ ...query, page: 1, limit: 50 });

  if (contractLoading) {
    return (
      <p role="status" className="py-12 text-center text-sm text-muted-foreground">
        Loading contract…
      </p>
    );
  }

  if (contractError || !detail) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href={`/dashboards/contracts?companyId=${encodeURIComponent(companyId)}`}
        >
          Back to contracts
        </Link>
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {getApiErrorMessage(contractError, "Unable to load this contract.")}
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
          href={`/dashboards/contracts?companyId=${encodeURIComponent(companyId)}`}
        >
          Back to contracts
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {contract.referenceNumber} · {formatLabel(contract.contractType)}
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {contract.title}
            </h2>
          </div>
          <Badge variant="outline">{formatLabel(contract.status)}</Badge>
        </div>
        {contract.description ? (
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            {contract.description}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contract details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailValue label="Your party" value={formatLabel(detail.membership.partyType)} />
          <DetailValue label="Award date" value={formatDate(contract.awardDate)} />
          <DetailValue label="Start date" value={formatDate(contract.startDate)} />
          <DetailValue
            label="End date"
            value={formatDate(contract.revisedEndDate || contract.endDate)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract parties</CardTitle>
          <CardDescription>Companies recorded as parties to this contract.</CardDescription>
        </CardHeader>
        <CardContent>
          {partiesError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(partiesError, "Unable to load contract parties.")}
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
                    <TableCell>{formatLabel(party.partyType)}</TableCell>
                    <TableCell>{party.signedAt ? formatDate(party.signedAt) : "Not signed"}</TableCell>
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
                {getApiErrorMessage(historyError, "Unable to load status history.")}
              </AlertDescription>
            </Alert>
          ) : historyLoading ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Loading status history…
            </p>
          ) : history?.items.length ? (
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
                {history.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.changedAt)}</TableCell>
                    <TableCell>{formatLabel(entry.fromStatus)}</TableCell>
                    <TableCell>{formatLabel(entry.toStatus)}</TableCell>
                    <TableCell>{entry.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
