import { describe, it, expect } from "vitest";

import {
  DEFICIENCY_REVIEW_STATUS_LABELS,
  formatAlertCount,
  getDeficiencyReviewStatusVariant,
} from "@/lib/inspection/deficiency-status";

describe("formatAlertCount", () => {
  it("0 件は null", () => {
    expect(formatAlertCount(0)).toBeNull();
  });

  it("1 件 / 複数件のラベル", () => {
    expect(formatAlertCount(1)).toBe("1 alert");
    expect(formatAlertCount(3)).toBe("3 alerts");
  });
});

describe("deficiency review status labels", () => {
  it("3 状態すべてにラベルと variant がある", () => {
    for (const status of ["draft", "reviewing", "approved"] as const) {
      expect(DEFICIENCY_REVIEW_STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(getDeficiencyReviewStatusVariant(status)).toBeDefined();
    }
  });
});
