import { type InspectionCaseContext, formatCaseMetaLine } from "@/lib/inspection/case-context";
import { INSPECTION_PANE_CAPTIONS } from "@/lib/inspection/visual-semantics";
import { InspectionPaneChrome } from "@/components/inspection/InspectionPaneChrome";
import { Badge } from "@/components/ui/badge";

type DeficiencyReviewPaneHeaderProps = {
  caseContext: InspectionCaseContext;
};

export function DeficiencyReviewPaneHeader({
  caseContext,
}: DeficiencyReviewPaneHeaderProps) {
  const metaLine = formatCaseMetaLine(caseContext);

  return (
    <div className="flex shrink-0 flex-col border-b border-border bg-card/90">
      <InspectionPaneChrome
        title="Root Cause Review"
        paneCaption={INSPECTION_PANE_CAPTIONS.p3}
        action={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {caseContext.criticalMatter && (
              <Badge variant="destructive" size="xs">
                Critical Matter
              </Badge>
            )}
            {caseContext.detained && (
              <Badge variant="destructive" size="xs">
                Detained
              </Badge>
            )}
          </div>
        }
        className="border-none shadow-none"
      />
      <div className="flex flex-col gap-0.5 px-4 pb-2.5">
        <p className="truncate text-sm text-foreground">
          {caseContext.vesselName} · {caseContext.inspectionLabel}
        </p>
        {metaLine && (
          <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
        )}
      </div>
    </div>
  );
}
