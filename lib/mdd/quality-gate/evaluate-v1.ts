/**
 * Quality Gate Rules v1.0 evaluator.
 * Human SSoT: docs/mdd/QUALITY_GATE_RULES_v1.0.md (frozen).
 * Output compatible with Structured Output Schema v1.0 qualityGate.
 * Does not connect production LLM.
 */
import type { CaseType, DecisionReadiness } from "../types";
import type { MddStructuredOutput } from "../schema/structured-output-v1";

export type GateFindingCode =
  | "CRITICAL_FACT_MISSING"
  | "SAFETY_OR_COMPLIANCE_UNRESOLVED"
  | "DECISION_AUTHORITY_UNCLEAR"
  | "PROFESSIONAL_BOUNDARY_VIOLATION"
  | "RECOMMENDATION_UNSUPPORTED"
  | "FINANCIAL_DEPENDENCY_UNRESOLVED"
  | "FACT_RECOMMENDATION_CONTRADICTION"
  | "WARN_SHALLOW_ROOT_CAUSE"
  | "WARN_HYPOTHESIS_AS_FACT_RISK"
  | "WARN_OPTIONAL_DETAIL_MISSING"
  | "WARN_OPTIONAL_EVIDENCE_MISSING"
  | "WARN_MONITOR_REVIEW"
  | "WARN_STALE_OR_CURRENT_INFO"
  | "WARN_WEAK_DELEGATION"
  | "WARN_OVERLONG_EXECUTIVE"
  | "WARN_UNNECESSARY_ESCALATION"
  | "WARN_REVIEW_LEARNING_OPPORTUNITY";

export type GateFinding = {
  code: GateFindingCode;
  message: string;
  relatedFieldPaths?: string[];
};

/** Explicit auditable proceed-despite-Critical; does NOT clear findings or set READY. */
export type CriticalOverrideRecord = {
  overriddenCodes: GateFindingCode[];
  actor: string;
  at: string;
  justification: string;
  proceedDespiteCritical: true;
  safetyComplianceAcknowledgement?: boolean;
};

export type QualityGateSubject = {
  primaryCaseType: CaseType;
  tags: string[];
  decisionReadiness: DecisionReadiness;
  recommendation: string;
  presidentDecision: string;
  why: string;
  decisionAuthorities: { roleLabel: string; authority: string }[];
  nextActions: { who: string; what: string; dueOrTrigger?: string }[];
  confirmedTexts: string[];
  unverifiedTexts: string[];
  assumptionTexts: string[];
  missing: {
    text: string;
    who: string;
    what: string;
    evidenceRequired: string;
    blocksReadiness?: boolean;
  }[];
  risks: string[];
  optionsCount: number;
  professionalBoundaryIssues: string[];
  learning: {
    managementReviewCandidate: boolean;
    internalAuditCandidate: boolean;
    knowledgeUpdateCandidate: boolean;
    notes?: string;
  };
  reviewCandidate: {
    flag: boolean;
    monitorOnly?: boolean;
  };
  finance?: {
    present: boolean;
    separationPreserved: boolean;
    liquidityConfirmed: boolean;
    doNotAuthorizePayment: boolean;
  };
  /** True when output implies Company closure / closed on photos. */
  impliesClosure: boolean;
  override?: CriticalOverrideRecord | null;
};

export type QualityGateEvaluation = {
  passed: boolean;
  criticalFailures: GateFinding[];
  warnings: GateFinding[];
  evaluatedAt: string;
  /** Never READY while criticalFailures remain (override does not change this). */
  enforcedReadiness: DecisionReadiness;
  /** Human chose to proceed despite Critical; readiness still not READY. */
  proceedDespiteCritical: boolean;
};

function finding(
  code: GateFindingCode,
  message: string,
  relatedFieldPaths?: string[],
): GateFinding {
  return { code, message, relatedFieldPaths };
}

function blob(parts: string[]) {
  return parts.join("\n").toLowerCase();
}

function rootCauseMateriallyRequired(subject: QualityGateSubject): boolean {
  if (
    subject.primaryCaseType === "INSPECTION_COMPLIANCE" ||
    subject.primaryCaseType === "ISM_MANAGEMENT"
  ) {
    return true;
  }
  return subject.tags.some((t) =>
    ["root_cause_required", "horizontal_check", "effectiveness_verification"].includes(
      t.toLowerCase(),
    ),
  );
}

