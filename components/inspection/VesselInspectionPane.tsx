"use client";

import { Anchor } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatInspectionPane1Label } from "@/lib/inspection/format";
import {
  INSPECTION_VIEW_MODE,
  INSPECTION_VIEW_MODE_LABELS,
  type InspectionWorkspaceViewMode,
} from "@/lib/inspection/labels";
import { type Inspection } from "@/lib/inspection/schema";
import { getActiveVessels, getManagedVessels } from "@/lib/inspection/vessels";
import {
  INSPECTION_PANE_CAPTIONS,
  INSPECTION_VIEW_MODE_ACCENT,
} from "@/lib/inspection/visual-semantics";
import { InspectionPaneChrome } from "@/components/inspection/InspectionPaneChrome";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type VesselInspectionPaneProps = {
  workspaceName: string;
  viewMode: InspectionWorkspaceViewMode;
  onViewModeChange: (mode: InspectionWorkspaceViewMode) => void;
  inspections: Inspection[];
  selectedInspectionId: string;
  onSelectInspection: (id: string) => void;
};

const VESSEL_ACCENT_COLORS = [
  "bg-inspection-info",
  "bg-inspection-success",
  "bg-inspection-indigo",
  "bg-inspection-handover",
  "bg-inspection-warning",
] as const;

export function VesselInspectionPane({
  workspaceName,
  viewMode,
  onViewModeChange,
  inspections,
  selectedInspectionId,
  onSelectInspection,
}: VesselInspectionPaneProps) {
  const activeVessels = getActiveVessels(getManagedVessels());
  const isCaseReview = viewMode === INSPECTION_VIEW_MODE.caseReview;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border shadow-sm [&_[data-slot=sidebar-container]]:bg-sidebar"
    >
      <SidebarHeader className="flex h-12 flex-row items-center justify-between border-b border-sidebar-border px-2">
        <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Anchor className="size-4 shrink-0 text-inspection-info" />
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            {workspaceName}
          </span>
        </div>
        <Pane1Toggle />
      </SidebarHeader>

      <div className="flex flex-col gap-2 border-b border-sidebar-border p-2 group-data-[collapsible=icon]:hidden">
        <InspectionPaneChrome
          title="Workspace"
          paneCaption={INSPECTION_PANE_CAPTIONS.p1}
          className="border-none bg-transparent px-1 py-0 shadow-none"
        />
        <div className="grid grid-cols-1 gap-1 rounded-lg bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange(INSPECTION_VIEW_MODE.caseReview)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-xs font-medium transition-colors",
              isCaseReview
                ? INSPECTION_VIEW_MODE_ACCENT.caseReview.active
                : INSPECTION_VIEW_MODE_ACCENT.caseReview.idle,
            )}
          >
            {INSPECTION_VIEW_MODE_LABELS.case_review}
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange(INSPECTION_VIEW_MODE.database)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-xs font-medium transition-colors",
              !isCaseReview
                ? INSPECTION_VIEW_MODE_ACCENT.database.active
                : INSPECTION_VIEW_MODE_ACCENT.database.idle,
            )}
          >
            {INSPECTION_VIEW_MODE_LABELS.database}
          </button>
        </div>
      </div>

      {isCaseReview && (
        <SidebarContent>
          {activeVessels.map((vessel, vesselIndex) => {
            const vesselInspections = inspections.filter(
              (i) => i.vesselCode === vessel.code,
            );
            const accentColor =
              VESSEL_ACCENT_COLORS[vesselIndex % VESSEL_ACCENT_COLORS.length];

            return (
              <SidebarGroup key={vessel.id}>
                <SidebarGroupLabel className="flex items-center gap-2">
                  <span
                    className={cn("size-1 shrink-0 rounded-full", accentColor)}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "h-4 w-0.5 shrink-0 rounded-full",
                      accentColor,
                    )}
                    aria-hidden
                  />
                  {vessel.name} ({vessel.code})
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {vesselInspections.map((inspection) => (
                      <SidebarMenuItem key={inspection.id}>
                        <SidebarMenuButton
                          isActive={selectedInspectionId === inspection.id}
                          onClick={() => onSelectInspection(inspection.id)}
                          className={cn(
                            selectedInspectionId === inspection.id &&
                              "border-l-2 border-l-inspection-info bg-inspection-info-bg/50",
                          )}
                        >
                          <span
                            className={cn(
                              "truncate",
                              inspection.criticalMatter &&
                                "font-medium text-destructive",
                            )}
                          >
                            {formatInspectionPane1Label(inspection)}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    {vesselInspections.length === 0 && (
                      <SidebarMenuItem>
                        <SidebarMenuButton disabled>
                          <span className="text-muted-foreground">
                            No inspections
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
      )}
    </Sidebar>
  );
}
