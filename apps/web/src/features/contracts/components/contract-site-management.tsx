"use client";

import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import {
  EContractSiteStatus,
  ECountryCode,
} from "@contractflow/contracts-schema";
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
import { getApiErrorMessage } from "@/lib/apiError";
import {
  useCreateContractSiteMutation,
  useGetContractLifecyclePermissionsQuery,
  useGetManagedContractSitesQuery,
  useUpdateContractSiteMutation,
  type Contract,
  type ContractSite,
} from "@/services/contractApi";

const MICRO_DEGREES = 1_000_000;
const siteStatuses = Object.values(EContractSiteStatus);
const countryCodes = Object.values(ECountryCode).sort();

/** Converts decimal degrees to the integer micro-degrees the API stores. */
export function toMicroDegrees(value: string): number {
  return Math.round(Number(value) * MICRO_DEGREES);
}

export function fromMicroDegrees(value: number): string {
  return (value / MICRO_DEGREES).toFixed(6);
}

/**
 * Contract sites are set up by the creating company's Company Administrator
 * before any site log, inspection, or incident can reference them.
 */
export function ContractSiteManagement({
  companyId,
  contract,
}: {
  companyId: string;
  contract: Contract;
}) {
  const query = { companyId, contractId: contract.id };
  const permissionsQuery = useGetContractLifecyclePermissionsQuery(query);
  const canManage = Boolean(permissionsQuery.data?.canManage);
  const sitesQuery = useGetManagedContractSitesQuery(query, {
    skip: !canManage,
  });
  const [editing, setEditing] = useState<ContractSite | "new" | null>(null);

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Contract sites</CardTitle>
          <CardDescription>
            Sites must exist before site logs, inspections, or incidents can
            reference them.
          </CardDescription>
        </div>
        {editing === null ? (
          <Button type="button" onClick={() => setEditing("new")}>
            Add site
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {editing !== null ? (
          <SiteForm
            key={editing === "new" ? "new" : editing.id}
            companyId={companyId}
            contractId={contract.id}
            site={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}

        {sitesQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading sites…
          </p>
        ) : sitesQuery.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(
                  sitesQuery.error,
                  "Unable to load contract sites.",
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void sitesQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : sitesQuery.currentData?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sitesQuery.currentData.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <span className="block font-medium">{site.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {site.siteCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      {site.addressLine1}, {site.city}, {site.stateRegion},{" "}
                      {site.countryCode}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {fromMicroDegrees(site.latitudeE6)},{" "}
                      {fromMicroDegrees(site.longitudeE6)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatLabel(site.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Edit site ${site.name}`}
                        onClick={() => setEditing(site)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No sites have been added to this contract.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SiteForm({
  companyId,
  contractId,
  site,
  onDone,
}: {
  companyId: string;
  contractId: string;
  site: ContractSite | null;
  onDone: () => void;
}) {
  const [createSite, createState] = useCreateContractSiteMutation();
  const [updateSite, updateState] = useUpdateContractSiteMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const error = site ? updateState.error : createState.error;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? "").trim(),
      siteCode: String(form.get("siteCode") ?? "").trim(),
      addressLine1: String(form.get("addressLine1") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      stateRegion: String(form.get("stateRegion") ?? "").trim(),
      countryCode: String(form.get("countryCode") ?? "") as ECountryCode,
      latitudeE6: toMicroDegrees(String(form.get("latitude") ?? "")),
      longitudeE6: toMicroDegrees(String(form.get("longitude") ?? "")),
      status: String(form.get("status")) as EContractSiteStatus,
    };
    const result = site
      ? await updateSite({ companyId, contractId, siteId: site.id, body })
      : await createSite({ companyId, contractId, body });
    if (!("error" in result)) onDone();
  }

  const idPrefix = site ? `site-${site.id}` : "site-new";
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border p-4"
      aria-label={site ? `Edit site ${site.name}` : "Add a site"}
    >
      <h3 className="text-sm font-semibold">
        {site ? `Edit ${site.name}` : "New site"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SiteInput
          id={`${idPrefix}-name`}
          name="name"
          label="Site name"
          defaultValue={site?.name}
          maxLength={255}
        />
        <SiteInput
          id={`${idPrefix}-code`}
          name="siteCode"
          label="Site code"
          defaultValue={site?.siteCode}
          maxLength={40}
        />
        <SiteInput
          id={`${idPrefix}-address`}
          name="addressLine1"
          label="Address"
          defaultValue={site?.addressLine1}
          maxLength={255}
        />
        <SiteInput
          id={`${idPrefix}-city`}
          name="city"
          label="City"
          defaultValue={site?.city}
          maxLength={100}
        />
        <SiteInput
          id={`${idPrefix}-region`}
          name="stateRegion"
          label="State / region"
          defaultValue={site?.stateRegion}
          maxLength={100}
        />
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-country`}>Country</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-country`}
            name="countryCode"
            defaultValue={site?.countryCode ?? ""}
            required
          >
            <NativeSelectOption value="" disabled>
              Select a country
            </NativeSelectOption>
            {countryCodes.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <SiteInput
          id={`${idPrefix}-latitude`}
          name="latitude"
          label="Latitude (decimal degrees)"
          type="number"
          step="0.000001"
          min="-90"
          max="90"
          defaultValue={site ? fromMicroDegrees(site.latitudeE6) : undefined}
        />
        <SiteInput
          id={`${idPrefix}-longitude`}
          name="longitude"
          label="Longitude (decimal degrees)"
          type="number"
          step="0.000001"
          min="-180"
          max="180"
          defaultValue={site ? fromMicroDegrees(site.longitudeE6) : undefined}
        />
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-status`}>Status</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-status`}
            name="status"
            defaultValue={site?.status ?? EContractSiteStatus.PLANNED}
          >
            {siteStatuses.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {formatLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(error, "Unable to save the site.")}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : site ? "Save site" : "Add site"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SiteInput({
  id,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} required {...props} />
    </Field>
  );
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
