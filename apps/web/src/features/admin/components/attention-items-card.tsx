import React from "react";
import {
  RiAlarmWarningLine,
  RiCheckDoubleLine,
  RiCalendarEventLine,
  RiMailCheckLine,
  RiUserFollowLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import type { AdminAttentionSummary } from "@/services/adminApi";

interface AttentionItemsCardProps {
  attention: AdminAttentionSummary;
}

export function AttentionItemsCard({ attention }: AttentionItemsCardProps) {
  const { items } = attention;

  const categoryIcons = {
    contract_expiry: RiCalendarEventLine,
    invitation_pending: RiMailCheckLine,
    user_verification: RiUserFollowLine,
  };

  const urgencyStyles = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    low: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <RiAlarmWarningLine className="size-4 text-amber-500" />
            Operational Attention
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pending lifecycle events and verifications requiring oversight
          </p>
        </div>
        {items.length > 0 && (
          <Badge variant="outline" className="text-xs font-normal">
            {items.length} item{items.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RiCheckDoubleLine className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              Everything is on track
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              No contracts are expiring soon, and no invitation or user verification backlogs are pending.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = categoryIcons[item.category] ?? RiAlarmWarningLine;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground mt-0.5">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-foreground">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 capitalize text-[10px] uppercase font-semibold px-2 py-0.5 ${
                      urgencyStyles[item.urgency]
                    }`}
                  >
                    {item.urgency}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
