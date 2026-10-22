import React from "react";
import {
  RiAlarmWarningLine,
  RiCheckDoubleLine,
  RiCalendarEventLine,
  RiMailCheckLine,
  RiUserFollowLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
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
    <Card className="flex flex-col">
      <CardHeader className="border-b">
        <CardTitle
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <RiAlarmWarningLine className="size-4 text-amber-500" />
          Operational Attention
        </CardTitle>
        <CardDescription className="text-xs">
          Pending lifecycle events and verifications requiring oversight
        </CardDescription>
        {items.length > 0 && (
          <CardAction>
            <Badge variant="outline" className="text-xs font-normal">
              {items.length} item{items.length === 1 ? "" : "s"}
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        {items.length === 0 ? (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <RiCheckDoubleLine />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Everything is on track</EmptyTitle>
              <EmptyDescription className="text-xs">
                No contracts are expiring soon, and no invitation or user verification backlogs are pending.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                    className={`shrink-0 text-[10px] uppercase font-semibold ${
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
      </CardContent>
    </Card>
  );
}
