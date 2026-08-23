import { describe, expect, it } from "vitest";
import { getGoldenCaseCdq } from "@/lib/mdd/golden/cdq-envelopes";
import { runGoldenLlmEvalPipeline } from "@/lib/mdd/golden/llm-eval-v1";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import { assembleCanonicalOutputV012 } from "@/lib/mdd/pipeline/assemble-canonical-v0.1.2";
import { evaluateQualityGateV1_1 } from "@/lib/mdd/quality-gate/evaluate-v1.1";
import { subjectFromStructuredOutput } from "@/lib/mdd/quality-gate/evaluate-v1";
import {
  parseMddStructuredOutput,
  type MddStructuredOutput,
} from "@/lib/mdd/schema/structured-output-v1";

const NOW = "2026-08-23T12:00:00.000Z";

function baseDraft(
  overrides: Partial<MddStructuredOutput> = {},
): MddStructuredOutput {
  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: "CREW_MANNING",
    tags: ["crew_change"],
    executive: {
      recommendation: { text: "Postpone crew change to Japan." },
      presidentDecision: {
        requiredNow: true,
        text: "Approve postponement to Japan late September.",
      },
      decisionReadiness: "CONDITIONAL",
      decisionAuthorities: [
        {
          id: "a1",
          roleLabel: "Final management approval of postponement",
          authority: "President/DP",
          status: "pending",
        },
      ],
      why: { text: "Core decision can be made from confirmed facts." },
      nextActions: [
        {
          id: "n1",
          who: "Manning Agent",
          what: "Follow up documents",
          status: "open",
        },
      ],
    },
    facts: {
      confirmed: [{ id: "c1", text: "Inoy cannot board at Nansha." }],
      unverified: [],
      assumptions: [],
      missingInformation: [
        {
          id: "m1",
          text: "Exact Japanese port and ETA",
          who: "Ops",
          what: "Port/ETA",
          evidenceRequired: "Schedule",
          blocksReadiness: false,
        },
      ],
    },
    risks: [],
    options: [],
    professionalBoundaries: [],
    qualityGate: {
      passed: true,
      criticalFailures: [],
      warnings: [],
      evaluatedAt: NOW,
    },
    reviewCandidate: { flag: false, retainAfterClose: false },
    learning: {
      correctiveAction: false,
      preventiveAction: false,
      effectivenessVerification: false,
      horizontalCheck: false,
      fleetWideRelevance: "no",
      internalAuditCandidate: false,
      managementReviewCandidate: false,
      knowledgeUpdateCandidate: false,
    },
  };
  return {
    ...base,
    ...overrides,
    executive: { ...base.executive, ...overrides.executive },
    facts: { ...base.facts, ...overrides.facts },
    reviewCandidate: {
      ...base.reviewCandidate,
      ...overrides.reviewCandidate,
    },
    learning: { ...base.learning, ...overrides.learning },
    qualityGate: { ...base.qualityGate, ...overrides.qualityGate },
  };
}

