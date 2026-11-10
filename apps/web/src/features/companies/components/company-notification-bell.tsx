"use client";

import Link from "next/link";
import {
  RiCalendarScheduleLine,
  RiFileTextLine,
  RiMailCheckLine,
  RiNotification3Line,
  type RemixiconComponentType,
} from "@remixicon/react";
import type {
  ICompanyAccessResponse,
  ICompanyDashboardContract,
} from "@contractflow/contracts-schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import {
  daysUntilCalendarDate,
  formatDate,
  humanizeEnumValue,
} from "@/lib/format";
import { useGetCompanyDashboardQuery } from "@/services/companiesApi";
import {
  useGetIncomingContractInvitationsQuery,
  type IncomingContractInvitation,
} from "@/services/contractApi";

/** Where the overview's "Invitations to contracts" card can be scrolled to. */
export const CONTRACT_INVITATIONS_ANCHOR = "contract-invitations";

/** How often open invitations are re-checked while the tab is in focus. */
const POLL_MS = 2 * 60 * 1000;

export interface CompanyNotification {
  id: string;
  kind: "invitation" | "verification" | "expiring";
  title: string;
  detail: string;
  href: string;
}

const KIND_ICON: Record<CompanyNotification["kind"], RemixiconComponentType> = {
  invitation: RiFileTextLine,
  verification: RiMailCheckLine,
  expiring: RiCalendarScheduleLine,
};

function endsIn(days: number | null): string {
  if (days === null) return "End date not available";
  if (days < 0) return "Ended";
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

/**
 * What the bell lists for a company: things that need someone to act, built
 * from data the API already serves. Each item disappears once it is dealt
 * with, so there is no separate read state. Invitations come first because
 * they expire; then email verification, which blocks new invitations; then
 * contracts ending soon.
 */
export function buildCompanyNotifications({
  company,
  invitations,
  expiringContracts,
  timeZone,
  now = new Date(),
}: {
  company: Pick<ICompanyAccessResponse["company"], "email" | "verifiedAt">;
  invitations: readonly IncomingContractInvitation[];
  expiringContracts: readonly ICompanyDashboardContract[];
  timeZone?: string;
  now?: Date;
}): CompanyNotification[] {
  const items: CompanyNotification[] = invitations.map((invitation) => ({
    id: `invitation:${invitation.id}`,
    kind: "invitation",
    title: `${invitation.invitingCompanyName} invited you to ${invitation.contractReference}`,
    detail: `${invitation.contractTitle} · as ${humanizeEnumValue(invitation.partyType)} · expires ${formatDate(invitation.expiresAt, { timeZone })}`,
    href: `/dashboards#${CONTRACT_INVITATIONS_ANCHOR}`,
  }));

  if (!company.verifiedAt) {
    items.push({
      id: "verification",
      kind: "verification",
      title: "Verify your company email",
      detail: `Other companies can't invite you to contracts until ${company.email} is verified.`,
      href: "/dashboards/profile",
    });
  }

  for (const contract of expiringContracts) {
    items.push({
      id: `expiring:${contract.id}`,
      kind: "expiring",
      title: `${contract.referenceNumber} ${endsIn(daysUntilCalendarDate(contract.endDate, now)).toLowerCase()}`,
      detail: contract.title,
      href: `/dashboards/contracts/${encodeURIComponent(contract.id)}`,
    });
  }

  return items;
}

/**
 * The notification bell in the company workspace header. Only company
 * administrators can read invitations and the dashboard, so members see an
 * empty bell instead of failed requests.
 */
export function CompanyNotificationBell({
  access,
}: {
  access: ICompanyAccessResponse;
}) {
  const companyId = access.company.id;
  const isAdmin = access.membership.canManageCompany;
  const timeZone = useUserTimeZone();
  const invitations = useGetIncomingContractInvitationsQuery(
    { companyId },
    { skip: !isAdmin, pollingInterval: POLL_MS, skipPollingIfUnfocused: true },
  );
  const dashboard = useGetCompanyDashboardQuery(
    { companyId },
    { skip: !isAdmin },
  );

  const items = isAdmin
    ? buildCompanyNotifications({
        company: access.company,
        invitations: invitations.currentData ?? [],
        expiringContracts: dashboard.currentData?.expiringContracts ?? [],
        timeZone,
      })
    : [];
  const count = items.length;
  const failed = Boolean(invitations.error || dashboard.error);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={
          count
            ? `Notifications, ${count} need${count === 1 ? "s" : ""} attention`
            : "Notifications"
        }
        className="relative grid size-8 shrink-0 place-items-center rounded-2xl border bg-background hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none data-popup-open:bg-muted"
      >
        <RiNotification3Line className="size-4" aria-hidden="true" />
        {count ? (
          <span
            aria-hidden="true"
            className="absolute -end-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {count ? (
          <DropdownMenuGroup className="max-h-96 overflow-y-auto">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <DropdownMenuLinkItem
                  key={item.id}
                  render={<Link href={item.href} />}
                  className="items-start gap-3 py-2"
                >
                  <Icon
                    className="mt-0.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium break-words">
                      {item.title}
                    </span>
                    <span className="block text-xs break-words text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </DropdownMenuLinkItem>
              );
            })}
          </DropdownMenuGroup>
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {failed
              ? "Notifications could not be loaded. Refresh the page to try again."
              : "You're all caught up."}
          </p>
        )}
        {count && failed ? (
          <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
            Some notifications could not be loaded.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
