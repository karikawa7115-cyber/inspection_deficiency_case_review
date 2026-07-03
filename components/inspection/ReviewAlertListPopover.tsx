"use client";

import { REVIEW_ALERT_LABELS } from "@/lib/inspection/alert-labels";
import { getReviewAlertBadgeVariant } from "@/lib/inspection/visual-semantics";
import { type ReviewAlert } from "@/lib/inspection/schema";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type ReviewAlertListPopoverProps = {
  alerts: ReviewAlert[];
  label: string;
};

export function ReviewAlertListPopover({
  alerts,
  label,
}: ReviewAlertListPopoverProps) {
  if (alerts.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`${label} — show details`}
        className="inline-flex rounded-4xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Badge variant="warning" size="xs">
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        className="w-80"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle>AI Review Alerts</PopoverTitle>
          <PopoverDescription>
            Proposals only — supervisor and DP approve revisions
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li
              key={`${alert.type}-${alert.message}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
            >
              <Badge
                variant={getReviewAlertBadgeVariant(alert.type)}
                size="xs"
              >
                {REVIEW_ALERT_LABELS[alert.type]}
              </Badge>
              <p className="text-sm leading-relaxed text-foreground">
                {alert.message}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
