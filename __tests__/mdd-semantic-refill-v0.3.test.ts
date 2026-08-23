import { describe, expect, it } from "vitest";
import type { CaseEnvelope } from "@/lib/mdd/case-envelope/current-decision-question";
import { applyDecisionControlV01 } from "@/lib/mdd/decision-control";
import { getGoldenCaseCdq } from "@/lib/mdd/golden/cdq-envelopes";
import { runGoldenLlmEvalPipeline } from "@/lib/mdd/golden/llm-eval-v1";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import type { MddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";
import {
  applySemanticRefillV03,
  buildSemanticRefillPayload,
  shouldTriggerSemanticRefillV03,
  validatePresidentDecisionRefill,
} from "@/lib/mdd/semantic-refill";

const NOW = "2026-08-23T12:00:00.000Z";
const MODEL = "gpt-4o-mini";

function baseDraft(
  overrides: Partial<MddStructuredOutput> = {},
): MddStructuredOutput {
  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: "TECHNICAL",
    tags: ["fairwind"],
    executive: {
      recommendation: {
        text: "Maintain the current CMS handling plan subject to focused ClassNK re-confirmation and clarification; do not abandon without evidence.",
      },
      presidentDecision: {
        text: "Not required at this stage.",
        requiredNow: false,
      },
      decisionReadiness: "CONDITIONAL",
      decisionAuthorities: [
        {
          id: "a1",
          roleLabel: "Technical assessment",
          authority: "Superintendent",
          status: "pending",
        },
        {
          id: "a2",
          roleLabel: "Class acceptance",
          authority: "Other",
          authorityDetail: "ClassNK",
          status: "pending",
        },
        {
          id: "a3",
          roleLabel: "Final management confirmation",
          authority: "President/DP",
          status: "pending",
        },
      ],
      why: { text: "Prior favorable ClassNK; one concern needs re-confirm." },
      nextActions: [
        {
          id: "n1",
          who: "Superintendent",
          what: "Formulate focused ClassNK clarification request",
          status: "open",
        },
      ],
    },
    facts: {
      confirmed: [
        { id: "f1", text: "Prior favorable ClassNK indication recorded." },
      ],
      unverified: [
        { id: "u1", text: "Item coverage of concern remains unverified." },
      ],
      assumptions: [],
      missingInformation: [
        {
          id: "m1",
          text: "Written Class clarification",
          who: "ClassNK",
          what: "Focused written confirmation of item scope",
          evidenceRequired: "Class written reply",
          blocksReadiness: true,
        },
      ],
    },
    risks: [],
    options: [],
    professionalBoundaries: [
      {
        id: "pb1",
        domain: "Class",
        issue: "Must not state Class acceptance for all items as definite",
        responsibleAuthority: "Superintendent",
      },
    ],
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
    professionalBoundaries:
      overrides.professionalBoundaries ?? base.professionalBoundaries,
  };
}

function gc02Envelope(): CaseEnvelope {
  return {
    title: "FAIRWIND NK CMS",
    vessel: "FAIRWIND",
    currentDecisionQuestion: getGoldenCaseCdq("GC02"),
  };
}

function afterControl() {
  return applyDecisionControlV01({
    envelope: gc02Envelope(),
    llmDraft: baseDraft(),
    nowIso: NOW,
  });
}

const GOOD_PD =
  "Maintain the current CMS handling plan subject to focused ClassNK re-confirmation; President confirms management stance only.";

