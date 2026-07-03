import type {
  DbAlertKind,
  DbDeficiencyFilters,
  DbDeficiencyListRow,
} from "@/lib/inspection/db-types";

export {
  getDbAlertBadgeVariant,
  type InspectionBadgeVariant,
} from "@/lib/inspection/visual-semantics";

export const DB_ALERT_LABELS: Record<DbAlertKind, string> = {
  repeated: "Repeated",
  root_cause_too_general: "Root Cause Too General",
  root_cause_shallow: "Root Cause Too Shallow",
  preventive_weak: "Preventive Action Weak",
  handover_required: "Handover Required",
  internal_audit_candidate: "Internal Audit Candidate",
};

/** Derive alert badges from normalized DB columns. */
export function deriveDbAlerts(row: Pick<
  DbDeficiencyListRow,
  | "is_repeated"
  | "root_cause_status"
  | "preventive_action_status"
  | "handover_required"
  | "internal_audit_status"
>): DbAlertKind[] {
  const alerts: DbAlertKind[] = [];

  if (row.is_repeated) alerts.push("repeated");
  if (row.root_cause_status === "too_general") {
    alerts.push("root_cause_too_general");
  } else if (row.root_cause_status === "shallow") {
    alerts.push("root_cause_shallow");
  }
  if (row.preventive_action_status === "weak") alerts.push("preventive_weak");
  if (row.handover_required) alerts.push("handover_required");
  if (row.internal_audit_status === "candidate") {
    alerts.push("internal_audit_candidate");
  }

  return alerts;
}

export function formatDbAlertCount(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 alert" : `${count} alerts`;
}

export const DB_RISK_LEVEL_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const;

export const DB_CASE_STATUS_LABELS = {
  open: "Open",
  reviewing: "Reviewing",
  closed: "Closed",
} as const;

export const DB_INTERNAL_AUDIT_STATUS_LABELS = {
  none: "None",
  candidate: "Candidate",
  added: "Added",
} as const;

export function getDbRiskLevelVariant(
  level: DbDeficiencyListRow["risk_level"],
): "destructive" | "warning" | "neutral" {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "neutral";
}

export function getDbCaseStatusVariant(
  status: DbDeficiencyListRow["case_status"],
): "neutral" | "warning" | "success" {
  if (status === "open") return "neutral";
  if (status === "reviewing") return "warning";
  return "success";
}

export type DbSummaryStats = {
  total: number;
  repeated: number;
  rootCauseTooGeneral: number;
  preventiveTooWeak: number;
  internalAuditCandidates: number;
};

export function computeDbSummaryStats(
  rows: DbDeficiencyListRow[],
): DbSummaryStats {
  return {
    total: rows.length,
    repeated: rows.filter((row) => row.is_repeated).length,
    rootCauseTooGeneral: rows.filter(
      (row) => row.root_cause_status === "too_general",
    ).length,
    preventiveTooWeak: rows.filter(
      (row) => row.preventive_action_status === "weak",
    ).length,
    internalAuditCandidates: rows.filter(
      (row) => row.internal_audit_status === "candidate",
    ).length,
  };
}

/** Client-side filter after fetch (prototype scale: ~20 rows). */
export function applyDbDeficiencyFilters(
  rows: DbDeficiencyListRow[],
  filters: DbDeficiencyFilters,
): DbDeficiencyListRow[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.vesselCode && row.vessel_code !== filters.vesselCode) {
      return false;
    }
    if (
      filters.inspectionType &&
      row.inspection_type !== filters.inspectionType
    ) {
      return false;
    }
    if (filters.category && row.category !== filters.category) {
      return false;
    }
    if (filters.riskLevel && row.risk_level !== filters.riskLevel) {
      return false;
    }
    if (filters.repeatedOnly && !row.is_repeated) return false;
    if (
      filters.rootCauseTooGeneralOnly &&
      row.root_cause_status !== "too_general"
    ) {
      return false;
    }
    if (
      filters.preventiveActionTooWeakOnly &&
      row.preventive_action_status !== "weak"
    ) {
      return false;
    }
    if (filters.handoverRequiredOnly && !row.handover_required) return false;
    if (
      filters.internalAuditCandidateOnly &&
      row.internal_audit_status !== "candidate"
    ) {
      return false;
    }

    if (!keyword) return true;

    const haystack = [
      row.vessel_name,
      row.vessel_code,
      row.title,
      row.category,
      row.port,
      row.inspection_type,
      row.case_id,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

export function collectFilterOptions(rows: DbDeficiencyListRow[]) {
  const vesselCodes = new Map<string, string>();
  const inspectionTypes = new Set<string>();
  const categories = new Set<string>();
  const riskLevels = new Set<string>();

  for (const row of rows) {
    vesselCodes.set(row.vessel_code, row.vessel_name);
    inspectionTypes.add(row.inspection_type);
    categories.add(row.category);
    riskLevels.add(row.risk_level);
  }

  return {
    vessels: [...vesselCodes.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    inspectionTypes: [...inspectionTypes].sort(),
    categories: [...categories].sort(),
    riskLevels: [...riskLevels].sort(),
  };
}
