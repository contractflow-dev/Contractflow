"use client";

import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatNumber } from "@/lib/format";
import { useGetCompanyTeamSummaryQuery } from "@/services/companiesApi";

/** Company-level team figures, straight from the API's counts. */
export function TeamSummary({ companyId }: { companyId: string }) {
  const {
    currentData: summary,
    error,
    isLoading,
  } = useGetCompanyTeamSummaryQuery({ companyId });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(error, "Team figures couldn't be loaded.")}
        </AlertDescription>
      </Alert>
    );
  }

  const tiles = summary
    ? [
        {
          label: "Members",
          value: summary.memberCount,
          description: "Everyone who has joined, including former members.",
        },
        {
          label: "Active members",
          value: summary.activeMemberCount,
          description: "Can sign in to this company now.",
        },
        {
          label: "Company administrators",
          value: summary.companyAdminCount,
          description: "Active members who manage the company and its team.",
        },
        {
          label: "Pending invitations",
          value: summary.pendingInvitationCount,
          description: "Sent and not yet answered or expired.",
        },
      ]
    : [];

  return (
    <section aria-label="Team summary">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !summary
          ? [0, 1, 2, 3].map((index) => (
              <li key={index}>
                <Card className="h-full">
                  <CardContent className="space-y-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              </li>
            ))
          : tiles.map((tile) => (
              <li key={tile.label}>
                <Card className="h-full">
                  <CardContent className="space-y-1">
                    <p className="font-heading text-3xl font-semibold tabular-nums">
                      {formatNumber(tile.value)}
                    </p>
                    <p className="text-sm font-medium">{tile.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {tile.description}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
      </ul>
      {isLoading ? (
        <span role="status" className="sr-only">
          Loading team figures…
        </span>
      ) : null}
    </section>
  );
}