describe("Semantic Refill v0.3 — trigger", () => {
  it("trigger true when NSF + requiredNow + not-required prose", () => {
    const ctrl = afterControl();
    expect(ctrl.needsSemanticFill).toBe(true);
    const t = shouldTriggerSemanticRefillV03({
      needsSemanticFill: ctrl.needsSemanticFill,
      controlled: ctrl.controlled,
      envelope: gc02Envelope(),
    });
    expect(t.trigger).toBe(true);
    expect(t.defectClass).toBe("not_required");
  });

  it("trigger false when NSF false", () => {
    const ctrl = afterControl();
    const t = shouldTriggerSemanticRefillV03({
      needsSemanticFill: false,
      controlled: {
        ...ctrl.controlled,
        executive: {
          ...ctrl.controlled.executive,
          presidentDecision: { text: GOOD_PD, requiredNow: true },
        },
      },
      envelope: gc02Envelope(),
    });
    expect(t.trigger).toBe(false);
  });

  it("trigger false when requiredNow false", () => {
    const draft = baseDraft({
      primaryCaseType: "OPERATIONAL",
      executive: {
        ...baseDraft().executive,
        presidentDecision: {
          text: "Not required at this stage.",
          requiredNow: false,
        },
        decisionAuthorities: [
          {
            id: "a1",
            roleLabel: "Ops",
            authority: "Master",
            status: "pending",
          },
        ],
      },
    });
    const ctrl = applyDecisionControlV01({
      envelope: {
        title: "t",
        currentDecisionQuestion: {
          decisionRequiredNow: "Routine ops note",
          expectedDecider: "Master",
          deferredToExecutionOrClosure: [],
          decisionClass: "generic",
        },
      },
      llmDraft: draft,
      nowIso: NOW,
    });
    expect(ctrl.needsSemanticFill).toBe(false);
    const t = shouldTriggerSemanticRefillV03({
      needsSemanticFill: ctrl.needsSemanticFill,
      controlled: ctrl.controlled,
      envelope: {
        title: "t",
        currentDecisionQuestion: {
          decisionRequiredNow: "Routine ops note",
          expectedDecider: "Master",
          deferredToExecutionOrClosure: [],
          decisionClass: "generic",
        },
      },
    });
    expect(t.trigger).toBe(false);
  });
});

