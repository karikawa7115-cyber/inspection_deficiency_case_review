import { REVIEW_ALERT_TYPE } from "@/lib/inspection/labels";
import type { ReviewAlertType } from "@/lib/inspection/schema";

/** Review Alert 種別の表示ラベル（P2 Badge / P3 見出し）。 */
export const REVIEW_ALERT_LABELS: Record<ReviewAlertType, string> = {
  [REVIEW_ALERT_TYPE.repeated]: "Repeated",
  [REVIEW_ALERT_TYPE.root_cause_shallow]: "Root Cause Too Shallow",
  [REVIEW_ALERT_TYPE.root_cause_too_general]: "Root Cause Too General",
  [REVIEW_ALERT_TYPE.preventive_weak]: "Preventive Action Weak",
};
