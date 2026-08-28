import { describe, expect, it } from "vitest";
import type { CaseEnvelope } from "@/lib/mdd/case-envelope/current-decision-question";
import {
  applyDecisionControlV01,
  applyDecisionControlV01IdempotentCheck,
  DECISION_CONTROL_VERSION,
} from "@/lib/mdd/decision-control";
import { getGoldenCaseCdq } from "@/lib/mdd/golden/cdq-envelopes";
import type { MddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";

const NOW = "2026-08-23T10:00:00.000Z";

function baseDraft(
  overrides: Partial<MddStructuredOutput> = {},
): MddStructuredOutput {
  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: "OPERATIONAL",
    tags: [],
    executive: {
      recommendation: { text: "Proceed with the proposed direction." },
      presidentDecision: {
        text: "President Decision: Not required at this stage.",
        requiredNow: false,
      },
      decisionReadiness: "CONDITIONAL",
      decisionAuthorities: [
        {
          id: "a1",
          roleLabel: "Case owner",
          authority: "Other",
          status: "pending",
        },
      ],
      why: { text: "Based on supplied facts." },
      nextActions: [],
    },
    facts: {
      confirmed: [{ id: "f1", text: "Case facts recorded." }],
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
  };
}

describe("Decision Control v0.1", () => {
  it("emits CDQ_REQUIRED and does not invent CDQ when missing", () => {
    const draft = baseDraft();
    const result = applyDecisionControlV01({
      envelope: { title: "Legacy case" },
      llmDraft: draft,
      nowIso: NOW,
      requireCdq: true,
    });
    expect(result.applied).toBe(false);
    expect(result.findings.some((f) => f.code === "CDQ_REQUIRED")).toBe(true);
    expect(result.controlled).toEqual(result.originalLlmDraft);
    expect(result.audit).toHaveLength(0);
  });

  it("is deterministic and idempotent (no duplicate authorities/tags/audit growth)", () => {
    const envelope: CaseEnvelope = {
      title: "PLUTO LEADER — C/M Inoy Crew Change",
      vessel: "PLUTO LEADER",
      currentDecisionQuestion: getGoldenCaseCdq("GC01"),
    };
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      executive: {
        ...baseDraft().executive,
        decisionReadiness: "CONDITIONAL",
        presidentDecision: {
          text: "President Decision: Not required at this stage.",
          requiredNow: false,
        },
      },
      facts: {
        confirmed: [{ id: "f1", text: "No immediate manning emergency." }],
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
    const check = applyDecisionControlV01IdempotentCheck({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
    });
    expect(check.controlledEqual).toBe(true);
    expect(check.authorityCountStable).toBe(true);
    expect(check.tagCountStable).toBe(true);
    expect(check.first.controlVersion).toBe(DECISION_CONTROL_VERSION);
  });

  it("records audit for every intervention without silent overwrite of President text", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "t",
        vessel: "PLUTO LEADER",
        currentDecisionQuestion: getGoldenCaseCdq("GC01"),
      },
      llmDraft: baseDraft({
        primaryCaseType: "CREW_MANNING",
        executive: {
          ...baseDraft().executive,
          presidentDecision: {
            text: "President Decision: Not required at this stage.",
            requiredNow: false,
          },
        },
      }),
      nowIso: NOW,
    });
    expect(result.applied).toBe(true);
    expect(result.needsSemanticFill).toBe(true);
    expect(result.findings.some((f) => f.code === "NEEDS_SEMANTIC_FILL")).toBe(
      true,
    );
    expect(result.controlled.executive.presidentDecision.requiredNow).toBe(true);
    expect(result.controlled.executive.presidentDecision.text).toBe(
      result.originalLlmDraft.executive.presidentDecision.text,
    );
    for (const a of result.audit) {
      expect(a.ruleId).toBeTruthy();
      expect(a.fieldPath).toBeTruthy();
      expect(a.reason).toBeTruthy();
      expect(a.controlVersion).toBe(DECISION_CONTROL_VERSION);
      expect(a.at).toBe(NOW);
      expect("originalLlmValue" in a).toBe(true);
      expect("controlledValue" in a).toBe(true);
    }
  });

  it("does not mechanically insert President/DP when CDQ expectedDecider is not President", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "Tech",
        vessel: "FAIRWIND",
        currentDecisionQuestion: {
          decisionClass: "technical_class_handling_confirm",
          decisionRequiredNow:
            "Should Tech Supt obtain focused Class confirmation?",
          expectedDecider: "Superintendent",
          deferredToExecutionOrClosure: ["Written Class reply"],
        },
      },
      llmDraft: baseDraft({ primaryCaseType: "TECHNICAL" }),
      nowIso: NOW,
    });
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "President/DP",
      ),
    ).toBe(false);
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "Superintendent",
      ),
    ).toBe(true);
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "Class",
      ),
    ).toBe(true);
  });

  it("GC01: deferred port/ETA execution gaps allow READY (R5/R9)", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "PLUTO LEADER — C/M Inoy Crew Change",
        vessel: "PLUTO LEADER",
        currentDecisionQuestion: getGoldenCaseCdq("GC01"),
      },
      llmDraft: baseDraft({
        primaryCaseType: "CREW_MANNING",
        executive: {
          ...baseDraft().executive,
          decisionReadiness: "CONDITIONAL",
          recommendation: {
            text: "Postpone Nansha crew change to Japan late September.",
          },
          presidentDecision: {
            text: "President Decision: Not required at this stage.",
            requiredNow: false,
          },
        },
        facts: {
          confirmed: [
            { id: "f1", text: "No immediate Safety or Manning emergency." },
          ],
          unverified: [],
          assumptions: [],
          missingInformation: [
            {
              id: "m1",
              text: "Exact Japanese port and ETA for crew change",
              who: "Ops",
              what: "Port/ETA",
              evidenceRequired: "Schedule",
              blocksReadiness: true,
            },
            {
              id: "m2",
              text: "C/M Inoy remaining documentation and travel readiness follow-up",
              who: "Manning Agent",
              what: "Docs",
              evidenceRequired: "Checklist",
              blocksReadiness: true,
            },
          ],
        },
      }),
      nowIso: NOW,
    });
    expect(
      result.controlled.facts.missingInformation.every(
        (m) => m.blocksReadiness !== true,
      ),
    ).toBe(true);
    expect(result.controlled.executive.decisionReadiness).toBe("READY");
    expect(result.controlled.tags).toEqual(
      expect.arrayContaining(["pluto_leader", "crew_change"]),
    );
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "President/DP" && a.status === "pending",
      ),
    ).toBe(true);
  });

  it("GC02: corrects INSPECTION_COMPLIANCE → TECHNICAL and upserts Class/Supt", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "FAIRWIND — NK CMS Handling",
        vessel: "FAIRWIND",
        currentDecisionQuestion: getGoldenCaseCdq("GC02"),
      },
      llmDraft: baseDraft({
        primaryCaseType: "INSPECTION_COMPLIANCE",
        facts: {
          confirmed: [{ id: "f1", text: "Prior ClassNK advice." }],
          unverified: [],
          assumptions: [],
          missingInformation: [
            {
              id: "m1",
              text: "Item-by-item open-up execution feasibility confirmation",
              who: "C/E",
              what: "Feasibility",
              evidenceRequired: "Item list",
              blocksReadiness: true,
            },
          ],
        },
      }),
      nowIso: NOW,
    });
    expect(result.controlled.primaryCaseType).toBe("TECHNICAL");
    expect(result.controlled.tags).toEqual(
      expect.arrayContaining(["fairwind", "class_nk", "maintenance"]),
    );
    expect(
      result.controlled.executive.decisionAuthorities.map((a) => a.authority),
    ).toEqual(
      expect.arrayContaining(["Superintendent", "Class", "President/DP"]),
    );
    expect(
      result.controlled.facts.missingInformation[0]?.blocksReadiness,
    ).toBe(false);
  });

  it("GC03: generalized Review Candidate policy forces flag without forcing MR", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "ORBIT — Internal Audit / Panama ASI",
        vessel: "ORBIT",
        currentDecisionQuestion: getGoldenCaseCdq("GC03"),
      },
      llmDraft: baseDraft({
        primaryCaseType: "INSPECTION_COMPLIANCE",
        reviewCandidate: { flag: false, retainAfterClose: false },
        learning: {
          correctiveAction: true,
          preventiveAction: true,
          effectivenessVerification: true,
          horizontalCheck: true,
          fleetWideRelevance: "possible",
          internalAuditCandidate: false,
          managementReviewCandidate: false,
          knowledgeUpdateCandidate: true,
        },
      }),
      nowIso: NOW,
    });
    expect(result.controlled.reviewCandidate.flag).toBe(true);
    expect(result.controlled.reviewCandidate.retainAfterClose).toBe(true);
    expect(result.controlled.learning.managementReviewCandidate).toBe(false);
    expect(result.audit.some((a) => a.ruleId === "RC-B-GUARDED")).toBe(true);
  });

  it("GC04: finance funding upserts Finance + President and demotes READY without liquidity", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "PLUTO LEADER — CTM",
        vessel: "PLUTO LEADER",
        currentDecisionQuestion: getGoldenCaseCdq("GC04"),
      },
      llmDraft: baseDraft({
        primaryCaseType: "FINANCE_COMMERCIAL",
        executive: {
          ...baseDraft().executive,
          decisionReadiness: "READY",
          recommendation: {
            text: "Approve CTM USD40,000 subject to liquidity.",
          },
        },
        finance: {
          separationPreserved: false,
          doNotAuthorizePayment: false,
          forecastsLabeledAsNonAccounting: false,
          companyFinancialFeasibility: {
            liquidityConfirmed: false,
            blockingIfUnconfirmed: true,
          },
        },
      }),
      nowIso: NOW,
    });
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "Finance/Accounting" && a.status === "pending",
      ),
    ).toBe(true);
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.authority === "President/DP" && a.status === "pending",
      ),
    ).toBe(true);
    expect(result.controlled.finance?.doNotAuthorizePayment).toBe(true);
    expect(result.controlled.finance?.separationPreserved).toBe(true);
    expect(result.controlled.executive.decisionReadiness).toBe("CONDITIONAL");
  });

  it("preserves original LLM draft separately from controlled output", () => {
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      tags: ["keep_me"],
    });
    const result = applyDecisionControlV01({
      envelope: {
        title: "t",
        vessel: "PLUTO LEADER",
        currentDecisionQuestion: getGoldenCaseCdq("GC01"),
      },
      llmDraft: draft,
      nowIso: NOW,
    });
    expect(result.originalLlmDraft.tags).toEqual(["keep_me"]);
    expect(result.controlled.tags.length).toBeGreaterThan(1);
    expect(result.originalLlmDraft.tags).not.toEqual(result.controlled.tags);
  });

  it("upserted authorities never use confirmed status", () => {
    const result = applyDecisionControlV01({
      envelope: {
        title: "t",
        vessel: "PLUTO LEADER",
        currentDecisionQuestion: getGoldenCaseCdq("GC04"),
      },
      llmDraft: baseDraft({ primaryCaseType: "FINANCE_COMMERCIAL" }),
      nowIso: NOW,
    });
    const inserted = result.controlled.executive.decisionAuthorities.filter(
      (a) => a.id.startsWith("ctrl_"),
    );
    expect(inserted.length).toBeGreaterThan(0);
    expect(inserted.every((a) => a.status === "pending")).toBe(true);
  });
});
