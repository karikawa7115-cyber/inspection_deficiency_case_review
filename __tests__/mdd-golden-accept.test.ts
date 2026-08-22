import { describe, expect, it } from "vitest";
import {
  applyGateToBrief,
  createEmptyCase,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { evaluateGoldenCase } from "@/lib/mdd/golden/accept";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";

describe("MDD Golden Case acceptance (heuristic engine)", () => {
  for (const spec of GOLDEN_CASE_SPECS) {
    it(`${spec.id} preserves human-approved decision structure`, () => {
      const proposal = proposeFromHeuristics({
        title: spec.title,
        vessel: spec.vessel,
        pastedText: spec.inputFactsText,
        goldenCaseId: spec.id,
        financeSnapshot: spec.financeSnapshot,
      });
      const brief = applyGateToBrief(proposal);
      const caseData = createEmptyCase({
        title: spec.title,
        vessel: spec.vessel,
        goldenCaseId: spec.id,
        pastedText: spec.inputFactsText,
        financeSnapshot: spec.financeSnapshot,
        primaryCaseType: proposal.primaryCaseType,
        tags: proposal.tags,
        brief,
        reviewCandidateFlag: spec.reviewCandidateExpected === "yes",
      });
      const report = evaluateGoldenCase(spec, caseData);
      const failed = report.checks.filter((c) => !c.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
      expect(report.passed).toBe(true);
    });
  }
});
