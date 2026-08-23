import { describe, expect, it } from "vitest";
import type { CaseEnvelope } from "@/lib/mdd/case-envelope/current-decision-question";
import {
  applyDecisionControlV01,
  applyDecisionControlV01IdempotentCheck,
} from "@/lib/mdd/decision-control";
import { getGoldenCaseCdq } from "@/lib/mdd/golden/cdq-envelopes";
import { parseMddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";
import type { MddStructuredOutput } from "@/lib/mdd/schema/structured-output-v1";

const NOW = "2026-08-23T18:00:00.000Z";

function baseDraft(
  overrides: Partial<MddStructuredOutput> = {},
): MddStructuredOutput {
  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: "OPERATIONAL",
    tags: [],
    executive: {
      recommendation: { text: "Proceed with proposed direction." },
      presidentDecision: {
        text: "Approve the current decision.",
        requiredNow: true,
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

const noOrgFallback = { rcSmsOwner: null, shipFundOwner: null } as const;

describe("Decision Policy v0.2 — AD-INSPECT-RC", () => {
  it("triggers and unresolved when Case Context missing and org fallback off", () => {
    const envelope: CaseEnvelope = {
      title: "Inspection RC case",
      currentDecisionQuestion: {
        decisionRequiredNow:
          "May Company close items now, or must root-cause and effectiveness remain open?",
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: ["Photo packs"],
        decisionClass: "inspection_non_closure",
      },
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required"],
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
        effectivenessVerification: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    expect(
      result.findings.some((f) => f.code === "AUTHORITY_DOMAIN_UNRESOLVED"),
    ).toBe(true);
    expect(
      result.controlled.executive.decisionAuthorities.some((a) =>
        /root cause|sms|capa/i.test(a.roleLabel),
      ),
    ).toBe(false);
  });

  it("reuses existing RC/SMS authority without duplicate upsert", () => {
    const envelope: CaseEnvelope = {
      title: "Inspection with RC auth",
      currentDecisionQuestion: getGoldenCaseCdq("GC03"),
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required"],
      executive: {
        ...baseDraft().executive,
        decisionAuthorities: [
          {
            id: "rc1",
            roleLabel: "Root cause / SMS follow-up",
            authority: "President/DP",
            status: "pending",
          },
        ],
      },
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    const rcAuths = result.controlled.executive.decisionAuthorities.filter((a) =>
      /root cause|sms/i.test(a.roleLabel),
    );
    expect(rcAuths).toHaveLength(1);
    expect(
      result.audit.filter((a) => a.ruleId === "AD-INSPECT-RC"),
    ).toHaveLength(0);
  });

  it("resolved upsert from Case Context domainOwners", () => {
    const envelope: CaseEnvelope = {
      title: "Inspection with context owner",
      currentDecisionQuestion: {
        decisionRequiredNow: "Root-cause and CAPA follow-up required before closure.",
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: [],
        decisionClass: "inspection_non_closure",
      },
      authorityContext: {
        domainOwners: {
          RC_SMS_FOLLOWUP: {
            authority: "Other",
            roleLabel: "Company SMS / CAPA follow-up",
          },
        },
      },
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required", "horizontal_check"],
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        effectivenessVerification: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) =>
          a.authority === "Other" &&
          a.roleLabel === "Company SMS / CAPA follow-up",
      ),
    ).toBe(true);
    expect(result.audit.some((a) => a.ruleId === "AD-INSPECT-RC")).toBe(true);
  });
});

describe("Decision Policy v0.2 — AD-FINANCE-SHIPFUND", () => {
  it("triggers and unresolved when no context and org fallback off", () => {
    const envelope: CaseEnvelope = {
      title: "Funding case",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      finance: {
        separationPreserved: true,
        doNotAuthorizePayment: true,
        forecastsLabeledAsNonAccounting: true,
        sourceFacts: { reportedShipFund: 4000 },
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { reportedShipFund: 4000, recommendedCtm: 40000 },
      orgDefaults: noOrgFallback,
    });
    expect(
      result.findings.some(
        (f) =>
          f.code === "AUTHORITY_DOMAIN_UNRESOLVED" &&
          f.message.includes("SHIP_FUND_SOURCE"),
      ),
    ).toBe(true);
    expect(
      result.controlled.executive.decisionAuthorities.some((a) =>
        /ship fund/i.test(a.roleLabel),
      ),
    ).toBe(false);
  });

  it("reuses existing ship-fund authority", () => {
    const envelope: CaseEnvelope = {
      title: "Funding with ship fund auth",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      executive: {
        ...baseDraft().executive,
        decisionAuthorities: [
          {
            id: "sf1",
            roleLabel: "Ship Fund data owner",
            authority: "Master",
            status: "pending",
          },
        ],
      },
      finance: {
        separationPreserved: true,
        doNotAuthorizePayment: true,
        forecastsLabeledAsNonAccounting: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { reportedShipFund: 4052, pendingExpenses: 9000 },
      orgDefaults: noOrgFallback,
    });
    expect(
      result.controlled.executive.decisionAuthorities.filter((a) =>
        /ship fund/i.test(a.roleLabel),
      ),
    ).toHaveLength(1);
  });

  it("resolved upsert from Case Context", () => {
    const envelope: CaseEnvelope = {
      title: "Funding with context",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
      authorityContext: {
        domainOwners: {
          SHIP_FUND_SOURCE: {
            authority: "Master",
            roleLabel: "Vessel cash / Ship Fund evidence",
          },
        },
      },
    };
    const draft = baseDraft({ primaryCaseType: "FINANCE_COMMERCIAL" });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { reportedShipFund: 4052, recommendedCtm: 40000 },
      orgDefaults: noOrgFallback,
    });
    expect(
      result.controlled.executive.decisionAuthorities.some(
        (a) => a.roleLabel === "Vessel cash / Ship Fund evidence",
      ),
    ).toBe(true);
  });
});

describe("Decision Policy v0.2 — org fallback", () => {
  it("org fallback disabled by default (null env defaults)", () => {
    const defaults = { rcSmsOwner: null, shipFundOwner: null };
    expect(defaults.rcSmsOwner).toBeNull();
    expect(defaults.shipFundOwner).toBeNull();
  });

  it("org fallback used only when explicitly configured and audited", () => {
    const envelope: CaseEnvelope = {
      title: "Inspection needing RC",
      currentDecisionQuestion: {
        decisionRequiredNow: "Root-cause challenge required before closure.",
        expectedDecider: "President/DP",
        deferredToExecutionOrClosure: [],
        decisionClass: "inspection_non_closure",
      },
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required"],
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: { rcSmsOwner: "DP", shipFundOwner: null },
    });
    expect(
      result.controlled.executive.decisionAuthorities.some((a) =>
        /root cause \/ sms/i.test(a.roleLabel),
      ),
    ).toBe(true);
    expect(
      result.audit.some(
        (a) =>
          a.ruleId === "AD-INSPECT-RC" &&
          String(a.reason).includes("ORG_DEFAULT_RC_SMS_OWNER"),
      ),
    ).toBe(true);
  });

  it("does not insert Golden/vessel-specific authority labels", () => {
    const envelope: CaseEnvelope = {
      title: "ORBIT should not appear",
      vessel: "ORBIT",
      currentDecisionQuestion: getGoldenCaseCdq("GC03"),
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required"],
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: { rcSmsOwner: "DP", shipFundOwner: null },
    });
    const blob = JSON.stringify(result.controlled.executive.decisionAuthorities);
    expect(blob).not.toMatch(/GC03|ORBIT|golden/i);
  });
});

