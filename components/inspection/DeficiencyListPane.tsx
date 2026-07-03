"use client";

import { type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import { REVIEW_ALERT_LABELS } from "@/lib/inspection/alert-labels";
import {
  DEFICIENCY_REVIEW_STATUS_LABELS,
  formatAlertCount,
  getDeficiencyReviewStatusVariant,
} from "@/lib/inspection/deficiency-status";
import { type Deficiency } from "@/lib/inspection/schema";
import {
  DEFICIENCY_DISPLAY_RISK_LABELS,
  deriveDeficiencyDisplayRisk,
  getDeficiencyDisplayRiskVariant,
  getReviewAlertBadgeVariant,
  INSPECTION_PANE_CAPTIONS,
} from "@/lib/inspection/visual-semantics";
import { ReviewAlertListPopover } from "@/components/inspection/ReviewAlertListPopover";
import { InspectionPaneChrome } from "@/components/inspection/InspectionPaneChrome";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type DeficiencyListPaneProps = {
  deficiencies: Deficiency[];
  selectedDeficiencyId: string;
  onSelectDeficiency: (id: string) => void;
};

function selectDeficiencyOnKeyDown(
  event: KeyboardEvent,
  onSelect: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

export function DeficiencyListPane({
  deficiencies,
  selectedDeficiencyId,
  onSelectDeficiency,
}: DeficiencyListPaneProps) {
  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
      <InspectionPaneChrome
        title="Deficiency List"
        paneCaption={INSPECTION_PANE_CAPTIONS.p2}
      />
      <ScrollArea className="flex-1">
        <ul className="flex flex-col gap-1.5 p-2">
          {deficiencies.map((deficiency) => {
            const selected = deficiency.id === selectedDeficiencyId;
            const alertCount = deficiency.reviewAlerts.length;
            const alertCountLabel = formatAlertCount(alertCount);
            const displayRisk = deriveDeficiencyDisplayRisk(deficiency);

            return (
              <li key={deficiency.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDeficiency(deficiency.id)}
                  onKeyDown={(event) =>
                    selectDeficiencyOnKeyDown(event, () =>
                      onSelectDeficiency(deficiency.id),
                    )
                  }
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-inspection-info/30 border-l-4 border-l-inspection-info bg-inspection-info-bg/40 shadow-sm"
                      : "border-transparent border-l-4 border-l-transparent hover:border-border hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">
                      No.{String(deficiency.number).padStart(2, "0")} ·{" "}
                      {deficiency.code}
                    </span>
                    <Badge
                      variant={getDeficiencyDisplayRiskVariant(displayRisk)}
                      size="xs"
                    >
                      {DEFICIENCY_DISPLAY_RISK_LABELS[displayRisk]}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {deficiency.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge
                      variant={getDeficiencyReviewStatusVariant(
                        deficiency.reviewStatus,
                      )}
                      size="xs"
                    >
                      {DEFICIENCY_REVIEW_STATUS_LABELS[deficiency.reviewStatus]}
                    </Badge>
                    {alertCountLabel && (
                      <ReviewAlertListPopover
                        alerts={deficiency.reviewAlerts}
                        label={alertCountLabel}
                      />
                    )}
                    {deficiency.reviewAlerts.map((alert) => (
                      <Badge
                        key={`${alert.type}-${alert.message}`}
                        variant={getReviewAlertBadgeVariant(alert.type)}
                        size="xs"
                      >
                        {REVIEW_ALERT_LABELS[alert.type]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
