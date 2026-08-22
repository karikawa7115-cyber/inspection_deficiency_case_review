import { describe, expect, it } from "vitest";
import { statusAfterAnalysis } from "@/components/mdd/MddCaseWorkspace";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";

describe("statusAfterAnalysis", () => {
  it("maps READY and CONDITIONAL to DECISION_REQUIRED", () => {
    expect(statusAfterAnalysis("READY")).toBe("DECISION_REQUIRED");
    expect(statusAfterAnalysis("CONDITIONAL")).toBe("DECISION_REQUIRED");
  });

  it("maps NOT_READY to WAITING_FOR_INFORMATION", () => {
    expect(statusAfterAnalysis("NOT_READY")).toBe("WAITING_FOR_INFORMATION");
  });
});

describe("GC03 proposal structure", () => {
  it("matches Golden Spec structural expectations", () => {
    const proposal = proposeFromHeuristics({
      title: "ORBIT — Internal Audit / Panama ASI",
      vessel: "ORBIT",
      pastedText: "Panama ASI Internal Audit CR-4",
      goldenCaseId: "GC03",
    });
    const brief = applyGateToBrief(proposal);
    expect(proposal.primaryCaseType).toBe("INSPECTION_COMPLIANCE");
    expect(brief.decisionReadiness).toBe("CONDITIONAL");
    expect(brief.decisionAuthorities.length).toBeGreaterThanOrEqual(3);
    expect(brief.learning.internalAuditCandidate).toBe(true);
    expect(brief.learning.managementReviewCandidate).toBe(true);
    expect(brief.learning.horizontalCheck).toBe(true);
    expect(statusAfterAnalysis(brief.decisionReadiness)).toBe(
      "DECISION_REQUIRED",
    );
  });
});
