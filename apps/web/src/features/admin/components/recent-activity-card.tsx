import React from "react";
import {
  RiHistoryLine,
  RiInboxLine,
  RiUserLine,
  RiBuildingLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import type { AdminRecentActivityItem } from "@/services/adminApi";

interface RecentActivityCardProps {
  activity: AdminRecentActivityItem[];
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function RecentActivityCard({ activity }: RecentActivityCardProps) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <RiHistoryLine className="size-4 text-blue-500" />
            Platform Activity Audit
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time audit log of security, contract, and organization operations
          </p>
        </div>
        {activity.length > 0 && (
          <Badge variant="outline" className="text-xs font-normal">
            Last {activity.length} events
          </Badge>
        )}
      </div>

      <div className="mt-4 flex-1">
        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <RiInboxLine className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              No recent activity recorded
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              System events and audit logs will automatically stream into this feed as platform actions occur.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    <RiUserLine className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground leading-snug">
                      {item.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {item.actorName}
                      </span>
                      {item.companyName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <RiBuildingLine className="size-3" />
                            {item.companyName}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        {item.action}
                      </Badge>
                    </div>
                  </div>
                </div>
                <time className="shrink-0 text-[11px] font-mono text-muted-foreground">
                  {formatDate(item.occurredAt)}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
