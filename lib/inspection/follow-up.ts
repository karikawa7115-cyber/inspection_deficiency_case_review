import {
  type FollowUpTab,
  type ReviewOutputApproval,
  type ReviewOutputStatus,
} from "@/lib/inspection/schema";

export {
  FOLLOW_UP_TAB_ACCENT,
  getReviewOutputStatusVariant,
} from "@/lib/inspection/visual-semantics";

/** P4 タブ定義（表示順）。 */
export const FOLLOW_UP_TABS = [
  {
    id: "review_comment" as const,
    label: "Review Comment",
    shortLabel: "Review",
    audience: "Supervisor · internal only",
  },
  {
    id: "vessel_revision_en" as const,
    label: "Vessel Revision EN",
    shortLabel: "Revision EN",
    audience: "Master · supervisor approve before send",
  },
  {
    id: "handover_note" as const,
    label: "Handover Note",
    shortLabel: "Handover",
    audience: "Supervisor + DP approve",
  },
  {
    id: "training_point" as const,
    label: "Training Point",
    shortLabel: "Training",
    audience: "Fleet training record",
  },
  {
    id: "owner_summary_jp" as const,
    label: "Owner Summary JP",
    shortLabel: "Owner JP",
    audience: "Owner · situational awareness",
  },
  {
    id: "internal_audit_checklist" as const,
    label: "Internal Audit Checklist",
    shortLabel: "Checklist",
    audience: "Supervisor + DP approve",
  },
] satisfies ReadonlyArray<{
  id: FollowUpTab;
  label: string;
  shortLabel: string;
  audience: string;
}>;

export const FOLLOW_UP_TAB_IDS = FOLLOW_UP_TABS.map((tab) => tab.id);

export const REVIEW_OUTPUT_STATUS_LABELS: Record<ReviewOutputStatus, string> = {
  draft: "Draft",
  supervisor_review: "Awaiting DP",
  dp_approved: "Approved",
};

export function getFollowUpTabMeta(tab: FollowUpTab) {
  return FOLLOW_UP_TABS.find((item) => item.id === tab)!;
}

export type TabApprovalState = {
  status: ReviewOutputStatus;
  approvals: ReviewOutputApproval[];
};
