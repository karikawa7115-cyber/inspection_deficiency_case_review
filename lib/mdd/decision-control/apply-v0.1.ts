/**
 * Decision Control Layer v0.1 — deterministic, idempotent, no LLM calls.
 * Design: docs/mdd/DECISION_CONTROL_LAYER_v0.1_DESIGN_PROPOSAL.md
 * Does not modify frozen Prompt / Schema / Gate / Golden Spec / Eval Rules.
 */
import {
  expectedDeciderRequiresPresident,
  type CaseEnvelope,
  type CurrentDecisionQuestion,
  type DecisionClass,
} from "../case-envelope/current-decision-question";
import {
  resolveFinanceGateActivation,
  type FinanceSourceInput,
} from "../quality-gate/finance-activation-v1.1";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import {
  resolveAuthorityDomain,
  triggersRcSmsFollowup,
  triggersShipFundSource,
} from "./authority-domains-v0.2";
import {
  resolveOrgAuthorityDefaults,
  type OrgAuthorityDefaults,
} from "./org-defaults";
import { applyReviewCandidateBGuarded } from "./review-candidate-v0.2";
import { DECISION_CONTROL_VERSION } from "./version";
import { presidentProseNeedsSemanticFill } from "../semantic-refill/prose-defect";

export type ControlAuditEntry = {
  ruleId: string;
  fieldPath: string;
  originalLlmValue: unknown;
  controlledValue: unknown;
  reason: string;
  controlVersion: typeof DECISION_CONTROL_VERSION;
  at: string;
  /** Decision Policy v0.2 — original suggestion before policy change */
  originalSuggestion?: unknown;
  /** Decision Policy v0.2 — final value after policy change */
  finalValue?: unknown;
  /** Decision Policy v0.2 — criteria evaluated (booleans) */
  policyCriteriaEvaluated?: Record<string, boolean>;
};

export type ControlFindingCode =
  | "CDQ_REQUIRED"
  | "NEEDS_SEMANTIC_FILL"
  | "BOUNDARY_CLAIM_DETECTED"
  | "SPURIOUS_FINANCE_EXTENSION"
  | "AUTHORITY_DOMAIN_UNRESOLVED"
  | "REVIEW_CANDIDATE_PROMOTED"
  | "REVIEW_CANDIDATE_DEMOTED"
  | "UNSUPPORTED_MR_SUGGESTION"
  | "MR_EFFECTIVE_FILTERED"
  /** Emitted by Semantic Refill v0.3 stage (pipeline), not Gate. */
  | "SEMANTIC_REFILL_APPLIED"
  | "SEMANTIC_REFILL_REJECTED";

export type ControlFinding = {
  code: ControlFindingCode;
  message: string;
  relatedFieldPaths?: string[];
};

export type DecisionControlResult = {
  originalLlmDraft: MddStructuredOutput;
  controlled: MddStructuredOutput;
  audit: ControlAuditEntry[];
  findings: ControlFinding[];
  controlVersion: typeof DECISION_CONTROL_VERSION;
  /** True when Control rules ran (CDQ present). False when disabled path or CDQ missing. */
  applied: boolean;
  needsSemanticFill: boolean;
};