function hasShallowRootCause(text: string): boolean {
  return /human error|insufficient checking|improper filling|careless|just a mistake/i.test(
    text,
  );
}

function challengesShallowRootCause(text: string): boolean {
  return /challenge|shallow|root.?cause|person\s*→|horizontal|not accept|do not accept/i.test(
    text,
  );
}

const EXEC_LONG_CHARS = 1800;

/**
 * Evaluate Quality Gate Rules v1.0 against a subject.
 * If `proposedReadiness` would be READY with criticals, enforcedReadiness demotes it.
 */
export function evaluateQualityGateV1(
  subject: QualityGateSubject,
): QualityGateEvaluation {
  const criticalFailures: GateFinding[] = [];
  const warnings: GateFinding[] = [];
  const prose = blob([
    subject.recommendation,
    subject.presidentDecision,
    subject.why,
    ...subject.confirmedTexts,
    ...subject.unverifiedTexts,
    ...subject.assumptionTexts,
    subject.learning.notes ?? "",
  ]);
  const recWhy = blob([subject.recommendation, subject.presidentDecision, subject.why]);

  // --- Critical: authorities ---
  if (subject.decisionAuthorities.length === 0) {
    criticalFailures.push(
      finding(
        "DECISION_AUTHORITY_UNCLEAR",
        "No decision authorities defined.",
        ["executive.decisionAuthorities"],
      ),
    );
  }

  const authBlob = blob(
    subject.decisionAuthorities.map((a) => `${a.roleLabel} ${a.authority}`),
  );
  if (
    /visa|document chasing|personally manage every/i.test(recWhy) &&
    /president/i.test(authBlob) &&
    subject.decisionAuthorities.length <= 1
  ) {
    criticalFailures.push(
      finding(
        "DECISION_AUTHORITY_UNCLEAR",
        "President appears as sole owner of routine/delegable work.",
      ),
    );
  }

  // --- Critical: missing facts ---
  for (const m of subject.missing) {
    if (m.blocksReadiness) {
      criticalFailures.push(
        finding(
          "CRITICAL_FACT_MISSING",
          `Blocking missing information: ${m.text} (who: ${m.who}).`,
          ["facts.missingInformation"],
        ),
      );
    }
  }

  // --- Critical: safety / compliance ---
  if (
    /safety emergency|minimum safe manning emergency|must replace immediately for safety/i.test(
      recWhy,
    ) &&
    /no immediate (?:safety|manning)/i.test(
      blob(subject.confirmedTexts),
    ) === false &&
    /invent|force nansha|insist on nansha/i.test(recWhy)
  ) {
    criticalFailures.push(
      finding(
        "SAFETY_OR_COMPLIANCE_UNRESOLVED",
        "Recommendation invents or mishandles safety/compliance urgency.",
      ),
    );
  }
  if (
    subject.impliesClosure &&
    /photo|photograph/i.test(recWhy) &&
    /closed|close the case|treat.*closed/i.test(recWhy) &&
    !/do not treat|not treat.*closed|must not close/i.test(recWhy)
  ) {
    criticalFailures.push(
      finding(
        "SAFETY_OR_COMPLIANCE_UNRESOLVED",
        "Compliance closure implied from photographs alone.",
      ),
    );
  }

  // --- Critical: professional boundary ---
  if (
    /class(?:nk)? has approved everything|definitely applies to all cms|class acceptance is confirmed for all/i.test(
      recWhy,
    )
  ) {
    criticalFailures.push(
      finding(
        "PROFESSIONAL_BOUNDARY_VIOLATION",
        "States Class acceptance as definite without confirmation.",
      ),
    );
  }
  if (
    /earth.?fault.*(?:closed|cleared)|declare.*electrical.*closed/i.test(recWhy) &&
    !/do not declare|must not declare|tech(?:nical)? (?:supt|superintendent)/i.test(
      recWhy,
    )
  ) {
    criticalFailures.push(
      finding(
        "PROFESSIONAL_BOUNDARY_VIOLATION",
        "Technical/electrical closure asserted without Technical Superintendent verification.",
      ),
    );
  }
  if (
    /president (?:should|must) (?:personally )?(?:inspect|make.*technical judgment|interpret class)/i.test(
      recWhy,
    )
  ) {
    criticalFailures.push(
      finding(
        "PROFESSIONAL_BOUNDARY_VIOLATION",
        "President substituted for specialist technical/Class judgment.",
      ),
    );
  }

  // --- Finance dependency (skip non-finance) ---
  const financeActive =
    subject.primaryCaseType === "FINANCE_COMMERCIAL" ||
    subject.finance?.present === true;
  if (financeActive) {
    if (subject.finance && subject.finance.separationPreserved === false) {
      criticalFailures.push(
        finding(
          "RECOMMENDATION_UNSUPPORTED",
          "Necessary ≠ Affordable separation not preserved.",
        ),
      );
    }
    if (
      /necessary and affordable|affordable because necessary|collapse.*necessary/i.test(
        recWhy,
      )
    ) {
      criticalFailures.push(
        finding(
          "RECOMMENDATION_UNSUPPORTED",
          "Necessary and Affordable collapsed in recommendation.",
        ),
      );
    }
    if (
      subject.finance &&
      subject.finance.doNotAuthorizePayment === false
    ) {
      criticalFailures.push(
        finding(
          "PROFESSIONAL_BOUNDARY_VIOLATION",
          "Finance output must not authorize payments/transfers.",
        ),
      );
    }
    const liquidityOk = subject.finance?.liquidityConfirmed === true;
    if (
      subject.decisionReadiness === "READY" &&
      liquidityOk !== true &&
      /liquidity|cash.?position|ctm/i.test(recWhy)
    ) {
      criticalFailures.push(
        finding(
          "FINANCIAL_DEPENDENCY_UNRESOLVED",
          "READY claimed while required Company liquidity remains unconfirmed.",
        ),
      );
    }
    if (/treat.*receipt.*as (?:received|confirmed)|uncertain future receipts as received/i.test(recWhy)) {
      criticalFailures.push(
        finding(
          "FINANCIAL_DEPENDENCY_UNRESOLVED",
          "Uncertain receipts treated as received.",
        ),
      );
    }
  }

  // --- Recommendation unsupported / contradictions ---
  if (
    /force nansha|insist on nansha|must keep original nansha plan/i.test(recWhy)
  ) {
    criticalFailures.push(
      finding(
        "RECOMMENDATION_UNSUPPORTED",
        "Recommendation insists on impractical Nansha plan against facts.",
      ),
    );
  }

  const derivedAsConfirmed = subject.confirmedTexts.some((t) =>
    /adjusted\s*(?:balance|≈)|derived (?:from|calculation)|vessel-?side requirement.*≈/i.test(
      t,
    ),
  );
  if (financeActive && derivedAsConfirmed) {
    criticalFailures.push(
      finding(
        "FACT_RECOMMENDATION_CONTRADICTION",
        "Derived finance values must not appear as Confirmed Facts.",
        ["facts.confirmed"],
      ),
    );
  }

  const hypothesisInConfirmed = subject.confirmedTexts.some((t) =>
    /system weakness|broader weakness/i.test(t),
  );
  if (hypothesisInConfirmed) {
    criticalFailures.push(
      finding(
        "FACT_RECOMMENDATION_CONTRADICTION",
        "System-weakness hypothesis must not be stored as Confirmed Fact.",
      ),
    );
  }

  // --- Shallow RC (only if materially required) ---
  if (rootCauseMateriallyRequired(subject)) {
    const shallowPresent =
      hasShallowRootCause(prose) ||
      subject.unverifiedTexts.some((t) => hasShallowRootCause(t));
    const challenged = challengesShallowRootCause(recWhy);
    if (shallowPresent) {
      const closingOrReady =
        subject.decisionReadiness === "READY" ||
        subject.impliesClosure ||
        (/accept(?:s|ed)? (?:shallow )?root cause|root cause (?:is )?adequate|close.*because.*corrected/i.test(
          recWhy,
        ) &&
          !challenged);
      if (closingOrReady && !challenged) {
        criticalFailures.push(
          finding(
            "RECOMMENDATION_UNSUPPORTED",
            "Root-cause-required case cannot be READY/closed while accepting shallow root causes.",
          ),
        );
      } else {
        warnings.push(
          finding(
            "WARN_SHALLOW_ROOT_CAUSE",
            "Shallow root-cause language present; challenge before closure.",
          ),
        );
      }
    } else if (challenged && subject.decisionReadiness !== "READY") {
      // RC-required CONDITIONAL briefs that explicitly challenge causes (GC03)
      warnings.push(
        finding(
          "WARN_SHALLOW_ROOT_CAUSE",
          "Root-cause quality must remain challenged before Company closure.",
        ),
      );
    }
  }

  // --- Stale info: warn; escalate when material ---
  const staleHint =
    /as of|liquidity|current (?:cash|class|flag|crew|document|survey)|near (?:the )?remittance|time-sensitive/i.test(
      prose,
    ) &&
    (subject.finance?.liquidityConfirmed === false ||
      /unconfirmed|not yet|pending confirmation|near remittance/i.test(prose));
  if (staleHint || (financeActive && subject.finance?.liquidityConfirmed === false)) {
    const materialReadyClaim = subject.decisionReadiness === "READY";
    if (materialReadyClaim && financeActive) {
      criticalFailures.push(
        finding(
          "FINANCIAL_DEPENDENCY_UNRESOLVED",
          "Decision materially depends on current liquidity that is not confirmed (stale/current info escalation).",
        ),
      );
    } else if (financeActive && subject.finance?.liquidityConfirmed === false) {
      warnings.push(
        finding(
          "WARN_STALE_OR_CURRENT_INFO",
          "Company liquidity / remittance-timed figures need current confirmation.",
        ),
      );
    } else if (staleHint) {
      warnings.push(
        finding(
          "WARN_STALE_OR_CURRENT_INFO",
          "Time-sensitive information may need refresh before final action.",
        ),
      );
    }
  }

  // --- Optional evidence ---
  const optionalMissing = subject.missing.filter((m) => !m.blocksReadiness);
  if (optionalMissing.length > 0) {
    warnings.push(
      finding(
        "WARN_OPTIONAL_EVIDENCE_MISSING",
        `Non-blocking missing information: ${optionalMissing.map((m) => m.text).join("; ")}`,
      ),
    );
  }

  // --- Weak delegation ---
  if (
    subject.nextActions.length === 0 &&
    subject.decisionAuthorities.some((a) => /president/i.test(a.authority))
  ) {
    warnings.push(
      finding(
        "WARN_WEAK_DELEGATION",
        "Next Actions empty while President-level decision work remains.",
      ),
    );
  }
  if (
    subject.nextActions.some((a) =>
      /visa|document chasing|personally chase/i.test(`${a.who} ${a.what}`),
    ) &&
    subject.nextActions.some((a) => /president/i.test(a.who))
  ) {
    warnings.push(
      finding(
        "WARN_WEAK_DELEGATION",
        "Routine document/visa work assigned to President.",
      ),
    );
  }

  // --- Overlong executive ---
  const execLen =
    subject.recommendation.length +
    subject.presidentDecision.length +
    subject.why.length;
  if (execLen > EXEC_LONG_CHARS) {
    warnings.push(
      finding(
        "WARN_OVERLONG_EXECUTIVE",
        "Executive Decision prose exceeds ~30-second comprehension budget.",
      ),
    );
  }

  // --- Unnecessary escalation ---
  if (
    subject.primaryCaseType === "CREW_MANNING" &&
    subject.learning.managementReviewCandidate
  ) {
    warnings.push(
      finding(
        "WARN_UNNECESSARY_ESCALATION",
        "MR Candidate unusual for ordinary crew-change planning.",
      ),
    );
  }
  if (/class attendance for every|attend every cms item/i.test(recWhy)) {
    warnings.push(
      finding(
        "WARN_UNNECESSARY_ESCALATION",
        "Unnecessary Class attendance suggested without evidence.",
      ),
    );
  }

  // --- Hypothesis as fact risk ---
  if (
    subject.assumptionTexts.some((t) => /weakness|hypothesis/i.test(t)) ||
    /broader (?:system )?weakness/i.test(recWhy)
  ) {
    warnings.push(
      finding(
        "WARN_HYPOTHESIS_AS_FACT_RISK",
        "Keep system-weakness language labeled as hypothesis, not confirmed fact.",
      ),
    );
  }

  // --- Review / learning ---
  if (
    subject.learning.managementReviewCandidate &&
    !subject.reviewCandidate.flag &&
    !subject.reviewCandidate.monitorOnly
  ) {
    warnings.push(
      finding(
        "WARN_REVIEW_LEARNING_OPPORTUNITY",
        "Management Review Candidate YES should normally set reviewCandidate.flag true.",
      ),
    );
  }
  if (subject.reviewCandidate.monitorOnly) {
    warnings.push(
      finding(
        "WARN_MONITOR_REVIEW",
        "Soft monitor path without hard Review Candidate commitment.",
      ),
    );
  }

  // Deduplicate by code+message
  const dedupe = (list: GateFinding[]) => {
    const seen = new Set<string>();
    return list.filter((f) => {
      const k = `${f.code}::${f.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const criticals = dedupe(criticalFailures);
  const warns = dedupe(warnings);

  const passed = criticals.length === 0;
  let enforcedReadiness = subject.decisionReadiness;
  if (!passed && enforcedReadiness === "READY") {
    enforcedReadiness = financeActive ? "CONDITIONAL" : "NOT_READY";
    // Prefer CONDITIONAL when a direction exists but criticals remain (Schema R3)
    if (
      subject.recommendation.trim().length > 0 &&
      criticals.every((c) => c.code !== "SAFETY_OR_COMPLIANCE_UNRESOLVED")
    ) {
      enforcedReadiness = "CONDITIONAL";
    }
  }

  // Critical override: proceed allowed; never READY; findings remain
  const override = subject.override;
  const proceedDespiteCritical = Boolean(
    override?.proceedDespiteCritical &&
      override.justification.trim().length > 0 &&
      override.actor.trim().length > 0,
  );
  if (proceedDespiteCritical && !passed) {
    if (enforcedReadiness === "READY") {
      enforcedReadiness = "CONDITIONAL";
    }
  }

  return {
    passed,
    criticalFailures: criticals,
    warnings: warns,
    evaluatedAt: new Date().toISOString(),
    enforcedReadiness,
    proceedDespiteCritical: proceedDespiteCritical && !passed,
  };
}

/** Map Schema v1.0 structured output into a gate subject. */
export function subjectFromStructuredOutput(
  output: MddStructuredOutput,
  extra?: Partial<QualityGateSubject>,
): QualityGateSubject {
  return {
    primaryCaseType: output.primaryCaseType,
    tags: output.tags,
    decisionReadiness: output.executive.decisionReadiness,
    recommendation: output.executive.recommendation.text,
    presidentDecision: output.executive.presidentDecision.text,
    why: output.executive.why.text,
    decisionAuthorities: output.executive.decisionAuthorities.map((a) => ({
      roleLabel: a.roleLabel,
      authority: a.authority,
    })),
    nextActions: output.executive.nextActions.map((a) => ({
      who: a.who,
      what: a.what,
      dueOrTrigger: a.dueOrTrigger,
    })),
    confirmedTexts: output.facts.confirmed.map((f) => f.text),
    unverifiedTexts: output.facts.unverified.map((f) => f.text),
    assumptionTexts: output.facts.assumptions.map((f) => f.text),
    missing: output.facts.missingInformation.map((m) => ({
      text: m.text,
      who: m.who,
      what: m.what,
      evidenceRequired: m.evidenceRequired,
      blocksReadiness: m.blocksReadiness,
    })),
    risks: output.risks,
    optionsCount: output.options.length,
    professionalBoundaryIssues: output.professionalBoundaries.map((p) => p.issue),
    learning: {
      managementReviewCandidate: output.learning.managementReviewCandidate,
      internalAuditCandidate: output.learning.internalAuditCandidate,
      knowledgeUpdateCandidate: output.learning.knowledgeUpdateCandidate,
      notes: output.learning.notes,
    },
    reviewCandidate: {
      flag: output.reviewCandidate.flag,
      monitorOnly: output.reviewCandidate.monitorOnly,
    },
    finance: output.finance
      ? {
          present: true,
          separationPreserved: output.finance.separationPreserved,
          liquidityConfirmed:
            output.finance.companyFinancialFeasibility?.liquidityConfirmed ===
              true ||
            output.finance.sourceFacts?.companyLiquidityConfirmed === true ||
            output.finance.snapshot?.companyLiquidityConfirmed === true,
          doNotAuthorizePayment: output.finance.doNotAuthorizePayment,
        }
      : undefined,
    impliesClosure: /treat.*closed|case (?:is )?closed|close (?:the )?case/i.test(
      `${output.executive.recommendation.text} ${output.executive.presidentDecision.text}`,
    ) &&
      !/do not treat|not treat.*closed|must not close|do not close/i.test(
        `${output.executive.recommendation.text} ${output.executive.presidentDecision.text}`,
      ),
    ...extra,
  };
}

/** Adapter from Phase-1 DecisionBrief-shaped proposal. */
export function subjectFromProposal(input: {
  primaryCaseType: CaseType;
  tags?: string[];
  recommendation: string;
  presidentDecision: string;
  why: string;
  decisionReadiness: DecisionReadiness;
  decisionAuthorities: { roleLabel: string; authority: string }[];
  nextActions?: { owner: string; text: string; dueDate?: string }[];
  confirmedFacts?: { text: string }[];
  unverifiedFacts?: { text: string }[];
  assumptions?: { text: string }[];
  missingInformation?: {
    text: string;
    who?: string;
    what?: string;
    evidenceRequired?: string;
  }[];
  learning?: QualityGateSubject["learning"];
  reviewCandidateFlag?: boolean;
  financeSnapshot?: {
    companyLiquidityConfirmed?: boolean;
  };
  override?: CriticalOverrideRecord | null;
}): QualityGateSubject {
  const missing = (input.missingInformation ?? []).map((m) => {
    const text = m.text;
    const blocks =
      /liquidity|earth fault|class (?:acceptance|confirmation)|safety|compliance/i.test(
        text,
      ) && input.decisionReadiness === "READY";
    return {
      text,
      who: m.who ?? "Case owner",
      what: m.what ?? text,
      evidenceRequired: m.evidenceRequired ?? "Confirmation evidence",
      blocksReadiness: blocks,
    };
  });

  return {
    primaryCaseType: input.primaryCaseType,
    tags: input.tags ?? [],
    decisionReadiness: input.decisionReadiness,
    recommendation: input.recommendation,
    presidentDecision: input.presidentDecision,
    why: input.why,
    decisionAuthorities: input.decisionAuthorities,
    nextActions: (input.nextActions ?? []).map((a) => ({
      who: a.owner,
      what: a.text,
      dueOrTrigger: a.dueDate,
    })),
    confirmedTexts: (input.confirmedFacts ?? []).map((f) => f.text),
    unverifiedTexts: (input.unverifiedFacts ?? []).map((f) => f.text),
    assumptionTexts: (input.assumptions ?? []).map((f) => f.text),
    missing,
    risks: [],
    optionsCount: 0,
    professionalBoundaryIssues: [],
    learning: input.learning ?? {
      managementReviewCandidate: false,
      internalAuditCandidate: false,
      knowledgeUpdateCandidate: false,
    },
    reviewCandidate: {
      flag: Boolean(input.reviewCandidateFlag),
      monitorOnly: false,
    },
    finance:
      input.primaryCaseType === "FINANCE_COMMERCIAL"
        ? {
            present: true,
            separationPreserved: !/necessary and affordable/i.test(
              `${input.recommendation} ${input.why}`,
            ),
            liquidityConfirmed:
              input.financeSnapshot?.companyLiquidityConfirmed === true,
            doNotAuthorizePayment: true,
          }
        : undefined,
    impliesClosure:
      /treat.*closed|close (?:the )?case/i.test(
        `${input.recommendation} ${input.presidentDecision}`,
      ) &&
      !/do not treat|not treat.*closed|must not close|do not close/i.test(
        `${input.recommendation} ${input.presidentDecision}`,
      ),
    override: input.override ?? null,
  };
}

/** Apply enforced readiness + Schema-shaped qualityGate onto a brief-like object. */
export function toSchemaQualityGate(evaluation: QualityGateEvaluation) {
  return {
    passed: evaluation.passed,
    criticalFailures: evaluation.criticalFailures,
    warnings: evaluation.warnings,
    evaluatedAt: evaluation.evaluatedAt,
  };
}
