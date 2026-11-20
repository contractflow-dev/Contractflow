"use client";

import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import {
  EContractSiteStatus,
  ECountryCode,
  type ContractActivityTarget,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { ListCard } from "@/components/data-table/list-card";
import {
  DataTable,
  DataTableEmpty,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { countryName } from "@/lib/countries";
import { normalizeStateRegion, stateRegionError } from "@/lib/address";
import { CountryRegionFields } from "@/components/forms/country-region-fields";
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

function siteAddress(site: ContractSite): string {
  return `${site.addressLine1}, ${site.city}, ${site.stateRegion}, ${countryName(site.countryCode)}`;
}

/** A contract's sites; lower-priority columns step aside on narrow screens. */
const SITE_COLUMNS: ReadonlyArray<DataTableColumn<ContractSite>> = [
  {
    id: "site",
    header: "Site",
    wrap: true,
    className: "min-w-40",
    cell: (site) => (
      <>
        <span className="block font-medium">{site.name}</span>
        <span className="text-xs text-muted-foreground">{site.siteCode}</span>
        <span className="mt-1 block text-xs text-muted-foreground md:hidden">
          {siteAddress(site)}
        </span>
      </>
    ),
  },
  {
    id: "address",
    header: "Address",
    wrap: true,
    hideBelow: "md",
    className: "min-w-48",
    cell: siteAddress,
  },
  {
    id: "coordinates",
    header: "Coordinates",
    hideBelow: "lg",
    className: "font-mono text-xs",
    cell: (site) =>
      `${fromMicroDegrees(site.latitudeE6)}, ${fromMicroDegrees(site.longitudeE6)}`,
  },
  {
    id: "status",
    header: "Status",
    cell: (site) => <StatusBadge status={site.status} />,
  },
];

/**
 * Contract sites are set up by the creating company's Company Administrator
 * before any site log, inspection, or incident can reference them.
 */
export function ContractSiteManagement({
  companyId,
  contract,
  target,
}: {
  companyId: string;
  contract: Contract;
  target?: ContractActivityTarget | null;
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
    <>
      <ListCard
        title="Contract sites"
        description="Sites must exist before site logs, inspections, or incidents can reference them."
        action={
          <Button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setEditing("new")}
          >
            Add site
          </Button>
        }
      >
        {/* One table at every width, so deep links keep a single target:
            phones show the address under the site, tablets drop coordinates. */}
        <DataTable
          label="Contract sites"
          columns={SITE_COLUMNS}
          rows={sitesQuery.currentData ?? []}
          getRowKey={(site) => site.id}
          getRowProps={(site) => ({
            id: `activity-target-${site.id}`,
            className:
              target?.type === "contract_site" && target.id === site.id
                ? "bg-primary/10"
                : undefined,
          })}
          rowActions={(site) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Edit site ${site.name}`}
              aria-haspopup="dialog"
              onClick={() => setEditing(site)}
            >
              Edit
            </Button>
          )}
          isLoading={sitesQuery.isLoading}
          loadingLabel="Loading sites…"
          skeletonRows={3}
          error={
            sitesQuery.error
              ? getApiErrorMessage(
                  sitesQuery.error,
                  "Unable to load contract sites.",
                )
              : null
          }
          onRetry={() => void sitesQuery.refetch()}
          empty={
            <DataTableEmpty
              title="No sites have been added to this contract."
              description="Add the locations where work on this contract takes place."
            />
          }
        />
      </ListCard>
      <SiteFormSheet
        companyId={companyId}
        contractId={contract.id}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/**
 * Adding or editing a site, in a side sheet over the sites table, so the
 * table doesn't move. A click outside doesn't close it, so a half-filled
 * form isn't lost by accident; Escape, Cancel and the close button do.
 */
function SiteFormSheet({
  companyId,
  contractId,
  editing,
  onClose,
}: {
  companyId: string;
  contractId: string;
  /** The site to edit, "new" to add one, or null for a closed sheet. */
  editing: ContractSite | "new" | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={editing !== null}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
        {editing !== null ? (
          <SiteForm
            key={editing === "new" ? "new" : editing.id}
            companyId={companyId}
            contractId={contractId}
            site={editing === "new" ? null : editing}
            onDone={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
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
  const [countryCode, setCountryCode] = useState<string>(
    site?.countryCode ?? "",
  );
  const [stateRegion, setStateRegion] = useState(() =>
    site ? normalizeStateRegion(site.countryCode, site.stateRegion) : "",
  );
  const [countryError, setCountryError] = useState<string>();
  const [regionError, setRegionError] = useState<string>();

  function changeCountryCode(value: string) {
    setCountryCode(value);
    setCountryError(undefined);
  }

  function changeStateRegion(value: string) {
    setStateRegion(value);
    setRegionError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingCountry = countryCode ? undefined : "Select a country";
    const invalidRegion = stateRegionError(countryCode, stateRegion);
    setCountryError(missingCountry);
    setRegionError(invalidRegion);
    if (missingCountry || invalidRegion) return;
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? "").trim(),
      siteCode: String(form.get("siteCode") ?? "").trim(),
      addressLine1: String(form.get("addressLine1") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      stateRegion: stateRegion.trim(),
      countryCode: countryCode as ECountryCode,
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
      className="flex min-h-full flex-col"
      aria-label={site ? `Edit site ${site.name}` : "Add a site"}
    >
      <SheetHeader className="border-b">
        <SheetTitle>{site ? `Edit ${site.name}` : "Add a site"}</SheetTitle>
        <SheetDescription>
          {site
            ? "Changes apply wherever this site is referenced."
            : "Sites must exist before site logs, inspections or incidents can reference them."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 p-4">
        <RequiredFieldsNote />

        <FormSection legend="Site details">
          <FormGrid columns={2}>
            <SiteInput
              id={`${idPrefix}-name`}
              name="name"
              label="Site name"
              defaultValue={site?.name}
              maxLength={255}
              className="sm:col-span-2"
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
            <CountryRegionFields
              countryId={`${idPrefix}-country`}
              stateRegionId={`${idPrefix}-region`}
              countryName="countryCode"
              stateRegionName="stateRegion"
              countryCode={countryCode}
              stateRegion={stateRegion}
              onCountryCodeChange={changeCountryCode}
              onStateRegionChange={changeStateRegion}
              countryError={countryError}
              stateRegionError={regionError}
            />
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
              defaultValue={
                site ? fromMicroDegrees(site.latitudeE6) : undefined
              }
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
              defaultValue={
                site ? fromMicroDegrees(site.longitudeE6) : undefined
              }
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
      </div>
      {/* Kept in view at the foot of the sheet while the form scrolls. */}
      <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t bg-popover">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
          {saving ? "Saving…" : site ? "Save site" : "Add site"}
        </Button>
      </SheetFooter>
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
