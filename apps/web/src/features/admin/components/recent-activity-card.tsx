import React from "react";
import {
  RiHistoryLine,
  RiInboxLine,
  RiUserLine,
  RiBuildingLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
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
import { Separator } from "@workspace/ui/components/separator";
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
    <Card className="flex flex-col">
      <CardHeader className="border-b">
        <CardTitle
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <RiHistoryLine className="size-4 text-blue-500" />
          Platform Activity Audit
        </CardTitle>
        <CardDescription className="text-xs">
          Real-time audit log of security, contract, and organization operations
        </CardDescription>
        {activity.length > 0 && (
          <CardAction>
            <Badge variant="outline" className="text-xs font-normal">
              Last {activity.length} events
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        {activity.length === 0 ? (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-full">
                <RiInboxLine />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No recent activity recorded</EmptyTitle>
              <EmptyDescription className="text-xs">
                System events and audit logs will automatically stream into this feed as platform actions occur.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col">
            {activity.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <Separator className="my-3.5 bg-border/60" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>
                        <RiUserLine className="size-4" />
                      </AvatarFallback>
                    </Avatar>
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
                        <Badge variant="outline" className="text-[10px] px-1.5 font-mono">
                          {item.action}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <time className="shrink-0 text-[11px] font-mono text-muted-foreground">
                    {formatDate(item.occurredAt)}
                  </time>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