describe("Semantic Refill v0.3 — accept / reject / NSF", () => {
  it("accepted refill writes PD only, clears NSF, preserves original in audit", () => {
    const ctrl = afterControl();
    const originalText = ctrl.controlled.executive.presidentDecision.text;
    const beforeJson = JSON.stringify({
      ...ctrl.controlled,
      executive: {
        ...ctrl.controlled.executive,
        presidentDecision: undefined,
      },
    });

    const result = applySemanticRefillV03({
      envelope: gc02Envelope(),
      controlled: ctrl.controlled,
      findings: ctrl.findings,
      needsSemanticFill: true,
      proposedText: GOOD_PD,
      model: MODEL,
      nowIso: NOW,
    });

    expect(result.triggered).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.needsSemanticFill).toBe(false);
    expect(result.findings.some((f) => f.code === "NEEDS_SEMANTIC_FILL")).toBe(
      false,
    );
    expect(
      result.findings.some((f) => f.code === "SEMANTIC_REFILL_APPLIED"),
    ).toBe(true);
    expect(result.controlled.executive.presidentDecision.text).toBe(GOOD_PD);
    expect(result.controlled.executive.presidentDecision.requiredNow).toBe(true);
    expect(result.audit.originalLlmPresidentDecision.text).toBe(originalText);
    expect(result.audit.refillOutput?.text).toBe(GOOD_PD);
    expect(result.audit.validationResult).toBe("accepted");
    expect(result.audit.model).toBe(MODEL);

    const afterJson = JSON.stringify({
      ...result.controlled,
      executive: {
        ...result.controlled.executive,
        presidentDecision: undefined,
      },
    });
    expect(afterJson).toBe(beforeJson);
  });

  it("rejected not-required refill keeps original + NSF", () => {
    const ctrl = afterControl();
    const original = ctrl.controlled.executive.presidentDecision.text;
    const result = applySemanticRefillV03({
      envelope: gc02Envelope(),
      controlled: ctrl.controlled,
      findings: ctrl.findings,
      needsSemanticFill: true,
      proposedText: "President Decision: Not required at this stage.",
      model: MODEL,
      nowIso: NOW,
    });
    expect(result.applied).toBe(false);
    expect(result.needsSemanticFill).toBe(true);
    expect(result.findings.some((f) => f.code === "NEEDS_SEMANTIC_FILL")).toBe(
      true,
    );
    expect(
      result.findings.some((f) => f.code === "SEMANTIC_REFILL_REJECTED"),
    ).toBe(true);
    expect(result.controlled.executive.presidentDecision.text).toBe(original);
    expect(result.audit.validationCodes).toContain("STILL_NOT_REQUIRED");
    expect(result.audit.refillOutput?.text).toContain("Not required");
  });

  it("rejects deferred-item as current decision", () => {
    const ctrl = afterControl();
    const cdq = getGoldenCaseCdq("GC02");
    const deferred = cdq.deferredToExecutionOrClosure[0]!;
    const bad = `Decide and finalize now: ${deferred}`;
    const candidate = structuredClone(ctrl.controlled);
    candidate.executive.presidentDecision.text = bad;
    const v = validatePresidentDecisionRefill({
      proposedText: bad,
      cdq,
      controlled: ctrl.controlled,
      candidateDraft: candidate,
    });
    expect(v.accepted).toBe(false);
    expect(v.codes).toContain("DEFERRED_AS_CURRENT");
  });

  it("rejects Professional Boundary violation", () => {
    const ctrl = afterControl();
    const bad =
      "ClassNK has approved everything; Class acceptance is definite for all CMS items.";
    const candidate = structuredClone(ctrl.controlled);
    candidate.executive.presidentDecision.text = bad;
    const v = validatePresidentDecisionRefill({
      proposedText: bad,
      cdq: getGoldenCaseCdq("GC02"),
      controlled: ctrl.controlled,
      candidateDraft: candidate,
    });
    expect(v.accepted).toBe(false);
    expect(
      v.codes.some(
        (c) =>
          c === "PROFESSIONAL_BOUNDARY" ||
          c === "UNSUPPORTED_TECHNICAL_INVENTION",
      ),
    ).toBe(true);
  });

  it("rejects recommendation contradiction", () => {
    const ctrl = afterControl();
    const bad = "Abandon the CMS handling plan immediately.";
    const candidate = structuredClone(ctrl.controlled);
    candidate.executive.presidentDecision.text = bad;
    const v = validatePresidentDecisionRefill({
      proposedText: bad,
      cdq: getGoldenCaseCdq("GC02"),
      controlled: ctrl.controlled,
      candidateDraft: candidate,
    });
    expect(v.accepted).toBe(false);
    expect(
      v.codes.some(
        (c) => c === "RECOMMENDATION_CONTRADICTION" || c === "CDQ_CONTRADICTION",
      ),
    ).toBe(true);
  });

  it("rejects unsupported technical invention", () => {
    const ctrl = afterControl();
    const bad = "ClassNK has approved all CMS items; proceed as fully accepted.";
    const result = applySemanticRefillV03({
      envelope: gc02Envelope(),
      controlled: ctrl.controlled,
      findings: ctrl.findings,
      needsSemanticFill: true,
      proposedText: bad,
      model: MODEL,
      nowIso: NOW,
    });
    expect(result.applied).toBe(false);
    expect(result.needsSemanticFill).toBe(true);
    expect(result.audit.validationCodes).toContain(
      "UNSUPPORTED_TECHNICAL_INVENTION",
    );
  });

  it("rejects unsupported financial invention", () => {
    const envelope: CaseEnvelope = {
      title: "CTM",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      executive: {
        ...baseDraft().executive,
        recommendation: {
          text: "Prefer CTM USD40,000 subject to Company liquidity; Necessary ≠ Affordable.",
        },
        presidentDecision: {
          text: "Not required at this stage.",
          requiredNow: false,
        },
      },
      professionalBoundaries: [
        {
          id: "pb",
          domain: "Other",
          issue: "Must not authorize payment without liquidity confirmation",
          responsibleAuthority: "President/DP",
        },
      ],
    });
    const ctrl = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { recommendedCtm: 40000 },
    });
    const bad =
      "Approve CTM USD40,000 now; company liquidity is confirmed and company can afford it; authorize remittance.";
    const result = applySemanticRefillV03({
      envelope,
      controlled: ctrl.controlled,
      findings: ctrl.findings,
      needsSemanticFill: true,
      proposedText: bad,
      model: MODEL,
      nowIso: NOW,
    });
    expect(result.applied).toBe(false);
    expect(result.audit.validationCodes).toContain(
      "UNSUPPORTED_FINANCIAL_INVENTION",
    );
  });

  it("idempotent: second accepted apply with same text is stable", () => {
    const ctrl = afterControl();
    const first = applySemanticRefillV03({
      envelope: gc02Envelope(),
      controlled: ctrl.controlled,
      findings: ctrl.findings,
      needsSemanticFill: true,
      proposedText: GOOD_PD,
      model: MODEL,
      nowIso: NOW,
    });
    const second = applySemanticRefillV03({
      envelope: gc02Envelope(),
      controlled: first.controlled,
      findings: first.findings,
      needsSemanticFill: first.needsSemanticFill,
      proposedText: GOOD_PD,
      model: MODEL,
      nowIso: NOW,
    });
    // NSF already cleared → not triggered again
    expect(second.triggered).toBe(false);
    expect(second.controlled.executive.presidentDecision.text).toBe(GOOD_PD);
    expect(JSON.stringify(second.controlled)).toBe(
      JSON.stringify(first.controlled),
    );
  });
});

