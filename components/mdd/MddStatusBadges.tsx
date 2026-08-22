import { Badge } from "@/components/ui/badge";
import type { CaseStatus, DecisionReadiness } from "@/lib/mdd/types";

/** Official Case Status labels (Design Package v1.1) — display exactly. */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  NEW: "NEW",
  ANALYZING: "ANALYZING",
  WAITING_FOR_INFORMATION: "WAITING_FOR_INFORMATION",
  DECISION_REQUIRED: "DECISION_REQUIRED",
  ACTION_IN_PROGRESS: "ACTION_IN_PROGRESS",
  MONITORING: "MONITORING",
  CLOSED: "CLOSED",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const label = CASE_STATUS_LABEL[status];
  if (status === "DECISION_REQUIRED") {
    return <Badge variant="destructive">{label}</Badge>;
  }
  if (status === "WAITING_FOR_INFORMATION") {
    return <Badge variant="warning">{label}</Badge>;
  }
  if (status === "ACTION_IN_PROGRESS") {
    return <Badge variant="info">{label}</Badge>;
  }
  if (status === "CLOSED") {
    return <Badge variant="neutral">{label}</Badge>;
  }
  if (status === "ANALYZING") {
    return <Badge variant="secondary">{label}</Badge>;
  }
  if (status === "MONITORING") {
    return <Badge variant="outline">{label}</Badge>;
  }
  return <Badge variant="outline">{label}</Badge>;
}

export function ReadinessBadge({
  readiness,
}: {
  readiness: DecisionReadiness;
}) {
  if (readiness === "READY") {
    return <Badge variant="success">READY</Badge>;
  }
  if (readiness === "CONDITIONAL") {
    return <Badge variant="warning">CONDITIONAL</Badge>;
  }
  return <Badge variant="destructive">NOT_READY</Badge>;
}

export function ReviewCandidateBadge({ on }: { on: boolean }) {
  if (!on) return null;
  return <Badge variant="handover">Review Candidate</Badge>;
}

/** Attention rank for Case List sorting — higher = needs President sooner. */
export function caseAttentionRank(status: CaseStatus): number {
  switch (status) {
    case "DECISION_REQUIRED":
      return 100;
    case "WAITING_FOR_INFORMATION":
      return 80;
    case "ANALYZING":
      return 60;
    case "ACTION_IN_PROGRESS":
      return 40;
    case "MONITORING":
      return 20;
    case "NEW":
      return 10;
    case "CLOSED":
      return 0;
    default:
      return 0;
  }
}
