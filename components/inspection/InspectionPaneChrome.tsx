import { type ReactNode } from "react";

import { SectionLabel } from "@/components/primitives";
import { cn } from "@/lib/utils";

type InspectionPaneChromeProps = {
  title: string;
  paneCaption: string;
  action?: ReactNode;
  className?: string;
};

export function InspectionPaneChrome({
  title,
  paneCaption,
  action,
  className,
}: InspectionPaneChromeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5 border-b border-border bg-card/90 px-4 py-2.5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        {paneCaption}
      </p>
    </div>
  );
}
