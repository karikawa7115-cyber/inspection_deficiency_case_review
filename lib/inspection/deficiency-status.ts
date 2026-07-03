import { DEFICIENCY_REVIEW_STATUS } from "@/lib/inspection/labels";
import type { DeficiencyReviewStatus } from "@/lib/inspection/schema";

export {
  getDeficiencyReviewStatusVariant,
  type InspectionBadgeVariant,
} from "@/lib/inspection/visual-semantics";

/** P2 指摘レビュー状態の表示ラベル。 */
export const DEFICIENCY_REVIEW_STATUS_LABELS: Record<
  DeficiencyReviewStatus,
  string
> = {
  [DEFICIENCY_REVIEW_STATUS.draft]: "Draft",
  [DEFICIENCY_REVIEW_STATUS.reviewing]: "Reviewing",
  [DEFICIENCY_REVIEW_STATUS.approved]: "Approved",
};

/** P2 の AI Review Alert 件数表示。 */
export function formatAlertCount(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 alert" : `${count} alerts`;
}
