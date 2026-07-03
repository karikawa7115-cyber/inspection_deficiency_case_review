import type { Metadata } from "next";

import { InspectionDemoWorkspace } from "@/components/inspection/InspectionDemoWorkspace";
import { getDemoInspections } from "@/lib/inspection/load";
import { INSPECTION_DEMO_WORKSPACE } from "@/lib/inspection/labels";

export const metadata: Metadata = {
  title: INSPECTION_DEMO_WORKSPACE.pageTitle,
  description:
    "PSC deficiency review support — root cause review, follow-up outputs, and approval workflow for ship management.",
};

export default function InspectionDemoPage() {
  const inspections = getDemoInspections();
  return <InspectionDemoWorkspace inspections={inspections} />;
}