describe("Semantic Refill v0.3 — allowlist / pipeline wiring", () => {
  it("payload excludes readiness, review, learning, qualityGate", () => {
    const ctrl = afterControl();
    const payload = buildSemanticRefillPayload({
      envelope: gc02Envelope(),
      controlled: ctrl.controlled,
      defectClass: "not_required",
    });
    const raw = JSON.stringify(payload);
    expect(raw).not.toMatch(/decisionReadiness/);
    expect(raw).not.toMatch(/qualityGate/);
    expect(raw).not.toMatch(/reviewCandidate/);
    expect(raw).not.toMatch(/knowledgeUpdateCandidate/);
    expect(raw).not.toMatch(/managementReviewCandidate/);
    expect(payload.currentDecisionQuestion.decisionRequiredNow).toBeTruthy();
    expect(payload.recommendation.text).toBeTruthy();
  });

  it("pipeline applies injected refill before Gate and clears NSF", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC02")!;
    const report = await runGoldenLlmEvalPipeline(spec, baseDraft(), {
      applyDecisionControl: true,
      applySemanticRefill: true,
      semanticRefillProposedText: GOOD_PD,
      semanticRefillModel: MODEL,
      nowIso: NOW,
      envelope: gc02Envelope(),
    });
    expect(report.decisionControl?.needsSemanticFill).toBe(false);
    expect(
      report.decisionControl?.findings.some(
        (f) => f.code === "SEMANTIC_REFILL_APPLIED",
      ),
    ).toBe(true);
    expect(
      report.decisionControl?.controlled.executive.presidentDecision.text,
    ).toBe(GOOD_PD);
    expect(report.semanticRefill?.validationResult).toBe("accepted");
    expect(report.semanticRefill?.originalLlmPresidentDecision.text).toMatch(
      /not required/i,
    );
    expect(report.schemaValid).toBe(true);
  });

  it("pipeline keeps NSF when injected refill is rejected", async () => {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === "GC02")!;
    const report = await runGoldenLlmEvalPipeline(spec, baseDraft(), {
      applyDecisionControl: true,
      applySemanticRefill: true,
      semanticRefillProposedText: "Not required at this stage.",
      semanticRefillModel: MODEL,
      nowIso: NOW,
      envelope: gc02Envelope(),
    });
    expect(report.decisionControl?.needsSemanticFill).toBe(true);
    expect(
      report.decisionControl?.findings.some(
        (f) => f.code === "NEEDS_SEMANTIC_FILL",
      ),
    ).toBe(true);
    expect(report.semanticRefill?.validationResult).toBe("rejected");
    expect(
      report.decisionControl?.controlled.executive.presidentDecision.text,
    ).toMatch(/not required/i);
  });
});
