import { describe, expect, it } from "vitest";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import { injectQualityGateEvaluatedAt } from "@/lib/mdd/quality-gate/evaluated-at";
import {
  classifyMissingInformationStage,
  evaluateQualityGateV1_1,
  subjectFromProposal,
  subjectFromStructuredOutput,
} from "@/lib/mdd/quality-gate/evaluate-v1.1";
import { parseMddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";
import type { MddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";

function evalGoldenHeuristic(id: "GC01" | "GC02" | "GC03" | "GC04") {
  const spec = GOLDEN_CASE_SPECS.find((s) => s.id === id)!;
  const proposal = proposeFromHeuristics({
    title: spec.title,
    vessel: spec.vessel,
    pastedText: spec.inputFactsText,
    goldenCaseId: id,
    financeSnapshot: spec.financeSnapshot,
  });
  const brief = applyGateToBrief(proposal, {
    reviewCandidateFlag: id === "GC03",
  });
  const evaluation = evaluateQualityGateV1_1(
    subjectFromProposal({
      primaryCaseType: proposal.primaryCaseType,
      tags: proposal.tags,
      recommendation: proposal.brief.recommendation,
      presidentDecision: proposal.brief.presidentDecision,
      why: proposal.brief.why,
      decisionReadiness: proposal.brief.decisionReadiness,
      decisionAuthorities: proposal.brief.decisionAuthorities.map((a) => ({
        roleLabel: a.roleLabel,
        authority: String(a.authority),
      })),
      nextActions: proposal.brief.nextActions.map((a) => ({
        owner: a.owner,
        text: a.text,
        dueDate: a.dueDate,
      })),
      confirmedFacts: proposal.brief.confirmedFacts,
      unverifiedFacts: proposal.brief.unverifiedFacts,
      assumptions: proposal.brief.assumptions,
      missingInformation: proposal.brief.missingInformation,
      learning: {
        managementReviewCandidate:
          proposal.brief.learning.managementReviewCandidate,
        internalAuditCandidate: proposal.brief.learning.internalAuditCandidate,
        knowledgeUpdateCandidate:
          proposal.brief.learning.knowledgeUpdateCandidate,
        notes: proposal.brief.learning.notes,
      },
      reviewCandidateFlag: id === "GC03",
      financeSnapshot: spec.financeSnapshot,
    }),
  );
  return { spec, brief, evaluation };
}

describe("Quality Gate Rules v1.1 candidate — stage classification", () => {
  it("classifies ClassNK focused confirmation as EXECUTION_CONDITION", () => {
    expect(
      classifyMissingInformationStage({
        text: "Confirmation from ClassNK regarding validity of proposed technical handling and scope of acceptance for CMS items.",
        who: "ClassNK",
        what: "Focused written clarification",
        evidenceRequired: "Written ClassNK response",
        blocksReadiness: true,
      }),
    ).toBe("EXECUTION_CONDITION");
  });

  it("classifies root cause / horizontal / effectiveness as CLOSURE_OR_EFFECTIVENESS_CONDITION", () => {
    expect(
      classifyMissingInformationStage(
        {
          text: "Confirmation of corrective actions and effectiveness verification for identified deficiencies.",
          who: "Master",
          what: "Root cause challenge + horizontal check evidence",
          evidenceRequired: "Effectiveness verification record",
          blocksReadiness: true,
        },
        { primaryCaseType: "INSPECTION_COMPLIANCE", tags: ["root_cause_required"] },
      ),
    ).toBe("CLOSURE_OR_EFFECTIVENESS_CONDITION");
  });

  it("classifies Company liquidity confirmation as EXECUTION_CONDITION", () => {
    expect(
      classifyMissingInformationStage(
        {
          text: "Confirmation of company liquidity status is required.",
          who: "Finance/Accounting",
          what: "Current Company USD liquidity before CTM remittance",
          evidenceRequired: "Current cash confirmation",
          blocksReadiness: true,
        },
        { primaryCaseType: "FINANCE_COMMERCIAL" },
      ),
    ).toBe("EXECUTION_CONDITION");
  });

  it("keeps truly decision-blocking gaps as DECISION_BLOCKING", () => {
    expect(
      classifyMissingInformationStage({
        text: "Cannot decide whether a safety emergency requires immediate replacement.",
        who: "Master",
        what: "Safety emergency determination",
        evidenceRequired: "Master safety assessment",
        blocksReadiness: true,
      }),
    ).toBe("DECISION_BLOCKING");
  });
});

describe("Quality Gate Rules v1.1 candidate — GC readiness alignment", () => {
  it("GC01: READY, no criticals", () => {
    const { brief, evaluation } = evalGoldenHeuristic("GC01");
    expect(brief.decisionReadiness).toBe("READY");
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criticalFailures).toHaveLength(0);
    expect(evaluation.enforcedReadiness).toBe("READY");
    expect(evaluation.evaluatedAt.length).toBeGreaterThan(0);
  });

  it("GC02: CONDITIONAL; ClassNK missing with blocksReadiness does not Critical", () => {
    const withHint = evaluateQualityGateV1_1({
      ...subjectFromProposal({
        primaryCaseType: "TECHNICAL",
        tags: ["fairwind", "class_nk"],
        recommendation:
          "Maintain current handling plan subject to one focused ClassNK re-confirmation.",
        presidentDecision:
          "Approve continued approach pending focused ClassNK clarification.",
        why: "Prior ClassNK advice favorable.",
        decisionReadiness: "CONDITIONAL",
        decisionAuthorities: [
          { roleLabel: "Technical handling", authority: "Superintendent" },
          { roleLabel: "Class confirmation", authority: "Class" },
        ],
        confirmedFacts: [{ text: "Prior favorable ClassNK response." }],
        missingInformation: [
          {
            text: "Confirmation from ClassNK regarding CMS acceptance scope.",
            who: "ClassNK",
            what: "Focused confirmation",
            evidenceRequired: "Written reply",
          },
        ],
      }),
      missing: [
        {
          text: "Confirmation from ClassNK regarding the validity of the proposed technical handling and scope of acceptance for the CMS items.",
          who: "ClassNK",
          what: "Focused confirmation",
          evidenceRequired: "Written ClassNK response",
          blocksReadiness: true,
        },
      ],
    });

    expect(withHint.passed).toBe(true);
    expect(withHint.enforcedReadiness).toBe("CONDITIONAL");
    expect(
      withHint.criticalFailures.some((f) => f.code === "CRITICAL_FACT_MISSING"),
    ).toBe(false);
    expect(
      withHint.missingClassifications.every(
        (c) => c.stage === "EXECUTION_CONDITION",
      ),
    ).toBe(true);

    const { evaluation: heuristic } = evalGoldenHeuristic("GC02");
    expect(heuristic.enforcedReadiness).toBe("CONDITIONAL");
    expect(heuristic.passed).toBe(true);
  });

  it("GC03: CONDITIONAL; RC/horizontal/effectiveness missing is not automatic NOT_READY", () => {
    const evaluation = evaluateQualityGateV1_1({
      ...subjectFromProposal({
        primaryCaseType: "INSPECTION_COMPLIANCE",
        tags: [
          "orbit",
          "root_cause_required",
          "horizontal_check",
          "effectiveness_verification",
        ],
        recommendation:
          "Continue rectification; challenge shallow root causes; do not close on photos.",
        presidentDecision:
          "Keep CONDITIONAL; require Tech Supt path for earth fault; challenge RC.",
        why: "Direction clear; closure awaits effectiveness and horizontal check.",
        decisionReadiness: "NOT_READY",
        decisionAuthorities: [
          { roleLabel: "Rectification", authority: "Master" },
          { roleLabel: "Technical verification", authority: "Superintendent" },
          { roleLabel: "Flag/IA follow-up", authority: "Flag Administration" },
        ],
        confirmedFacts: [{ text: "IA deficiencies recorded." }],
        unverifiedFacts: [{ text: "Cause stated as insufficient checking." }],
        missingInformation: [
          {
            text: "Confirmation of the corrective actions taken for the identified deficiencies.",
            who: "Master",
            what: "Corrective action + effectiveness evidence",
            evidenceRequired: "Effectiveness verification",
          },
        ],
        learning: {
          managementReviewCandidate: true,
          internalAuditCandidate: true,
          knowledgeUpdateCandidate: false,
        },
        reviewCandidateFlag: true,
      }),
      missing: [
        {
          text: "Root cause challenge evidence, horizontal check, and effectiveness verification remain open.",
          who: "Master",
          what: "Closure/effectiveness package",
          evidenceRequired: "Verified corrective + horizontal evidence",
          blocksReadiness: true,
        },
      ],
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.enforcedReadiness).toBe("CONDITIONAL");
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "CRITICAL_FACT_MISSING",
      ),
    ).toBe(false);
    expect(
      evaluation.missingClassifications[0]?.stage,
    ).toBe("CLOSURE_OR_EFFECTIVENESS_CONDITION");

    const { evaluation: heuristic } = evalGoldenHeuristic("GC03");
    expect(heuristic.enforcedReadiness).toBe("CONDITIONAL");
    expect(heuristic.passed).toBe(true);
  });

  it("GC04: CONDITIONAL; liquidity confirmation is EXECUTION_CONDITION not Critical", () => {
    const evaluation = evaluateQualityGateV1_1({
      ...subjectFromProposal({
        primaryCaseType: "FINANCE_COMMERCIAL",
        recommendation:
          "Prefer CTM USD40,000 subject to Company liquidity; Necessary ≠ Affordable.",
        presidentDecision:
          "Approve operational preference for 40k CONDITIONAL on current liquidity confirmation.",
        why: "Vessel-side requirement clear; remittance awaits liquidity check.",
        decisionReadiness: "CONDITIONAL",
        decisionAuthorities: [
          { roleLabel: "Final CTM", authority: "President/DP" },
          { roleLabel: "Liquidity check", authority: "Finance/Accounting" },
        ],
        confirmedFacts: [{ text: "Target closing USD5,000; recovery CTM 40k." }],
        missingInformation: [
          {
            text: "Confirmation of company liquidity status is required.",
            who: "Finance/Accounting",
            what: "Current Company liquidity",
            evidenceRequired: "Cash confirmation near remittance",
          },
        ],
        financeSnapshot: { companyLiquidityConfirmed: false },
      }),
      missing: [
        {
          text: "Confirmation of company liquidity status is required.",
          who: "Finance/Accounting",
          what: "Current Company liquidity before final CTM remittance",
          evidenceRequired: "Current cash confirmation",
          blocksReadiness: true,
        },
      ],
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.enforcedReadiness).toBe("CONDITIONAL");
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "CRITICAL_FACT_MISSING",
      ),
    ).toBe(false);
    expect(
      evaluation.missingClassifications.every(
        (c) => c.stage === "EXECUTION_CONDITION",
      ),
    ).toBe(true);

    const { evaluation: heuristic } = evalGoldenHeuristic("GC04");
    expect(heuristic.enforcedReadiness).toBe("CONDITIONAL");
    expect(heuristic.passed).toBe(true);
  });

  it("decision-blocking missing still yields Critical / NOT_READY", () => {
    const evaluation = evaluateQualityGateV1_1(
      subjectFromProposal({
        primaryCaseType: "OPERATIONAL",
        recommendation: "Await further facts before any direction.",
        presidentDecision: "No decision yet.",
        why: "Cannot decide whether a safety emergency requires immediate action.",
        decisionReadiness: "NOT_READY",
        decisionAuthorities: [
          { roleLabel: "Decision", authority: "President/DP" },
        ],
        missingInformation: [
          {
            text: "Cannot decide whether a safety emergency requires immediate replacement.",
            who: "Master",
            what: "Safety determination",
            evidenceRequired: "Master assessment",
          },
        ],
      }),
    );
    expect(evaluation.passed).toBe(false);
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "CRITICAL_FACT_MISSING",
      ),
    ).toBe(true);
    expect(evaluation.enforcedReadiness).not.toBe("READY");
  });

  it("READY + unconfirmed liquidity still Critical via FINANCIAL_DEPENDENCY", () => {
    const evaluation = evaluateQualityGateV1_1(
      subjectFromProposal({
        primaryCaseType: "FINANCE_COMMERCIAL",
        recommendation: "Remit CTM USD40,000 now with current liquidity assumed.",
        presidentDecision: "Approve 40k READY.",
        why: "Need cash onboard; liquidity assumed current.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          { roleLabel: "Final CTM", authority: "President/DP" },
        ],
        financeSnapshot: { companyLiquidityConfirmed: false },
        missingInformation: [
          {
            text: "Company liquidity confirmation",
            who: "Finance",
            what: "Current SMBC USD",
            evidenceRequired: "Cash confirmation",
          },
        ],
      }),
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.enforcedReadiness).not.toBe("READY");
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(true);
  });

  it("ordinary non-material port/ETA warning does not downgrade READY", () => {
    const evaluation = evaluateQualityGateV1_1(
      subjectFromProposal({
        primaryCaseType: "CREW_MANNING",
        recommendation: "Postpone crew change to Japan; no safety emergency.",
        presidentDecision: "Approve postponement to Japan Voy.071.",
        why: "Nansha impractical; continuity onboard acceptable.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          { roleLabel: "Final approval", authority: "President/DP" },
          { roleLabel: "Docs", authority: "Manning Agent" },
        ],
        confirmedFacts: [
          { text: "No immediate Safety or Minimum Safe Manning emergency." },
        ],
        missingInformation: [
          {
            text: "Exact Japanese port / ETA not yet finally fixed.",
            who: "Ops",
            what: "Port/ETA",
            evidenceRequired: "Voyage schedule update",
          },
        ],
        nextActions: [
          { owner: "Manning Agent", text: "Follow up Inoy documents" },
        ],
      }),
    );
    expect(evaluation.passed).toBe(true);
    expect(evaluation.enforcedReadiness).toBe("READY");
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "CRITICAL_FACT_MISSING",
      ),
    ).toBe(false);
  });
});

