import { describe, expect, it } from "vitest";
import { proposeFromHeuristics } from "@/lib/mdd/decision-engine/propose";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import {
  runGoldenLlmEvalPipeline,
  structuredFromHeuristicProposal,
} from "@/lib/mdd/golden/llm-eval-v1";
import {
  mutantGc01PresidentVisaChase,
  mutantGc02PresidentClassJudgment,
  mutantGc03CloseOnPhotos,
  mutantGc04CtmWithoutLiquidity,
} from "@/lib/mdd/golden/mutants-v1";

async function evalHeuristic(id: "GC01" | "GC02" | "GC03" | "GC04") {
  const spec = GOLDEN_CASE_SPECS.find((s) => s.id === id)!;
  const proposal = proposeFromHeuristics({
    title: spec.title,
    vessel: spec.vessel,
    pastedText: spec.inputFactsText,
    goldenCaseId: id,
    financeSnapshot: spec.financeSnapshot,
  });
  const structured = structuredFromHeuristicProposal(proposal, {
    reviewCandidateFlag: id === "GC03",
    financeSnapshot: spec.financeSnapshot,
  });
  return await runGoldenLlmEvalPipeline(spec, structured);
}

describe("Golden Case LLM Evaluation Rules v1.0 — reference heuristic", () => {
  for (const id of ["GC01", "GC02", "GC03", "GC04"] as const) {
    it(`${id} passes pipeline (Pass or PassWithWarnings)`, async () => {
      const report = await evalHeuristic(id);
      expect(report.schemaValid).toBe(true);
      expect(report.qualityGate.passed).toBe(true);
      expect(["Pass", "PassWithWarnings"]).toContain(report.overall);
    });
  }
});

describe("Golden Case LLM Evaluation Rules v1.0 — plausible mutants", () => {
  it("GC01: President visa/document chasing → CriticalFail", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(
      spec,
      mutantGc01PresidentVisaChase(),
    );
    expect(report.overall).toBe("CriticalFail");
    expect(report.criticalFailCodes).toContain("CF_WRONG_AUTHORITY");
  });

  it("GC02: President substitutes for technical/Class judgment → CriticalFail", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC02")!;
    const report = await runGoldenLlmEvalPipeline(
      spec,
      mutantGc02PresidentClassJudgment(),
    );
    expect(report.overall).toBe("CriticalFail");
    expect(
      report.criticalFailCodes.some((c) =>
        ["CF_BOUNDARY_VIOLATION", "CF_WRONG_AUTHORITY"].includes(c),
      ),
    ).toBe(true);
  });

  it("GC03: closed merely because photos/corrections → CriticalFail", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC03")!;
    const report = await runGoldenLlmEvalPipeline(spec, mutantGc03CloseOnPhotos());
    expect(report.overall).toBe("CriticalFail");
    expect(
      report.criticalFailCodes.some((c) =>
        [
          "CF_UNSAFE_OR_COMPLIANCE_REC",
          "CF_FORBIDDEN_RECOMMENDATION",
          "CF_REVIEW_FLAG_REQUIRED_MISSING",
          "CF_UNRESOLVED_CRITICAL_GATE",
          "CF_READY_WITH_CRITICAL_GATE",
          "CF_SCHEMA_INVALID",
        ].includes(c),
      ),
    ).toBe(true);
    // Prefer structural close-on-photos detection when schema-valid
    if (report.schemaValid) {
      expect(
        report.dimensions.some(
          (d) =>
            d.id === "D06" &&
            d.severity === "critical_fail" &&
            /photos|corrections/i.test(d.detail ?? ""),
        ) ||
          report.criticalFailCodes.includes("CF_UNSAFE_OR_COMPLIANCE_REC"),
      ).toBe(true);
    }
  });

  it("GC04: USD40k without liquidity confirmation → CriticalFail", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC04")!;
    const report = await runGoldenLlmEvalPipeline(
      spec,
      mutantGc04CtmWithoutLiquidity(),
      { applyDecisionControl: false },
    );
    expect(report.overall).toBe("CriticalFail");
    expect(
      report.criticalFailCodes.some((c) =>
        [
          "CF_READY_WITH_CRITICAL_GATE",
          "CF_UNRESOLVED_CRITICAL_GATE",
        ].includes(c),
      ),
    ).toBe(true);
    expect(report.qualityGate.passed).toBe(false);
    expect(report.qualityGate.enforcedReadiness).not.toBe("READY");
  });

  it("Golden PASS cannot override unresolved Critical Gate", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC04")!;
    const report = await runGoldenLlmEvalPipeline(
      spec,
      mutantGc04CtmWithoutLiquidity(),
      { applyDecisionControl: false },
    );
    expect(report.qualityGate.passed).toBe(false);
    expect(report.overall).not.toBe("Pass");
    expect(report.overall).not.toBe("PassWithWarnings");
  });

  it("optional tag absence alone does not fail GC01", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const proposal = proposeFromHeuristics({
      title: spec.title,
      vessel: spec.vessel,
      pastedText: spec.inputFactsText,
      goldenCaseId: "GC01",
    });
    const structured = structuredFromHeuristicProposal(proposal, {
      reviewCandidateFlag: false,
    });
    structured.tags = ["pluto_leader", "crew_change"];
    const report = await runGoldenLlmEvalPipeline(spec, structured);
    expect(["Pass", "PassWithWarnings"]).toContain(report.overall);
  });
});
