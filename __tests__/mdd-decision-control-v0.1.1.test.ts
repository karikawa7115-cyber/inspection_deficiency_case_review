import { describe, expect, it } from "vitest";
import type { CaseEnvelope } from "@/lib/mdd/case-envelope/current-decision-question";
import { applyDecisionControlV01 } from "@/lib/mdd/decision-control";
import { getGoldenCaseCdq } from "@/lib/mdd/golden/cdq-envelopes";
import { runGoldenLlmEvalPipeline } from "@/lib/mdd/golden/llm-eval-v1";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import { evaluateQualityGateV1_1 } from "@/lib/mdd/quality-gate/evaluate-v1.1";
import { resolveFinanceGateActivation } from "@/lib/mdd/quality-gate/finance-activation-v1.1";
import {
  parseMddStructuredOutput,
  parseMddStructuredOutputStructural,
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
      decisionReadiness: "READY",
      decisionAuthorities: [
        {
          id: "a1",
          roleLabel: "Final management approval",
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
      missingInformation: [],
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

const spuriousFinance: NonNullable<MddStructuredOutput["finance"]> = {
  separationPreserved: true,
  doNotAuthorizePayment: true,
  forecastsLabeledAsNonAccounting: true,
  companyFinancialFeasibility: {
    liquidityConfirmed: false,
    blockingIfUnconfirmed: true,
    note: "Spurious LLM extension",
  },
};

describe("Decision Control / Pipeline v0.1.1 — P1 Finance Gate activation", () => {
  it("T-FIN-01: non-finance + spurious LLM finance → no Finance Critical (F0)", async () => {
    const act = resolveFinanceGateActivation({
      primaryCaseType: "CREW_MANNING",
      currentDecisionQuestion: getGoldenCaseCdq("GC01"),
      financeSourceInput: null,
      llmFinanceExtensionPresent: true,
    });
    expect(act.active).toBe(false);
    expect(act.spuriousLlmFinanceExtension).toBe(true);
    expect(act.reasons).toEqual([]);

    const gate = evaluateQualityGateV1_1({
      primaryCaseType: "CREW_MANNING",
      tags: ["crew_change"],
      decisionReadiness: "READY",
      recommendation: "Postpone crew change to Japan.",
      presidentDecision: "Approve postponement.",
      why: "No emergency at Nansha.",
      decisionAuthorities: [
        { roleLabel: "Final approval", authority: "President/DP" },
      ],
      nextActions: [{ who: "Ops", what: "Coordinate Japan ETA" }],
      confirmedTexts: ["Inoy cannot board"],
      unverifiedTexts: [],
      assumptionTexts: [],
      missing: [],
      risks: [],
      optionsCount: 1,
      professionalBoundaryIssues: [],
      learning: {
        managementReviewCandidate: false,
        internalAuditCandidate: false,
        knowledgeUpdateCandidate: false,
      },
      reviewCandidate: { flag: false },
      finance: {
        present: true,
        separationPreserved: true,
        liquidityConfirmed: false,
        doNotAuthorizePayment: true,
      },
      financeGateActive: act.active,
      impliesClosure: false,
    });

    expect(
      gate.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(false);
  });

  it("T-FIN-02: FINANCE_COMMERCIAL → Finance Gate activates (F1)", async () => {
    const act = resolveFinanceGateActivation({
      primaryCaseType: "FINANCE_COMMERCIAL",
      llmFinanceExtensionPresent: false,
    });
    expect(act.active).toBe(true);
    expect(act.reasons).toContain("F1");

    const gate = evaluateQualityGateV1_1({
      primaryCaseType: "FINANCE_COMMERCIAL",
      tags: ["ctm"],
      decisionReadiness: "READY",
      recommendation: "Remit CTM USD40,000 with liquidity assumed.",
      presidentDecision: "Approve remittance now.",
      why: "Need cash onboard; liquidity assumed current.",
      decisionAuthorities: [
        { roleLabel: "Funding approval", authority: "President/DP" },
      ],
      nextActions: [],
      confirmedTexts: [],
      unverifiedTexts: [],
      assumptionTexts: [],
      missing: [
        {
          text: "Company liquidity confirmation",
          who: "Finance",
          what: "Liquidity",
          evidenceRequired: "Bank confirmation",
          blocksReadiness: false,
        },
      ],
      risks: [],
      optionsCount: 1,
      professionalBoundaryIssues: [],
      learning: {
        managementReviewCandidate: false,
        internalAuditCandidate: false,
        knowledgeUpdateCandidate: false,
      },
      reviewCandidate: { flag: false },
      finance: {
        present: true,
        separationPreserved: true,
        liquidityConfirmed: false,
        doNotAuthorizePayment: true,
      },
      financeGateActive: act.active,
      impliesClosure: false,
    });

    expect(
      gate.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(true);
  });

  it("T-FIN-03: non-finance + funding CDQ → Finance Gate activates (F2)", async () => {
    const act = resolveFinanceGateActivation({
      primaryCaseType: "TECHNICAL",
      currentDecisionQuestion: {
        decisionRequiredNow:
          "Approve emergency purchase funding / remittance amount?",
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: [],
        decisionClass: "finance_funding_amount",
      },
      llmFinanceExtensionPresent: true,
    });
    expect(act.active).toBe(true);
    expect(act.reasons).toContain("F2");
    expect(act.spuriousLlmFinanceExtension).toBe(false);

    const gate = evaluateQualityGateV1_1({
      primaryCaseType: "TECHNICAL",
      tags: [],
      decisionReadiness: "READY",
      recommendation: "Approve funding subject to liquidity.",
      presidentDecision: "Approve remittance.",
      why: "CTM remittance needed; liquidity not confirmed.",
      decisionAuthorities: [
        { roleLabel: "Funding", authority: "President/DP" },
      ],
      nextActions: [],
      confirmedTexts: [],
      unverifiedTexts: [],
      assumptionTexts: [],
      missing: [],
      risks: [],
      optionsCount: 0,
      professionalBoundaryIssues: [],
      learning: {
        managementReviewCandidate: false,
        internalAuditCandidate: false,
        knowledgeUpdateCandidate: false,
      },
      reviewCandidate: { flag: false },
      finance: {
        present: true,
        separationPreserved: true,
        liquidityConfirmed: false,
        doNotAuthorizePayment: true,
      },
      financeGateActive: act.active,
      impliesClosure: false,
    });

    expect(
      gate.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(true);
  });

  it("T-FIN-04: non-finance + material financeSourceInput → F3 activates", async () => {
    const act = resolveFinanceGateActivation({
      primaryCaseType: "OPERATIONAL",
      currentDecisionQuestion: {
        decisionRequiredNow: "Confirm berth window only.",
        expectedDecider: "Ops Manager",
        deferredToExecutionOrClosure: ["Payment execution"],
      },
      financeSourceInput: {
        reportedShipFund: 4052.19,
        recommendedCtm: 40000,
        companyLiquidityConfirmed: false,
      },
      llmFinanceExtensionPresent: false,
    });
    expect(act.active).toBe(true);
    expect(act.reasons).toContain("F3");
  });

  it("T-FIN-05: Control annotates SPURIOUS_FINANCE_EXTENSION and retains finance", async () => {
    const envelope: CaseEnvelope = {
      title: "GC01",
      vessel: "PLUTO LEADER",
      currentDecisionQuestion: getGoldenCaseCdq("GC01"),
    };
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      finance: spuriousFinance,
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: null,
    });
    expect(result.applied).toBe(true);
    expect(result.controlled.finance).toBeTruthy();
    expect(
      result.findings.some((f) => f.code === "SPURIOUS_FINANCE_EXTENSION"),
    ).toBe(true);
  });
});

describe("Decision Control / Pipeline v0.1.1 — P2 two-stage validation", () => {
  it("T-VAL-01: MR=true/flag=false passes Pre-Control; fails Canonical without Control", async () => {
    const draft = baseDraft({
      learning: {
        ...baseDraft().learning,
        managementReviewCandidate: true,
      },
      reviewCandidate: { flag: false, retainAfterClose: false },
    });
    expect(parseMddStructuredOutputStructural(draft).success).toBe(true);
    expect(parseMddStructuredOutput(draft).success).toBe(false);
  });

  it("T-VAL-02 / finance+MR: Control filters unsupported MR (v0.2); Canonical OK without forcing Review", async () => {
    const envelope: CaseEnvelope = {
      title: "finance-shape",
      vessel: "TEST",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      learning: {
        ...baseDraft().learning,
        managementReviewCandidate: true,
      },
      reviewCandidate: { flag: false, retainAfterClose: false, monitorOnly: false },
      finance: {
        separationPreserved: true,
        doNotAuthorizePayment: true,
        forecastsLabeledAsNonAccounting: true,
        companyFinancialFeasibility: {
          liquidityConfirmed: false,
          blockingIfUnconfirmed: true,
        },
      },
    });

    expect(parseMddStructuredOutputStructural(draft).success).toBe(true);
    expect(parseMddStructuredOutput(draft).success).toBe(false);

    const ctrl = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: {
        reportedShipFund: 4052,
        recommendedCtm: 40000,
      },
      orgDefaults: { rcSmsOwner: null, shipFundOwner: null },
    });
    // v0.2: LLM MR alone must not force Review=true; assembled MR filtered
    expect(ctrl.controlled.reviewCandidate.flag).toBe(false);
    expect(ctrl.controlled.learning.managementReviewCandidate).toBe(false);
    expect(ctrl.originalLlmDraft.learning.managementReviewCandidate).toBe(true);
    expect(parseMddStructuredOutput(ctrl.controlled).success).toBe(true);
  });

  it("T-VAL-03: malformed structure rejected before Control", async () => {
    const bad = { schemaVersion: "1.0", primaryCaseType: "NOT_A_TYPE" };
    const structural = parseMddStructuredOutputStructural(bad);
    expect(structural.success).toBe(false);

    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const report = await runGoldenLlmEvalPipeline(spec, bad, {
      applyDecisionControl: true,
      nowIso: NOW,
    });
    expect(report.schemaValid).toBe(false);
    expect(report.notes).toMatch(/Pre-Control structural/i);
    expect(report.decisionControl).toBeUndefined();
  });

  it("T-VAL-04: Canonical still rejects READY + criticalFailures after Control", async () => {
    const envelope: CaseEnvelope = {
      title: "coherence",
      currentDecisionQuestion: getGoldenCaseCdq("GC01"),
    };
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
            message: "Missing fact",
          },
        ],
        warnings: [],
        evaluatedAt: NOW,
      },
    });
    expect(parseMddStructuredOutputStructural(draft).success).toBe(true);
    const ctrl = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
    });
    // Control may change readiness, but Canonical still enforces passed ↔ criticals
    const withMismatch = {
      ...ctrl.controlled,
      executive: {
        ...ctrl.controlled.executive,
        decisionReadiness: "READY" as const,
      },
      qualityGate: {
        passed: false,
        criticalFailures: [
          {
            code: "CRITICAL_FACT_MISSING" as const,
            message: "Still critical",
          },
        ],
        warnings: [],
        evaluatedAt: NOW,
      },
    };
    expect(parseMddStructuredOutput(withMismatch).success).toBe(false);
  });

  it("T-VAL-05: full pipeline structural → Control → Canonical → Gate (GC01 fixture)", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC01")!;
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      finance: spuriousFinance,
      executive: {
        ...baseDraft().executive,
        decisionReadiness: "CONDITIONAL",
        presidentDecision: {
          requiredNow: true,
          text: "Approve postponement of C/M change to Japan.",
        },
      },
    });
    const report = await runGoldenLlmEvalPipeline(spec, draft, {
      applyDecisionControl: true,
      nowIso: NOW,
    });
    expect(report.schemaValid).toBe(true);
    expect(report.decisionControl?.applied).toBe(true);
    expect(
      report.decisionControl?.findings.some(
        (f) => f.code === "SPURIOUS_FINANCE_EXTENSION",
      ),
    ).toBe(true);
    expect(
      report.qualityGate.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(false);
  });
});