describe("evaluatedAt ownership (v1.1 §10)", () => {
  it("injects system timestamp without altering decision fields", () => {
    const base = {
      schemaVersion: "1.0",
      primaryCaseType: "CREW_MANNING",
      tags: [],
      executive: {
        recommendation: { text: "Postpone to Japan." },
        presidentDecision: { text: "Approve postponement.", requiredNow: true },
        decisionReadiness: "READY",
        decisionAuthorities: [
          {
            id: "a1",
            roleLabel: "Final approval",
            authority: "President/DP",
            status: "pending",
          },
        ],
        why: { text: "No safety emergency." },
        nextActions: [],
      },
      facts: {
        confirmed: [{ id: "f1", text: "No immediate manning emergency." }],
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
        evaluatedAt: "",
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
    } satisfies MddStructuredOutput;

    const before = parseMddStructuredOutput(base);
    expect(before.success).toBe(false);

    const injected = injectQualityGateEvaluatedAt(
      base,
      "2026-08-23T00:00:00.000Z",
    );
    const after = parseMddStructuredOutput(injected);
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.data.qualityGate.evaluatedAt).toBe(
        "2026-08-23T00:00:00.000Z",
      );
      expect(after.data.executive.decisionReadiness).toBe("READY");
      expect(after.data.executive.recommendation.text).toBe(
        "Postpone to Japan.",
      );
    }

    const gate = evaluateQualityGateV1_1(
      subjectFromStructuredOutput(after.success ? after.data : base),
    );
    expect(gate.evaluatedAt.length).toBeGreaterThan(0);
  });
});
