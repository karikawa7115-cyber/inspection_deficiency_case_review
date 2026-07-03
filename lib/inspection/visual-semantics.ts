import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

import { DEFICIENCY_REVIEW_STATUS } from "@/lib/inspection/labels";
import type { DbAlertKind } from "@/lib/inspection/db-types";
import type {
  Deficiency,
  DeficiencyReviewStatus,
  FollowUpTab,
  ReviewAlertType,
  ReviewOutputStatus,
} from "@/lib/inspection/schema";

export type InspectionBadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export type DeficiencyDisplayRisk = "high" | "medium" | "low";

export const INSPECTION_PANE_CAPTIONS = {
  p1: "Select vessel / case or open database",
  p2: "Check deficiency list and alerts",
  p3: "Review root cause and preventive action",
  p4: "Generate follow-up outputs",
} as const;

export const DEFICIENCY_DISPLAY_RISK_LABELS: Record<
  DeficiencyDisplayRisk,
  string
> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Case Review P2: derive display risk from review alerts (JSON has no risk_level). */
export function deriveDeficiencyDisplayRisk(
  deficiency: Pick<Deficiency, "reviewAlerts">,
): DeficiencyDisplayRisk {
  const types = new Set(deficiency.reviewAlerts.map((alert) => alert.type));
  if (types.has("repeated")) return "high";
  if (types.size >= 2) return "medium";
  if (types.size === 1) return "medium";
  return "low";
}

export function getDeficiencyDisplayRiskVariant(
  level: DeficiencyDisplayRisk,
): InspectionBadgeVariant {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "neutral";
}

export function getReviewAlertBadgeVariant(
  type: ReviewAlertType,
): InspectionBadgeVariant {
  if (type === "repeated") return "destructive";
  if (type === "preventive_weak") return "warning";
  if (
    type === "root_cause_too_general" ||
    type === "root_cause_shallow"
  ) {
    return "warning";
  }
  return "outline";
}

export function getDbAlertBadgeVariant(
  kind: DbAlertKind,
): InspectionBadgeVariant {
  if (kind === "repeated") return "destructive";
  if (
    kind === "root_cause_too_general" ||
    kind === "root_cause_shallow" ||
    kind === "preventive_weak"
  ) {
    return "warning";
  }
  if (kind === "handover_required") return "handover";
  if (kind === "internal_audit_candidate") return "success";
  return "outline";
}

export function getDeficiencyReviewStatusVariant(
  status: DeficiencyReviewStatus,
): InspectionBadgeVariant {
  if (status === DEFICIENCY_REVIEW_STATUS.draft) return "neutral";
  if (status === DEFICIENCY_REVIEW_STATUS.reviewing) return "warning";
  return "success";
}

export function getReviewOutputStatusVariant(
  status: ReviewOutputStatus,
): InspectionBadgeVariant {
  if (status === "draft") return "neutral";
  if (status === "supervisor_review") return "info";
  return "success";
}

export function deficiencyHasRootCauseIssue(
  deficiency: Pick<Deficiency, "reviewAlerts">,
): boolean {
  return deficiency.reviewAlerts.some(
    (alert) =>
      alert.type === "root_cause_shallow" ||
      alert.type === "root_cause_too_general",
  );
}

export function deficiencyHasPreventiveIssue(
  deficiency: Pick<Deficiency, "reviewAlerts">,
): boolean {
  return deficiency.reviewAlerts.some(
    (alert) => alert.type === "preventive_weak",
  );
}

export const FOLLOW_UP_TAB_ACCENT: Record<
  FollowUpTab,
  {
    activeClass: string;
    idleClass: string;
  }
> = {
  review_comment: {
    activeClass: "border-l-inspection-info bg-inspection-info-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-info/40",
  },
  vessel_revision_en: {
    activeClass: "border-l-inspection-warning bg-inspection-warning-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-warning/40",
  },
  handover_note: {
    activeClass: "border-l-inspection-handover bg-inspection-handover-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-handover/40",
  },
  training_point: {
    activeClass: "border-l-inspection-indigo bg-inspection-indigo-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-indigo/40",
  },
  owner_summary_jp: {
    activeClass: "border-l-inspection-success bg-inspection-success-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-success/40",
  },
  internal_audit_checklist: {
    activeClass: "border-l-inspection-success bg-inspection-success-bg/60",
    idleClass: "border-l-transparent hover:border-l-inspection-success/40",
  },
};

export const INSPECTION_VIEW_MODE_ACCENT = {
  caseReview: {
    active: "bg-inspection-info text-primary-foreground shadow-sm",
    idle: "text-muted-foreground hover:bg-inspection-info-bg/50 hover:text-foreground",
  },
  database: {
    active: "bg-inspection-success text-primary-foreground shadow-sm",
    idle: "text-muted-foreground hover:bg-inspection-success-bg/50 hover:text-foreground",
  },
} as const;
