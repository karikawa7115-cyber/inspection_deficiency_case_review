import { resolveFollowUpApprovals, resolveFollowUpStatus } from "@/lib/inspection/draft-outputs";
import { getPersistedTabOutput, type PersistStore } from "@/lib/inspection/persist-store";
import {
  type Deficiency,
  type DeficiencyReviewStatus,
  type FollowUpTab,
  type ReviewOutputApproval,
  type ReviewOutputStatus,
} from "@/lib/inspection/schema";

/** P2 Approved 判定に使う主要 P4 タブ（Grill-me 合意）。 */
export const DEFICIENCY_APPROVAL_GATE_TABS: readonly FollowUpTab[] = [
  "vessel_revision_en",
  "handover_note",
  "internal_audit_checklist",
];

export function getEffectiveTabStatus(
  store: PersistStore,
  deficiency: Deficiency,
  tab: FollowUpTab,
): ReviewOutputStatus {
  const persisted = getPersistedTabOutput(store, deficiency.id, tab);
  if (persisted) return persisted.status;
  return resolveFollowUpStatus(tab, deficiency);
}

export function getEffectiveTabApprovals(
  store: PersistStore,
  deficiency: Deficiency,
  tab: FollowUpTab,
): ReviewOutputApproval[] {
  const persisted = getPersistedTabOutput(store, deficiency.id, tab);
  if (persisted) return persisted.approvals;
  return resolveFollowUpApprovals(tab, deficiency);
}

/**
 * P2 reviewStatus を P4 永続状態から導出する。
 * - 主要3タブすべて Approved → approved
 * - P4 で編集 / 承認開始 → reviewing
 * - それ以外 → JSON 初期値
 */
export function deriveDeficiencyReviewStatus(
  store: PersistStore,
  deficiency: Deficiency,
): DeficiencyReviewStatus {
  const allGatesApproved = DEFICIENCY_APPROVAL_GATE_TABS.every(
    (tab) =>
      getEffectiveTabStatus(store, deficiency, tab) === "dp_approved",
  );
  if (allGatesApproved) return "approved";

  const entry = store.deficiencies[deficiency.id];
  if (entry) {
    const hasActivity = Object.values(entry.tabs).some((output) => {
      if (output.content !== undefined) return true;
      if (output.status !== "draft") return true;
      if (output.approvals.length > 0) return true;
      return false;
    });
    if (hasActivity) return "reviewing";
  }

  return deficiency.reviewStatus;
}

export function mergeDeficiencyReviewStatus(
  store: PersistStore,
  deficiency: Deficiency,
): Deficiency {
  return {
    ...deficiency,
    reviewStatus: deriveDeficiencyReviewStatus(store, deficiency),
  };
}
