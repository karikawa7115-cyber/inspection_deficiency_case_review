"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MddCaseWorkspace } from "@/components/mdd/MddCaseWorkspace";

function WorkspaceInner() {
  const params = useSearchParams();
  const caseId = params.get("id") ?? "";
  const stableId = useMemo(() => caseId, [caseId]);
  if (!stableId) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        Missing case id. Open a case from the list.
      </div>
    );
  }
  return <MddCaseWorkspace caseId={stableId} />;
}

export default function MddWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground p-6 text-sm">Loading…</div>
      }
    >
      <WorkspaceInner />
    </Suspense>
  );
}
