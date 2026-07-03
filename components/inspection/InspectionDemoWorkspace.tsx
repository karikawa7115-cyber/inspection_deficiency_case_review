"use client";

import { useMemo, useState } from "react";

import { DeficiencyDatabaseView } from "@/components/inspection/DeficiencyDatabaseView";
import { DeficiencyListPane } from "@/components/inspection/DeficiencyListPane";
import { DeficiencyReviewPane } from "@/components/inspection/DeficiencyReviewPane";
import { FollowUpOutputPane } from "@/components/inspection/FollowUpOutputPane";
import { VesselInspectionPane } from "@/components/inspection/VesselInspectionPane";
import { useInspectionPersist } from "@/hooks/use-inspection-persist";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  getDefaultDeficiencyId,
  getDeficiencyById,
} from "@/lib/inspection/load";
import { buildInspectionCaseContext } from "@/lib/inspection/case-context";
import {
  INSPECTION_DEMO_WORKSPACE,
  INSPECTION_VIEW_MODE,
  type InspectionWorkspaceViewMode,
} from "@/lib/inspection/labels";
import { type Inspection } from "@/lib/inspection/schema";

type InspectionDemoWorkspaceProps = {
  inspections: Inspection[];
};

export function InspectionDemoWorkspace({
  inspections,
}: InspectionDemoWorkspaceProps) {
  const persist = useInspectionPersist();
  const { mergeDeficiency, store } = persist;
  const [viewMode, setViewMode] = useState<InspectionWorkspaceViewMode>(
    INSPECTION_VIEW_MODE.caseReview,
  );
  const defaultInspectionId = inspections[0]?.id ?? "";
  const [selectedInspectionId, setSelectedInspectionId] =
    useState(defaultInspectionId);
  const [selectedDeficiencyId, setSelectedDeficiencyId] = useState(() => {
    const first = inspections[0];
    return first ? getDefaultDeficiencyId(first) : "";
  });
  const [pane4Open, setPane4Open] = useState(true);

  const selectedInspection = useMemo(
    () => inspections.find((i) => i.id === selectedInspectionId) ?? null,
    [inspections, selectedInspectionId],
  );

  const selectedDeficiency =
    selectedInspection && selectedDeficiencyId
      ? (getDeficiencyById(selectedInspection, selectedDeficiencyId) ?? null)
      : null;

  const deficienciesForList = useMemo(
    () =>
      selectedInspection?.deficiencies.map((d) => mergeDeficiency(d)) ?? [],
    [selectedInspection, store, mergeDeficiency],
  );

  const selectedDeficiencyForUi = useMemo(
    () => (selectedDeficiency ? mergeDeficiency(selectedDeficiency) : null),
    [selectedDeficiency, store, mergeDeficiency],
  );

  const handleSelectInspection = (id: string) => {
    setSelectedInspectionId(id);
    const inspection = inspections.find((i) => i.id === id);
    if (inspection) {
      setSelectedDeficiencyId(getDefaultDeficiencyId(inspection));
    }
  };

  const inspectionLabel = selectedInspection
    ? `${selectedInspection.inspectionType} ${selectedInspection.port} · ${selectedInspection.inspectionDate}`
    : "";

  const followUpDraftContext = useMemo(
    () => ({
      vesselName: selectedInspection?.vesselName ?? "",
      inspectionLabel,
    }),
    [selectedInspection?.vesselName, inspectionLabel],
  );

  const caseContext = useMemo(
    () =>
      selectedInspection
        ? buildInspectionCaseContext(selectedInspection, inspectionLabel)
        : null,
    [selectedInspection, inspectionLabel],
  );

  return (
    <SidebarProvider
      defaultOpen
      className="inspection-workspace flex h-screen min-h-0 bg-canvas"
    >
      <VesselInspectionPane
        workspaceName={INSPECTION_DEMO_WORKSPACE.name}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        inspections={inspections}
        selectedInspectionId={selectedInspectionId}
        onSelectInspection={handleSelectInspection}
      />
      <SidebarInset className="flex min-h-0 flex-1 flex-col bg-canvas">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-card/80 px-4 shadow-xs">
          <p className="text-sm font-medium text-foreground">
            {viewMode === INSPECTION_VIEW_MODE.database
              ? "Deficiency Database"
              : INSPECTION_DEMO_WORKSPACE.headerTitle}
          </p>
        </header>
        {viewMode === INSPECTION_VIEW_MODE.database ? (
          <DeficiencyDatabaseView />
        ) : (
          <div className="flex min-h-0 flex-1 gap-2 p-2">
            <DeficiencyListPane
              deficiencies={deficienciesForList}
              selectedDeficiencyId={selectedDeficiencyId}
              onSelectDeficiency={setSelectedDeficiencyId}
            />
            <DeficiencyReviewPane
              deficiency={selectedDeficiencyForUi}
              caseContext={caseContext}
            />
            <FollowUpOutputPane
              deficiency={selectedDeficiency}
              draftContext={followUpDraftContext}
              pane4Open={pane4Open}
              onTogglePane4={() => setPane4Open((open) => !open)}
              persist={persist}
            />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
