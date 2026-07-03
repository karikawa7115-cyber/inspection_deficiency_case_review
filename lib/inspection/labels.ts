/** Review Alert 種別定数（schema の enum と同期）。 */
export const REVIEW_ALERT_TYPE = {
  repeated: "repeated",
  root_cause_shallow: "root_cause_shallow",
  root_cause_too_general: "root_cause_too_general",
  preventive_weak: "preventive_weak",
} as const;

/** Deficiency レビュー状態ラベル（P2 / schema の enum と同期）。 */
export const DEFICIENCY_REVIEW_STATUS = {
  draft: "draft",
  reviewing: "reviewing",
  approved: "approved",
} as const;

export const INSPECTION_DEMO_WORKSPACE = {
  name: "Inspection Review Assistant",
  pageTitle: "Inspection Review Assistant",
  headerTitle: "Inspection Review Assistant",
  storageKey: "inspection-review-assistant",
  icon: "anchor",
} as const;

/** P1 workspace mode: Case Review (JSON) vs Deficiency Database (Supabase). */
export type InspectionWorkspaceViewMode = "case_review" | "database";

export const INSPECTION_VIEW_MODE = {
  caseReview: "case_review",
  database: "database",
} as const satisfies Record<string, InspectionWorkspaceViewMode>;

export const INSPECTION_VIEW_MODE_LABELS: Record<
  InspectionWorkspaceViewMode,
  string
> = {
  case_review: "Case Review",
  database: "Deficiency Database",
};