describe("Decision Policy v0.2 — Review Candidate B-guarded", () => {
  it("false→true by generalized policy (inspection + external + system)", () => {
    const envelope: CaseEnvelope = {
      title: "Retention case",
      currentDecisionQuestion: getGoldenCaseCdq("GC03"),
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required", "system_weakness"],
      reviewCandidate: { flag: false, retainAfterClose: false },
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
        fleetWideRelevance: "possible",
      },
      facts: {
        confirmed: [{ id: "f1", text: "ASI observations recorded." }],
        unverified: [],
        assumptions: [
          { id: "a1", text: "System weakness hypothesis under review." },
        ],
        missingInformation: [],
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    expect(result.controlled.reviewCandidate.flag).toBe(true);
    expect(
      result.findings.some((f) => f.code === "REVIEW_CANDIDATE_PROMOTED"),
    ).toBe(true);
    expect(
      result.audit.some(
        (a) =>
          a.ruleId === "RC-B-GUARDED" &&
          a.policyCriteriaEvaluated != null,
      ),
    ).toBe(true);
  });

  it("true→false when no qualifying policy criterion exists", () => {
    const envelope: CaseEnvelope = {
      title: "Crew case no retention",
      currentDecisionQuestion: getGoldenCaseCdq("GC01"),
    };
    const draft = baseDraft({
      primaryCaseType: "CREW_MANNING",
      reviewCandidate: {
        flag: true,
        retainAfterClose: true,
        reason: "LLM suggested review",
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    expect(result.controlled.reviewCandidate.flag).toBe(false);
    expect(result.originalLlmDraft.reviewCandidate.flag).toBe(true);
    expect(
      result.findings.some((f) => f.code === "REVIEW_CANDIDATE_DEMOTED"),
    ).toBe(true);
  });

  it("LLM MR=true alone does not force Review=true", () => {
    const envelope: CaseEnvelope = {
      title: "Finance MR only",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      reviewCandidate: { flag: false, retainAfterClose: false },
      learning: {
        ...baseDraft().learning,
        managementReviewCandidate: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { reportedShipFund: 4052, recommendedCtm: 40000 },
      orgDefaults: noOrgFallback,
    });
    expect(result.controlled.reviewCandidate.flag).toBe(false);
    expect(result.controlled.learning.managementReviewCandidate).toBe(false);
    expect(result.originalLlmDraft.learning.managementReviewCandidate).toBe(
      true,
    );
    expect(
      result.findings.some((f) => f.code === "UNSUPPORTED_MR_SUGGESTION"),
    ).toBe(true);
  });

  it("original LLM Review/MR suggestions remain auditable; assembled satisfies Canonical", () => {
    const envelope: CaseEnvelope = {
      title: "MR filter canonical",
      currentDecisionQuestion: getGoldenCaseCdq("GC04"),
    };
    const draft = baseDraft({
      primaryCaseType: "FINANCE_COMMERCIAL",
      reviewCandidate: { flag: true, retainAfterClose: true },
      learning: {
        ...baseDraft().learning,
        managementReviewCandidate: true,
      },
    });
    const result = applyDecisionControlV01({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      financeSourceInput: { recommendedCtm: 40000 },
      orgDefaults: noOrgFallback,
    });
    expect(result.originalLlmDraft.reviewCandidate.flag).toBe(true);
    expect(result.originalLlmDraft.learning.managementReviewCandidate).toBe(
      true,
    );
    expect(result.controlled.reviewCandidate.flag).toBe(false);
    expect(result.controlled.learning.managementReviewCandidate).toBe(false);
    expect(parseMddStructuredOutput(result.controlled).success).toBe(true);
    expect(
      result.audit.some(
        (a) =>
          a.ruleId === "RC-MR-FILTER" &&
          a.originalSuggestion === true &&
          a.finalValue === false &&
          a.policyCriteriaEvaluated != null,
      ),
    ).toBe(true);
  });

  it("idempotent under Decision Policy v0.2", () => {
    const envelope: CaseEnvelope = {
      title: "Idempotent inspection",
      currentDecisionQuestion: getGoldenCaseCdq("GC03"),
      authorityContext: {
        domainOwners: {
          RC_SMS_FOLLOWUP: {
            authority: "President/DP",
            roleLabel: "Root cause / SMS / CAPA follow-up",
          },
        },
      },
    };
    const draft = baseDraft({
      primaryCaseType: "INSPECTION_COMPLIANCE",
      tags: ["root_cause_required", "system_weakness"],
      learning: {
        ...baseDraft().learning,
        correctiveAction: true,
        horizontalCheck: true,
        fleetWideRelevance: "possible",
      },
      facts: {
        confirmed: [],
        unverified: [],
        assumptions: [{ id: "a1", text: "System weakness hypothesis." }],
        missingInformation: [],
      },
    });
    const check = applyDecisionControlV01IdempotentCheck({
      envelope,
      llmDraft: draft,
      nowIso: NOW,
      orgDefaults: noOrgFallback,
    });
    expect(check.controlledEqual).toBe(true);
    expect(check.authorityCountStable).toBe(true);
  });
});
