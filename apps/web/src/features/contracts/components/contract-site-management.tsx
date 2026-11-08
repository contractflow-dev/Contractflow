"use client";

import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import {
  EContractSiteStatus,
  ECountryCode,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
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
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { countryName, countryOptions } from "@/lib/countries";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
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
                      {countryName(site.countryCode)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {fromMicroDegrees(site.latitudeE6)},{" "}
                      {fromMicroDegrees(site.longitudeE6)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={site.status} />
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
    if (!("error" in result)) {
      notifySuccess(site ? "Site updated" : "Site added", body.name);
      onDone();
    }
  }

  const idPrefix = site ? `site-${site.id}` : "site-new";
  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-2xl border p-4 sm:p-5"
      aria-label={site ? `Edit site ${site.name}` : "Add a site"}
    >
      <div className="space-y-1">
        <h3 className="type-subsection-title">
          {site ? `Edit ${site.name}` : "New site"}
        </h3>
        <RequiredFieldsNote />
      </div>

      <FormSection legend="Site details">
        <FormGrid columns={3}>
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
            description="Up to 40 characters. Saved in capital letters."
            defaultValue={site?.siteCode}
            maxLength={40}
            autoCapitalize="characters"
          />
          <FormField id={`${idPrefix}-status`} label="Status" required>
            {(control) => (
              <NativeSelect
                {...control}
                name="status"
                className="w-full"
                defaultValue={site?.status ?? EContractSiteStatus.PLANNED}
              >
                {siteStatuses.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {humanizeEnumValue(status)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection legend="Address">
        <FormGrid columns={2}>
          <SiteInput
            id={`${idPrefix}-address`}
            name="addressLine1"
            label="Street address"
            defaultValue={site?.addressLine1}
            maxLength={255}
            className="sm:col-span-2"
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
            label="State or region"
            defaultValue={site?.stateRegion}
            maxLength={100}
          />
          <FormField id={`${idPrefix}-country`} label="Country" required>
            {(control) => (
              <NativeSelect
                {...control}
                name="countryCode"
                className="w-full"
                defaultValue={site?.countryCode ?? ""}
                required
              >
                <NativeSelectOption value="" disabled>
                  Select a country
                </NativeSelectOption>
                {countryOptions.map(({ code, name }) => (
                  <NativeSelectOption key={code} value={code}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        legend="Map coordinates"
        description="Decimal degrees with up to six decimal places, for example 6.524379 and 3.379206."
      >
        <FormGrid columns={2}>
          <SiteInput
            id={`${idPrefix}-latitude`}
            name="latitude"
            label="Latitude"
            description="Between -90 and 90. Negative values are south of the equator."
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-90"
            max="90"
            defaultValue={site ? fromMicroDegrees(site.latitudeE6) : undefined}
          />
          <SiteInput
            id={`${idPrefix}-longitude`}
            name="longitude"
            label="Longitude"
            description="Between -180 and 180. Negative values are west of Greenwich."
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-180"
            max="180"
            defaultValue={site ? fromMicroDegrees(site.longitudeE6) : undefined}
          />
        </FormGrid>
      </FormSection>
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

/** A required text or number field of the site form. */
function SiteInput({
  id,
  label,
  description,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <FormField
      id={id}
      label={label}
      required
      description={description}
      className={className}
    >
      {(control) => <Input {...props} {...control} required />}
    </FormField>
  );
}