export type ApplyDecisionControlOptions = {
  envelope: CaseEnvelope;
  llmDraft: MddStructuredOutput;
  /** Fixed clock for idempotent tests. */
  nowIso?: string;
  /** When true (default), missing CDQ yields CDQ_REQUIRED and no rule mutation. */
  requireCdq?: boolean;
  /** Authoritative envelope finance figures (F3). */
  financeSourceInput?: FinanceSourceInput | null;
  /**
   * Organizational authority-domain defaults (Decision Policy v0.2).
   * When omitted, read from env; unset env = no unconditional fallback.
   */
  orgDefaults?: OrgAuthorityDefaults;
};

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function stableAuthId(authority: string, roleLabel: string): string {
  const slug = `${authority}_${roleLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return `ctrl_${slug}`;
}

function vesselTag(vessel?: string): string | undefined {
  if (!vessel?.trim()) return undefined;
  return vessel
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function resolveDecisionClass(
  cdq: CurrentDecisionQuestion,
  primaryCaseType: string,
): DecisionClass {
  if (cdq.decisionClass && cdq.decisionClass !== "generic") {
    return cdq.decisionClass;
  }
  // Fallback from type only when class omitted — still not Golden-specific.
  if (primaryCaseType === "CREW_MANNING") return "crew_change_postponement";
  if (primaryCaseType === "TECHNICAL") return "technical_class_handling_confirm";
  if (
    primaryCaseType === "INSPECTION_COMPLIANCE" ||
    primaryCaseType === "ISM_MANAGEMENT"
  ) {
    return "inspection_non_closure";
  }
  if (primaryCaseType === "FINANCE_COMMERCIAL") return "finance_funding_amount";
  return "generic";
}

function textMatchesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.some((n) => {
    const parts = n.toLowerCase().split(/\s+/).filter((p) => p.length > 3);
    if (parts.length === 0) return h.includes(n.toLowerCase());
    return parts.filter((p) => h.includes(p)).length >= Math.min(2, parts.length);
  });
}

function pushAudit(
  audit: ControlAuditEntry[],
  entry: Omit<ControlAuditEntry, "controlVersion">,
): void {
  // Idempotent: same ruleId+fieldPath+controlled JSON → skip duplicate
  const controlledKey = JSON.stringify(entry.controlledValue);
  const dup = audit.some(
    (a) =>
      a.ruleId === entry.ruleId &&
      a.fieldPath === entry.fieldPath &&
      JSON.stringify(a.controlledValue) === controlledKey,
  );
  if (dup) return;
  audit.push({ ...entry, controlVersion: DECISION_CONTROL_VERSION });
}

function hasAuthority(
  list: MddStructuredOutput["executive"]["decisionAuthorities"],
  authority: string,
  roleLabel?: string,
): boolean {
  return list.some((a) => {
    const authMatch = a.authority === authority;
    if (!roleLabel) return authMatch;
    return (
      authMatch &&
      a.roleLabel.toLowerCase() === roleLabel.toLowerCase()
    );
  });
}

function upsertAuthority(
  controlled: MddStructuredOutput,
  audit: ControlAuditEntry[],
  at: string,
  item: {
    authority: string;
    roleLabel: string;
    reason: string;
    ruleId?: string;
  },
): void {
  if (hasAuthority(controlled.executive.decisionAuthorities, item.authority, item.roleLabel)) {
    return;
  }
  const nextId = stableAuthId(item.authority, item.roleLabel);
  // Idempotent: skip only exact roleLabel match or same stable control id
  if (
    controlled.executive.decisionAuthorities.some(
      (a) =>
        a.id === nextId ||
        (a.authority === item.authority &&
          a.roleLabel.toLowerCase() === item.roleLabel.toLowerCase()),
    )
  ) {
    return;
  }

  const original = deepClone(controlled.executive.decisionAuthorities);
  const next = {
    id: nextId,
    roleLabel: item.roleLabel,
    authority: item.authority as MddStructuredOutput["executive"]["decisionAuthorities"][number]["authority"],
    status: "pending" as const,
  };
  controlled.executive.decisionAuthorities = [
    ...controlled.executive.decisionAuthorities,
    next,
  ];
  pushAudit(audit, {
    ruleId: item.ruleId ?? "R3",
    fieldPath: "executive.decisionAuthorities",
    originalLlmValue: original,
    controlledValue: deepClone(controlled.executive.decisionAuthorities),
    reason: item.reason,
    at,
  });
}

/**
 * Apply Decision Control v0.1. Pure / deterministic. Never calls an LLM.
 */
export function applyDecisionControlV01(
  options: ApplyDecisionControlOptions,
): DecisionControlResult {
  const at = options.nowIso ?? new Date().toISOString();
  const requireCdq = options.requireCdq !== false;
  const originalLlmDraft = deepClone(options.llmDraft);
  const controlled = deepClone(options.llmDraft);
  const audit: ControlAuditEntry[] = [];
  const findings: ControlFinding[] = [];
  let needsSemanticFill = false;

  const cdq = options.envelope.currentDecisionQuestion;
  if (requireCdq && (cdq == null || !cdq.decisionRequiredNow?.trim())) {
    findings.push({
      code: "CDQ_REQUIRED",
      message:
        "Current Decision Question is required for Decision Control. Complete decisionRequiredNow, expectedDecider, and deferredToExecutionOrClosure — Control will not invent CDQ.",
      relatedFieldPaths: ["caseEnvelope.currentDecisionQuestion"],
    });
    return {
      originalLlmDraft,
      controlled: originalLlmDraft,
      audit,
      findings,
      controlVersion: DECISION_CONTROL_VERSION,
      applied: false,
      needsSemanticFill: false,
    };
  }

  if (!cdq) {
    return {
      originalLlmDraft,
      controlled: originalLlmDraft,
      audit,
      findings,
      controlVersion: DECISION_CONTROL_VERSION,
      applied: false,
      needsSemanticFill: false,
    };
  }

  const decisionClass = resolveDecisionClass(cdq, controlled.primaryCaseType);
  const presidentWanted = expectedDeciderRequiresPresident(cdq.expectedDecider);

  // --- R1: envelope tags ---
  const tagsToAdd: string[] = [];
  const vt = vesselTag(options.envelope.vessel);
  if (vt && !controlled.tags.includes(vt)) tagsToAdd.push(vt);
  for (const t of options.envelope.knownTags ?? []) {
    if (t && !controlled.tags.includes(t) && !tagsToAdd.includes(t)) {
      tagsToAdd.push(t);
    }
  }
  // Decision-class derived tags (generalized, not Golden IDs)
  const classTags: Record<DecisionClass, string[]> = {
    crew_change_postponement: ["crew_change"],
    technical_class_handling_confirm: ["class_nk", "maintenance"],
    inspection_non_closure: [
      "root_cause_required",
      "horizontal_check",
      "effectiveness_verification",
    ],
    finance_funding_amount: ["financial_risk", "owner_interest"],
    generic: [],
  };
  for (const t of classTags[decisionClass]) {
    if (!controlled.tags.includes(t) && !tagsToAdd.includes(t)) tagsToAdd.push(t);
  }
  // Flag / ASI cues from narrative-free CDQ deferred or decision text
  if (
    decisionClass === "inspection_non_closure" &&
    /panama|flag/i.test(cdq.decisionRequiredNow) &&
    !controlled.tags.includes("panama_flag")
  ) {
    tagsToAdd.push("panama_flag");
  }
  if (
    decisionClass === "inspection_non_closure" &&
    /record|document|sms|asi|audit/i.test(cdq.decisionRequiredNow) &&
    !controlled.tags.includes("recordkeeping")
  ) {
    tagsToAdd.push("recordkeeping");
    if (!controlled.tags.includes("document_control")) {
      tagsToAdd.push("document_control");
    }
  }

  if (tagsToAdd.length > 0) {
    const original = [...controlled.tags];
    controlled.tags = [...controlled.tags, ...tagsToAdd];
    pushAudit(audit, {
      ruleId: "R1",
      fieldPath: "tags",
      originalLlmValue: original,
      controlledValue: [...controlled.tags],
      reason: "Merge envelope / decision-class known tags (additive).",
      at,
    });
  }

  // --- R2: case type confirmation ---
  const typeByClass: Partial<Record<DecisionClass, MddStructuredOutput["primaryCaseType"]>> =
    {
      crew_change_postponement: "CREW_MANNING",
      technical_class_handling_confirm: "TECHNICAL",
      inspection_non_closure: "INSPECTION_COMPLIANCE",
      finance_funding_amount: "FINANCE_COMMERCIAL",
    };
  const confirmedType = typeByClass[decisionClass];
  if (confirmedType && controlled.primaryCaseType !== confirmedType) {
    const original = controlled.primaryCaseType;
    controlled.primaryCaseType = confirmedType;
    pushAudit(audit, {
      ruleId: "R2",
      fieldPath: "primaryCaseType",
      originalLlmValue: original,
      controlledValue: confirmedType,
      reason: `CDQ decisionClass=${decisionClass} confirms primary case type.`,
      at,
    });
  }

  // --- R3: minimum authorities ---
  if (decisionClass === "crew_change_postponement") {
    upsertAuthority(controlled, audit, at, {
      authority: "Manning Agent",
      roleLabel: "Crew-change/document coordination",
      reason: "Manning decision-class requires document coordination authority.",
    });
    upsertAuthority(controlled, audit, at, {
      authority: "Master",
      roleLabel: "Continuation onboard",
      reason: "Manning decision-class requires Master continuity authority.",
    });
    if (presidentWanted) {
      upsertAuthority(controlled, audit, at, {
        authority: "President/DP",
        roleLabel: "Final management approval of postponement",
        reason: "CDQ expectedDecider assigns President/DP final postponement approval.",
      });
    }
  } else if (decisionClass === "technical_class_handling_confirm") {
    upsertAuthority(controlled, audit, at, {
      authority: "Superintendent",
      roleLabel: "Technical assessment",
      reason: "Technical Class-handling decision requires Superintendent.",
    });
    upsertAuthority(controlled, audit, at, {
      authority: "Class",
      roleLabel: "Class acceptance",
      reason: "Technical Class-handling decision requires Class authority.",
    });
    if (presidentWanted) {
      upsertAuthority(controlled, audit, at, {
        authority: "President/DP",
        roleLabel: "Final management confirmation",
        reason: "CDQ expectedDecider includes President/DP management confirmation.",
      });
    }
  } else if (decisionClass === "inspection_non_closure") {
    upsertAuthority(controlled, audit, at, {
      authority: "Master",
      roleLabel: "Onboard corrective execution",
      reason: "Inspection non-closure requires Master execution authority.",
    });
    upsertAuthority(controlled, audit, at, {
      authority: "Superintendent",
      roleLabel: "Technical verification",
      reason: "Inspection non-closure requires Technical Superintendent.",
    });
    if (/flag|panama|asi|external/i.test(cdq.decisionRequiredNow + cdq.expectedDecider)) {
      upsertAuthority(controlled, audit, at, {
        authority: "Flag Administration",
        roleLabel: "External Flag / ASI follow-up",
        reason: "CDQ references Flag/external inspection signal.",
      });
    }
    if (presidentWanted) {
      upsertAuthority(controlled, audit, at, {
        authority: "President/DP",
        roleLabel: "Final acceptance of Company closure",
        reason: "CDQ expectedDecider assigns President/DP closure acceptance.",
      });
    }
  } else if (decisionClass === "finance_funding_amount") {
    upsertAuthority(controlled, audit, at, {
      authority: "Finance/Accounting",
      roleLabel: "Company cash-position",
      reason: "Funding-amount decision requires Finance liquidity authority.",
    });
    if (presidentWanted) {
      upsertAuthority(controlled, audit, at, {
        authority: "President/DP",
        roleLabel: "Final CTM funding",
        reason: "CDQ expectedDecider assigns President/DP final funding decision.",
      });
    }
  }

  // --- Decision Policy v0.2: Authority domains (AD-INSPECT-RC / AD-FINANCE-SHIPFUND) ---
  const orgDefaults =
    options.orgDefaults ?? resolveOrgAuthorityDefaults();

  const rcRequired = triggersRcSmsFollowup({
    decisionClass,
    primaryCaseType: controlled.primaryCaseType,
    cdq,
    controlled,
  });
  const rcRes = resolveAuthorityDomain({
    domain: "RC_SMS_FOLLOWUP",
    required: rcRequired,
    controlled,
    envelope: options.envelope,
    cdq,
    orgDefaults,
  });
  if (rcRes.required && rcRes.resolved && rcRes.resolved.source !== "reuse") {
    upsertAuthority(controlled, audit, at, {
      authority: rcRes.resolved.authority,
      roleLabel: rcRes.resolved.roleLabel,
      ruleId: "AD-INSPECT-RC",
      reason: `Authority domain RC_SMS_FOLLOWUP resolved via ${rcRes.resolved.source}.`,
    });
    if (rcRes.resolved.source === "org_fallback") {
      pushAudit(audit, {
        ruleId: "AD-INSPECT-RC",
        fieldPath: "authorityDomain.RC_SMS_FOLLOWUP.orgFallback",
        originalLlmValue: null,
        controlledValue: rcRes.resolved,
        reason:
          "ORG_DEFAULT_RC_SMS_OWNER used — explicit organizational policy, not Golden default.",
        at,
        originalSuggestion: null,
        finalValue: rcRes.resolved,
      });
    }
  } else if (rcRes.unresolved) {
    findings.push({
      code: "AUTHORITY_DOMAIN_UNRESOLVED",
      message:
        "Required authority domain RC_SMS_FOLLOWUP could not be resolved from Case Context; no unconditional role invented.",
      relatedFieldPaths: ["executive.decisionAuthorities"],
    });
    pushAudit(audit, {
      ruleId: "AD-INSPECT-RC",
      fieldPath: "authorityDomain.RC_SMS_FOLLOWUP",
      originalLlmValue: null,
      controlledValue: null,
      reason: "Domain required but unresolved — AUTHORITY_DOMAIN_UNRESOLVED emitted.",
      at,
    });
  }

  const shipRequired = triggersShipFundSource({
    decisionClass,
    primaryCaseType: controlled.primaryCaseType,
    cdq,
    financeSourceInput: options.financeSourceInput ?? null,
    controlled,
  });
  const shipRes = resolveAuthorityDomain({
    domain: "SHIP_FUND_SOURCE",
    required: shipRequired,
    controlled,
    envelope: options.envelope,
    cdq,
    orgDefaults,
  });
  if (
    shipRes.required &&
    shipRes.resolved &&
    shipRes.resolved.source !== "reuse"
  ) {
    upsertAuthority(controlled, audit, at, {
      authority: shipRes.resolved.authority,
      roleLabel: shipRes.resolved.roleLabel,
      ruleId: "AD-FINANCE-SHIPFUND",
      reason: `Authority domain SHIP_FUND_SOURCE resolved via ${shipRes.resolved.source}.`,
    });
    if (shipRes.resolved.source === "org_fallback") {
      pushAudit(audit, {
        ruleId: "AD-FINANCE-SHIPFUND",
        fieldPath: "authorityDomain.SHIP_FUND_SOURCE.orgFallback",
        originalLlmValue: null,
        controlledValue: shipRes.resolved,
        reason:
          "ORG_DEFAULT_SHIP_FUND_OWNER used — explicit organizational policy, not Golden default.",
        at,
        originalSuggestion: null,
        finalValue: shipRes.resolved,
      });
    }
  } else if (shipRes.unresolved) {
    findings.push({
      code: "AUTHORITY_DOMAIN_UNRESOLVED",
      message:
        "Required authority domain SHIP_FUND_SOURCE could not be resolved from Case Context; no unconditional role invented.",
      relatedFieldPaths: ["executive.decisionAuthorities"],
    });
    pushAudit(audit, {
      ruleId: "AD-FINANCE-SHIPFUND",
      fieldPath: "authorityDomain.SHIP_FUND_SOURCE",
      originalLlmValue: null,
      controlledValue: null,
      reason: "Domain required but unresolved — AUTHORITY_DOMAIN_UNRESOLVED emitted.",
      at,
    });
  }

  // --- R4: President requiredNow (non-mechanical) ---
  if (presidentWanted) {
    const originalRequired = controlled.executive.presidentDecision.requiredNow;
    const originalText = controlled.executive.presidentDecision.text;
    if (!controlled.executive.presidentDecision.requiredNow) {
      controlled.executive.presidentDecision.requiredNow = true;
      pushAudit(audit, {
        ruleId: "R4",
        fieldPath: "executive.presidentDecision.requiredNow",
        originalLlmValue: originalRequired,
        controlledValue: true,
        reason:
          "CDQ expectedDecider requires President/DP now; set requiredNow=true.",
        at,
      });
    }
    if (
      presidentProseNeedsSemanticFill(
        originalText,
        controlled.executive.presidentDecision.requiredNow,
      )
    ) {
      needsSemanticFill = true;
      findings.push({
        code: "NEEDS_SEMANTIC_FILL",
        message:
          "President/DP decision is requiredNow per CDQ, but President Decision prose is absent, contradictory, or says not required. Original text retained pending Semantic Refill v0.3.",
        relatedFieldPaths: ["executive.presidentDecision.text"],
      });
      pushAudit(audit, {
        ruleId: "R4",
        fieldPath: "executive.presidentDecision.text",
        originalLlmValue: originalText,
        controlledValue: originalText,
        reason:
          "Conflict recorded; text not overwritten (needsSemanticFill=true).",
        at,
      });
    }
  }

  // --- R9 then R5: stage deferred missings; readiness ---
  const deferred = cdq.deferredToExecutionOrClosure ?? [];
  for (let i = 0; i < controlled.facts.missingInformation.length; i++) {
    const m = controlled.facts.missingInformation[i]!;
    const blob = `${m.text} ${m.what} ${m.evidenceRequired}`;
    if (m.blocksReadiness === true && textMatchesAny(blob, deferred)) {
      const original = m.blocksReadiness;
      m.blocksReadiness = false;
      pushAudit(audit, {
        ruleId: "R9",
        fieldPath: `facts.missingInformation[${i}].blocksReadiness`,
        originalLlmValue: original,
        controlledValue: false,
        reason:
          "Missing item matches CDQ deferredToExecutionOrClosure — not decision-blocking for current question.",
        at,
      });
    }
  }

  // R5 readiness for crew postponement: only deferred gaps → READY eligible
  if (decisionClass === "crew_change_postponement") {
    const stillBlocking = controlled.facts.missingInformation.some(
      (m) => m.blocksReadiness === true,
    );
    const allMissingDeferred =
      controlled.facts.missingInformation.length === 0 ||
      controlled.facts.missingInformation.every((m) =>
        textMatchesAny(`${m.text} ${m.what}`, deferred),
      );
    if (
      !stillBlocking &&
      allMissingDeferred &&
      controlled.executive.decisionReadiness !== "READY"
    ) {
      const original = controlled.executive.decisionReadiness;
      controlled.executive.decisionReadiness = "READY";
      pushAudit(audit, {
        ruleId: "R5",
        fieldPath: "executive.decisionReadiness",
        originalLlmValue: original,
        controlledValue: "READY",
        reason:
          "Current decision (postponement) is decidable; remaining missings are CDQ-deferred execution conditions.",
        at,
      });
    }
  }

  if (
    decisionClass === "finance_funding_amount" ||
    decisionClass === "technical_class_handling_confirm" ||
    decisionClass === "inspection_non_closure"
  ) {
    if (controlled.executive.decisionReadiness === "READY") {
      // Material confirmations typically remain — prefer CONDITIONAL unless Gate later allows
      const liquidityOk =
        controlled.finance?.companyFinancialFeasibility?.liquidityConfirmed ===
          true ||
        controlled.finance?.sourceFacts?.companyLiquidityConfirmed === true ||
        controlled.finance?.snapshot?.companyLiquidityConfirmed === true;
      if (decisionClass === "finance_funding_amount" && !liquidityOk) {
        const original = controlled.executive.decisionReadiness;
        controlled.executive.decisionReadiness = "CONDITIONAL";
        pushAudit(audit, {
          ruleId: "R5",
          fieldPath: "executive.decisionReadiness",
          originalLlmValue: original,
          controlledValue: "CONDITIONAL",
          reason:
            "Funding decision cannot be READY while Company liquidity remains unconfirmed.",
          at,
        });
      }
    } else if (controlled.executive.decisionReadiness === "NOT_READY") {
      // Avoid auto-NOT_READY when only deferred gaps remain
      const stillBlocking = controlled.facts.missingInformation.some(
        (m) => m.blocksReadiness === true,
      );
      if (!stillBlocking) {
        const original = controlled.executive.decisionReadiness;
        controlled.executive.decisionReadiness = "CONDITIONAL";
        pushAudit(audit, {
          ruleId: "R5",
          fieldPath: "executive.decisionReadiness",
          originalLlmValue: original,
          controlledValue: "CONDITIONAL",
          reason:
            "No decision-blocking missings after CDQ staging; NOT_READY demoted to CONDITIONAL.",
          at,
        });
      }
    }
  }

  // --- Decision Policy v0.2: Review Candidate B-guarded + MR hybrid (replaces R6 / R6b) ---
  const reviewApply = applyReviewCandidateBGuarded({
    controlled,
    decisionClass,
    cdq,
  });
  const criteriaRecord = Object.fromEntries(
    Object.entries(reviewApply.criteria),
  ) as Record<string, boolean>;

  if (reviewApply.reviewFlagChanged) {
    if (reviewApply.finalReviewFlag) {
      findings.push({
        code: "REVIEW_CANDIDATE_PROMOTED",
        message:
          "Review Candidate promoted by generalized retention policy (Decision Policy v0.2).",
        relatedFieldPaths: ["reviewCandidate.flag"],
      });
    } else {
      findings.push({
        code: "REVIEW_CANDIDATE_DEMOTED",
        message:
          "Review Candidate demoted — no qualifying retention criteria (Decision Policy v0.2). Original LLM suggestion retained in originalLlmDraft.",
        relatedFieldPaths: ["reviewCandidate.flag"],
      });
    }
    pushAudit(audit, {
      ruleId: "RC-B-GUARDED",
      fieldPath: "reviewCandidate.flag",
      originalLlmValue: reviewApply.previousReviewFlag,
      controlledValue: reviewApply.finalReviewFlag,
      originalSuggestion: reviewApply.previousReviewFlag,
      finalValue: reviewApply.finalReviewFlag,
      policyCriteriaEvaluated: criteriaRecord,
      reason: reviewApply.finalReviewFlag
        ? "false→true by generalized Review retention criteria."
        : "true→false — retention criteria not met; LLM suggestion preserved in originalLlmDraft.",
      at,
    });
  }

  if (reviewApply.mrFiltered) {
    findings.push({
      code: "UNSUPPORTED_MR_SUGGESTION",
      message:
        "LLM managementReviewCandidate=true without qualifying Review retention criteria. Assembled MR filtered to false; original suggestion retained in originalLlmDraft.",
      relatedFieldPaths: [
        "learning.managementReviewCandidate",
        "reviewCandidate.flag",
      ],
    });
    findings.push({
      code: "MR_EFFECTIVE_FILTERED",
      message:
        "Assembled managementReviewCandidate set to false for Canonical coherence under hybrid Option 2. Not a silent delete of the LLM suggestion.",
      relatedFieldPaths: ["learning.managementReviewCandidate"],
    });
    pushAudit(audit, {
      ruleId: "RC-MR-FILTER",
      fieldPath: "learning.managementReviewCandidate",
      originalLlmValue: reviewApply.previousMr,
      controlledValue: reviewApply.finalMr,
      originalSuggestion: reviewApply.previousMr,
      finalValue: reviewApply.finalMr,
      policyCriteriaEvaluated: criteriaRecord,
      reason:
        "Option 2 hybrid: LLM MR suggestion unsupported by Review policy; assembled MR=false; originalLlmDraft unchanged.",
      at,
    });
  }

  // --- R7: finance dependencies ---
  if (decisionClass === "finance_funding_amount" || controlled.finance) {
    if (controlled.finance) {
      if (controlled.finance.doNotAuthorizePayment !== true) {
        const original = controlled.finance.doNotAuthorizePayment;
        controlled.finance.doNotAuthorizePayment = true;
        pushAudit(audit, {
          ruleId: "R7",
          fieldPath: "finance.doNotAuthorizePayment",
          originalLlmValue: original,
          controlledValue: true,
          reason: "Finance briefs must not authorize payment/transfer.",
          at,
        });
      }
      if (controlled.finance.separationPreserved !== true) {
        const original = controlled.finance.separationPreserved;
        controlled.finance.separationPreserved = true;
        pushAudit(audit, {
          ruleId: "R7",
          fieldPath: "finance.separationPreserved",
          originalLlmValue: original,
          controlledValue: true,
          reason: "Necessary ≠ Affordable separation must be preserved.",
          at,
        });
      }
    }
  }

  // --- R8: boundary claim detection (annotate, no silent prose rewrite) ---
  const recBlob = [
    controlled.executive.recommendation.text,
    controlled.executive.presidentDecision.text,
  ].join("\n");
  if (
    /class(?:nk)? has approved everything|definitely applies to all cms|class acceptance is confirmed for all/i.test(
      recBlob,
    )
  ) {
    findings.push({
      code: "BOUNDARY_CLAIM_DETECTED",
      message:
        "Definitive Class acceptance language detected. Original prose retained; Quality Gate should Critical. Control does not silently rewrite.",
      relatedFieldPaths: [
        "executive.recommendation.text",
        "executive.presidentDecision.text",
      ],
    });
    pushAudit(audit, {
      ruleId: "R8",
      fieldPath: "executive.recommendation.text",
      originalLlmValue: controlled.executive.recommendation.text,
      controlledValue: controlled.executive.recommendation.text,
      reason: "Boundary claim annotated; prose not silently overwritten.",
      at,
    });
  }
  if (
    /treat.*closed|close the case|case is closed/i.test(recBlob) &&
    /photo|photograph/i.test(recBlob) &&
    !/do not treat|must not close|not treat.*closed/i.test(recBlob)
  ) {
    findings.push({
      code: "BOUNDARY_CLAIM_DETECTED",
      message:
        "Photo/closure claim detected. Original prose retained for Gate/human review.",
      relatedFieldPaths: ["executive.recommendation.text"],
    });
  }

  // --- Spurious finance extension annotate (F0); do not delete finance payload ---
  const financeAct = resolveFinanceGateActivation({
    primaryCaseType: controlled.primaryCaseType,
    currentDecisionQuestion: cdq,
    financeSourceInput: options.financeSourceInput ?? null,
    llmFinanceExtensionPresent: Boolean(controlled.finance),
  });
  if (financeAct.spuriousLlmFinanceExtension) {
    findings.push({
      code: "SPURIOUS_FINANCE_EXTENSION",
      message:
        "LLM finance extension present without F1/F2/F3 authoritative finance context. Finance Gate Criticals will not activate; extension retained for audit.",
      relatedFieldPaths: ["finance"],
    });
    pushAudit(audit, {
      ruleId: "P1",
      fieldPath: "finance",
      originalLlmValue: deepClone(controlled.finance),
      controlledValue: deepClone(controlled.finance),
      reason:
        "F0: finance extension alone does not activate Finance Gate; left intact.",
      at,
    });
  }

  return {
    originalLlmDraft,
    controlled,
    audit,
    findings,
    controlVersion: DECISION_CONTROL_VERSION,
    applied: true,
    needsSemanticFill,
  };
}

/**
 * Idempotent helper: applying Control twice yields the same controlled JSON and does not grow authorities/tags/audit unboundedly.
 */
export function applyDecisionControlV01IdempotentCheck(
  options: ApplyDecisionControlOptions,
): {
  first: DecisionControlResult;
  second: DecisionControlResult;
  controlledEqual: boolean;
  authorityCountStable: boolean;
  tagCountStable: boolean;
} {
  const first = applyDecisionControlV01(options);
  const second = applyDecisionControlV01({
    ...options,
    llmDraft: first.controlled,
    nowIso: options.nowIso,
  });
  return {
    first,
    second,
    controlledEqual:
      JSON.stringify(first.controlled) === JSON.stringify(second.controlled),
    authorityCountStable:
      first.controlled.executive.decisionAuthorities.length ===
      second.controlled.executive.decisionAuthorities.length,
    tagCountStable: first.controlled.tags.length === second.controlled.tags.length,
  };
}
