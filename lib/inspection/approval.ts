import {
  type FollowUpTab,
  type ReviewOutputApproval,
  type ReviewOutputStatus,
} from "@/lib/inspection/schema";

/** デモ用承認者名（将来: ログインユーザー）。 */
export const DEMO_SUPERVISOR_NAME = "Technical Superintendent";
export const DEMO_DP_NAME = "Designated Person (DP)";

/** Handover / Checklist は監督＋DP 両方 Approve（Grill-me 合意）。 */
export const DP_APPROVAL_TABS: readonly FollowUpTab[] = [
  "handover_note",
  "internal_audit_checklist",
];

export function requiresDpApproval(tab: FollowUpTab): boolean {
  return DP_APPROVAL_TABS.includes(tab);
}

export function canSupervisorApprove(status: ReviewOutputStatus): boolean {
  return status === "draft";
}

export function canDpApprove(
  status: ReviewOutputStatus,
  tab: FollowUpTab,
): boolean {
  return requiresDpApproval(tab) && status === "supervisor_review";
}

export function isFollowUpOutputLocked(status: ReviewOutputStatus): boolean {
  return status !== "draft";
}

export function applySupervisorApproval(tab: FollowUpTab): {
  status: ReviewOutputStatus;
  approval: ReviewOutputApproval;
} {
  return {
    status: requiresDpApproval(tab) ? "supervisor_review" : "dp_approved",
    approval: {
      role: "supervisor",
      approvedAt: new Date().toISOString(),
      approvedBy: DEMO_SUPERVISOR_NAME,
    },
  };
}

export function applyDpApproval(): {
  status: ReviewOutputStatus;
  approval: ReviewOutputApproval;
} {
  return {
    status: "dp_approved",
    approval: {
      role: "dp",
      approvedAt: new Date().toISOString(),
      approvedBy: DEMO_DP_NAME,
    },
  };
}

export function formatApprovalTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
