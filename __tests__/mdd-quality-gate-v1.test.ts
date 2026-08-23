import { describe, expect, it } from "vitest";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import {
  evaluateQualityGateV1,
  subjectFromProposal,
  type CriticalOverrideRecord,
} from "@/lib/mdd/quality-gate/evaluate-v1";

function evalGolden(id: "GC01" | "GC02" | "GC03" | "GC04") {
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
  const evaluation = evaluateQualityGateV1(
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
  return { spec, proposal, brief, evaluation };
}

describe("Quality Gate Rules v1.0 — Golden Cases", () => {
  it("GC01: READY, no criticals; finance gate skipped", () => {
    const { brief, evaluation } = evalGolden("GC01");
    expect(brief.decisionReadiness).toBe("READY");
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criticalFailures).toHaveLength(0);
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "FINANCIAL_DEPENDENCY_UNRESOLVED",
      ),
    ).toBe(false);
  });

  it("GC02: CONDITIONAL, no criticals when Class path preserved", () => {
    const { brief, evaluation } = evalGolden("GC02");
    expect(brief.decisionReadiness).toBe("CONDITIONAL");
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criticalFailures).toHaveLength(0);
  });

  it("GC03: CONDITIONAL; shallow RC warning not critical; MR implies review flag", () => {
    const { brief, evaluation } = evalGolden("GC03");
    expect(brief.decisionReadiness).toBe("CONDITIONAL");
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criticalFailures).toHaveLength(0);
    expect(
      evaluation.warnings.some((w) => w.code === "WARN_SHALLOW_ROOT_CAUSE"),
    ).toBe(true);
    expect(
      evaluation.warnings.some(
        (w) => w.code === "WARN_REVIEW_LEARNING_OPPORTUNITY",
      ),
    ).toBe(false);
  });

  it("GC04: CONDITIONAL; finance active; no critical while not READY", () => {
    const { brief, evaluation } = evalGolden("GC04");
    expect(brief.decisionReadiness).toBe("CONDITIONAL");
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criticalFailures).toHaveLength(0);
    expect(
      evaluation.warnings.some(
        (w) =>
          w.code === "WARN_STALE_OR_CURRENT_INFO" ||
          w.code === "WARN_OPTIONAL_EVIDENCE_MISSING",
      ),
    ).toBe(true);
  });
});

describe("Quality Gate Rules v1.0 — clarifications", () => {
  it("rejects READY when any critical failure exists", () => {
    const evaluation = evaluateQualityGateV1(
      subjectFromProposal({
        primaryCaseType: "FINANCE_COMMERCIAL",
        recommendation: "Remit CTM USD40,000 now.",
        presidentDecision: "Approve 40k.",
        why: "Liquidity assumed current.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          {
            roleLabel: "Final CTM",
            authority: "President/DP",
          },
        ],
        confirmedFacts: [{ text: "Target closing USD5,000." }],
        missingInformation: [
          {
            text: "Company liquidity",
            who: "Finance",
            what: "Current SMBC USD",
            evidenceRequired: "Cash confirmation",
          },
        ],
        financeSnapshot: { companyLiquidityConfirmed: false },
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

  it("Critical override does not clear findings or make READY", () => {
    const override: CriticalOverrideRecord = {
      overriddenCodes: ["FINANCIAL_DEPENDENCY_UNRESOLVED"],
      actor: "President/DP",
      at: "2026-08-23T00:00:00.000Z",
      justification: "Proceed with provisional remittance planning only.",
      proceedDespiteCritical: true,
      safetyComplianceAcknowledgement: true,
    };
    const evaluation = evaluateQualityGateV1(
      subjectFromProposal({
        primaryCaseType: "FINANCE_COMMERCIAL",
        recommendation: "Remit CTM USD40,000 now.",
        presidentDecision: "Approve 40k.",
        why: "Need cash onboard.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          { roleLabel: "Final CTM", authority: "President/DP" },
        ],
        confirmedFacts: [{ text: "Target closing USD5,000." }],
        financeSnapshot: { companyLiquidityConfirmed: false },
        override,
      }),
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.criticalFailures.length).toBeGreaterThan(0);
    expect(evaluation.enforcedReadiness).not.toBe("READY");
    expect(evaluation.proceedDespiteCritical).toBe(true);
  });

  it("does not escalate shallow RC for ordinary CREW_MANNING", () => {
    const evaluation = evaluateQualityGateV1(
      subjectFromProposal({
        primaryCaseType: "CREW_MANNING",
        recommendation: "Postpone crew change to Japan.",
        presidentDecision: "Approve postponement.",
        why: "No safety emergency; Nansha impractical.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          { roleLabel: "Final approval", authority: "President/DP" },
          { roleLabel: "Docs", authority: "Manning Agent" },
        ],
        confirmedFacts: [{ text: "Inoy cannot board at Nansha." }],
        unverifiedFacts: [{ text: "Human error in packing documents." }],
        nextActions: [
          { owner: "Manning Agent", text: "Follow up documents" },
        ],
      }),
    );
    expect(
      evaluation.warnings.some((w) => w.code === "WARN_SHALLOW_ROOT_CAUSE"),
    ).toBe(false);
    expect(
      evaluation.criticalFailures.some(
        (f) => f.code === "RECOMMENDATION_UNSUPPORTED",
      ),
    ).toBe(false);
  });

  it("escalates shallow RC to Critical when RC-required case claims READY without challenge", () => {
    const evaluation = evaluateQualityGateV1(
      subjectFromProposal({
        primaryCaseType: "INSPECTION_COMPLIANCE",
        tags: ["root_cause_required"],
        recommendation:
          "Close the case; root cause is inadequate checking and that is adequate.",
        presidentDecision: "Treat case as closed after photos.",
        why: "Items corrected.",
        decisionReadiness: "READY",
        decisionAuthorities: [
          { roleLabel: "Closure", authority: "President/DP" },
        ],
        confirmedFacts: [{ text: "IA deficiencies recorded." }],
        unverifiedFacts: [{ text: "Cause: insufficient checking." }],
      }),
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.enforcedReadiness).not.toBe("READY");
    expect(
      evaluation.criticalFailures.some(
        (f) =>
          f.code === "RECOMMENDATION_UNSUPPORTED" ||
          f.code === "SAFETY_OR_COMPLIANCE_UNRESOLVED" ||
          f.code === "PROFESSIONAL_BOUNDARY_VIOLATION",
      ),
    ).toBe(true);
  });
});