describe("Decision Pipeline v0.1.2 — Gate-owned qualityGate / assembly", () => {
  it("LLM draft Critical findings are not authoritative after Gate recomputation", async () => {
    const draft = baseDraft({
      executive: {
        ...baseDraft().executive,
        decisionReadiness: "READY",
      },
      qualityGate: {
        passed: false,
        criticalFailures: [
          {
            code: "CRITICAL_FACT_MISSING",
            message: "LLM self-graded critical (non-authoritative).",
          },
        ],
        warnings: [],
        evaluatedAt: NOW,
      },
    });

    // Pre-assembly Canonical would fail (READY + criticals)
    expect(parseMddStructuredOutput(draft).success).toBe(false);

    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(spec, draft, {
      applyDecisionControl: true,
      nowIso: NOW,
    });

    expect(report.schemaValid).toBe(true);
    expect(report.assembledOutput).toBeDefined();
    expect(report.assembledOutput!.qualityGate.criticalFailures).toEqual(
      report.qualityGate.criticalFailures,
    );
    expect(
      report.assembledOutput!.qualityGate.criticalFailures.some((f) =>
        f.message.includes("LLM self-graded"),
      ),
    ).toBe(false);
    expect(report.originalLlmDraft!.qualityGate.criticalFailures.length).toBe(
      1,
    );
  });

  it("GC01-style: LLM finance Critical retained in originalLlmDraft; F0 does not poison final Gate", async () => {
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      finance: {
        separationPreserved: true,
        doNotAuthorizePayment: true,
        forecastsLabeledAsNonAccounting: true,
        companyFinancialFeasibility: {
          liquidityConfirmed: false,
          blockingIfUnconfirmed: true,
        },
      },
      qualityGate: {
        passed: false,
        criticalFailures: [
          {
            code: "FINANCIAL_DEPENDENCY_UNRESOLVED",
            message: "Spurious LLM finance Critical",
          },
        ],
        warnings: [],
        evaluatedAt: NOW,
      },
      facts: {
        confirmed: [
          { id: "c1", text: "No immediate manning emergency at Nansha." },
        ],
        unverified: [],
        assumptions: [],
        missingInformation: [
          {
            id: "m1",
            text: "Exact Japanese port and ETA",
            who: "Ops",
            what: "Port/ETA",
            evidenceRequired: "Schedule",
            blocksReadiness: true,
          },
        ],
      },
    });

    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(spec, draft, {
      applyDecisionControl: true,
      nowIso: NOW,
      envelope: {
        title: spec.title,
        vessel: spec.vessel,
        pastedText: spec.inputFactsText,
        currentDecisionQuestion: getGoldenCaseCdq("GC01"),
      },
    });

    expect(report.originalLlmDraft!.qualityGate.criticalFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FINANCIAL_DEPENDENCY_UNRESOLVED",
        }),
      ]),
    );
    expect(report.originalLlmDraft!.finance).toBeTruthy();

    expect(
      report.qualityGate.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(false);

    expect(report.schemaValid).toBe(true);
    expect(report.assembledOutput!.qualityGate.passed).toBe(
      report.qualityGate.passed,
    );
  });

  it("final qualityGate exactly reflects Gate v1.1 output", async () => {
    const draft = baseDraft();
    const gate = evaluateQualityGateV1_1(
      subjectFromStructuredOutput(draft, { financeGateActive: false }),
    );
    const assembled = assembleCanonicalOutputV012(draft, gate);

    expect(assembled.qualityGate.passed).toBe(gate.passed);
    expect(assembled.qualityGate.criticalFailures).toEqual(
      gate.criticalFailures,
    );
    expect(assembled.qualityGate.warnings).toEqual(gate.warnings);
    expect(assembled.qualityGate.evaluatedAt).toBe(gate.evaluatedAt);
  });

  it("final readiness exactly reflects enforced Gate readiness", async () => {
    const draft = baseDraft({
      executive: {
        ...baseDraft().executive,
        decisionReadiness: "READY",
      },
    });
    const gate = evaluateQualityGateV1_1(
      subjectFromStructuredOutput(draft, { financeGateActive: false }),
    );
    const assembled = assembleCanonicalOutputV012(draft, gate);
    expect(assembled.executive.decisionReadiness).toBe(gate.enforcedReadiness);
  });

  it("Canonical validation occurs after final assembly (not on LLM QG)", async () => {
    const draft = baseDraft({
      executive: {
        ...baseDraft().executive,
        decisionReadiness: "READY",
      },
      qualityGate: {
        passed: false,
        criticalFailures: [
          {
            code: "CRITICAL_FACT_MISSING",
            message: "Would fail Canonical if validated before assembly",
          },
        ],
        warnings: [],
        evaluatedAt: NOW,
      },
    });
    expect(parseMddStructuredOutput(draft).success).toBe(false);

    const gate = evaluateQualityGateV1_1(
      subjectFromStructuredOutput(draft, { financeGateActive: false }),
    );
    const assembled = assembleCanonicalOutputV012(draft, gate);
    expect(parseMddStructuredOutput(assembled).success).toBe(true);

    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(spec, draft, {
      applyDecisionControl: false,
      nowIso: NOW,
    });
    expect(report.schemaValid).toBe(true);
    expect(report.notes).toBeUndefined();
  });

  it("original LLM qualityGate remains auditable", async () => {
    const llmQg = {
      passed: false as const,
      criticalFailures: [
        {
          code: "RECOMMENDATION_UNSUPPORTED" as const,
          message: "Draft-only finding",
        },
      ],
      warnings: [],
      evaluatedAt: NOW,
    };
    const draft = baseDraft({ qualityGate: llmQg });
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(spec, draft, {
      applyDecisionControl: true,
      nowIso: NOW,
    });

    expect(report.originalLlmDraft).toBeDefined();
    expect(report.originalLlmDraft!.qualityGate).toEqual(llmQg);
    expect(report.decisionControl?.originalLlmDraft.qualityGate).toEqual(llmQg);
  });
});
