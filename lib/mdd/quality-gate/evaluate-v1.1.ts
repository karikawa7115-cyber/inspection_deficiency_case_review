/**
 * Quality Gate Rules v1.1 (frozen, active) evaluator.
 * Human SSoT: docs/mdd/QUALITY_GATE_RULES_v1.1.md
 * Clarifies decision-stage-aware CRITICAL_FACT_MISSING vs v1.0.
 * Does not weaken Schema enums / authority / review / boundary rules.
 * Does not connect production LLM.
 */
import type {
  CriticalOverrideRecord,
  GateFinding,
  GateFindingCode,
  QualityGateEvaluation,
  QualityGateSubject,
} from "./evaluate-v1";
import {
  subjectFromProposal,
  subjectFromStructuredOutput,
  toSchemaQualityGate,
} from "./evaluate-v1";

export type {
  CriticalOverrideRecord,
  GateFinding,
  GateFindingCode,
  QualityGateEvaluation,
  QualityGateSubject,
} from "./evaluate-v1";

export {
  subjectFromProposal,
  subjectFromStructuredOutput,
  toSchemaQualityGate,
};

/** Decision-stage classification for missing information (v1.1 §2.1.1). */
export type MissingInformationStage =
  | "DECISION_BLOCKING"
  | "EXECUTION_CONDITION"
  | "CLOSURE_OR_EFFECTIVENESS_CONDITION";

export type MissingInformationClassification = {
  stage: MissingInformationStage;
  text: string;
  who: string;
  what: string;
  evidenceRequired: string;
  blocksReadinessHint?: boolean;
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
    [
      "root_cause_required",
      "horizontal_check",
      "effectiveness_verification",
    ].includes(t.toLowerCase()),
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

const CLOSURE_OR_EFFECTIVENESS_RE =
  /root\s*cause|horizontal\s*check|effectiveness|corrective\s*action|preventive\s*action|closure\s*evidence|verify\s*effectiveness|effectiveness\s*verification|system\s*weakness\s*evidence|person\s*(?:→|->)\s*procedure/i;

const EXECUTION_CONDITION_RE =
  /class\s*nk|classnk|class\s+(?:confirmation|acceptance|clarification|reply|response)|written\s+class|re-?confirmation|company\s+liquidity|liquidity\s+confirm|current\s+(?:cash|liquidity|smbc)|remittance|before\s+(?:remit|transfer|payment|execution)|final\s+(?:ctm|approval|remittance)|payee|execution\s+confirm|focused\s+confirmation/i;

const DECISION_BLOCKING_RE =
  /cannot\s+decide|blocks?\s+(?:the\s+)?decision|decision\s+cannot|unable\s+to\s+(?:decide|determine)|unknown\s+whether\s+(?:a\s+)?(?:safety|manning|emergency)|principal\s+direction\s+unknown|no\s+basis\s+to\s+decide/i;

/**
 * Classify one missing-information item by decision stage.
 * `blocksReadiness` is a hint only — stage is authoritative for Critical emission.
 */
export function classifyMissingInformationStage(
  item: {
    text: string;
    who: string;
    what: string;
    evidenceRequired: string;
    blocksReadiness?: boolean;
  },
  ctx?: { primaryCaseType?: string; tags?: string[] },
): MissingInformationStage {
  const hay = blob([
    item.text,
    item.who,
    item.what,
    item.evidenceRequired,
  ]);

  if (DECISION_BLOCKING_RE.test(hay)) {
    return "DECISION_BLOCKING";
  }

  if (CLOSURE_OR_EFFECTIVENESS_RE.test(hay)) {
    return "CLOSURE_OR_EFFECTIVENESS_CONDITION";
  }

  if (EXECUTION_CONDITION_RE.test(hay)) {
    return "EXECUTION_CONDITION";
  }

  // Case-type priors for common Golden alignments when wording is thin
  if (
    ctx?.primaryCaseType === "TECHNICAL" &&
    /class|cms|acceptance|scope/i.test(hay)
  ) {
    return "EXECUTION_CONDITION";
  }
  if (
    ctx?.primaryCaseType === "FINANCE_COMMERCIAL" &&
    /liquidity|cash|ctm|afford/i.test(hay)
  ) {
    return "EXECUTION_CONDITION";
  }
  if (
    (ctx?.primaryCaseType === "INSPECTION_COMPLIANCE" ||
      ctx?.primaryCaseType === "ISM_MANAGEMENT" ||
      ctx?.tags?.some((t) =>
        /root_cause|horizontal|effectiveness/i.test(t),
      )) &&
    /confirm|evidence|verification|deficiency|rectif/i.test(hay)
  ) {
    return "CLOSURE_OR_EFFECTIVENESS_CONDITION";
  }

  // JP port / ETA style optional detail
  if (/port|eta|schedule|travel\s+doc/i.test(hay)) {
    return "EXECUTION_CONDITION";
  }

  // Residual: only treat as decision-blocking when model asserted blocksReadiness
  // and no execution/closure pattern matched — truly unknown material gap.
  if (item.blocksReadiness === true) {
    return "DECISION_BLOCKING";
  }

  return "EXECUTION_CONDITION";
}

function classifyAllMissing(
  subject: QualityGateSubject,
): MissingInformationClassification[] {
  return subject.missing.map((m) => ({
    stage: classifyMissingInformationStage(m, {
      primaryCaseType: subject.primaryCaseType,
      tags: subject.tags,
    }),
    text: m.text,
    who: m.who,
    what: m.what,
    evidenceRequired: m.evidenceRequired,
    blocksReadinessHint: m.blocksReadiness,
  }));
}

/**
 * Evaluate Quality Gate Rules v1.1 (candidate) against a subject.
 */
export function evaluateQualityGateV1_1(
  subject: QualityGateSubject,
): QualityGateEvaluation & {
  missingClassifications: MissingInformationClassification[];
} {
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
  const recWhy = blob([
    subject.recommendation,
    subject.presidentDecision,
    subject.why,
  ]);

  const missingClassifications = classifyAllMissing(subject);

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

  // --- Critical / Warning: missing facts (stage-aware) ---
  let hasDecisionBlockingMissing = false;
  let hasExecutionOrClosureOnly = false;
  const executionOrClosure = missingClassifications.filter(
    (c) =>
      c.stage === "EXECUTION_CONDITION" ||
      c.stage === "CLOSURE_OR_EFFECTIVENESS_CONDITION",
  );
  const decisionBlocking = missingClassifications.filter(
    (c) => c.stage === "DECISION_BLOCKING",
  );

  for (const c of decisionBlocking) {
    hasDecisionBlockingMissing = true;
    criticalFailures.push(
      finding(
        "CRITICAL_FACT_MISSING",
        `Decision-blocking missing information: ${c.text} (who: ${c.who}).`,
        ["facts.missingInformation", "missingInformation.stage:DECISION_BLOCKING"],
      ),
    );
  }

  if (executionOrClosure.length > 0 && decisionBlocking.length === 0) {
    hasExecutionOrClosureOnly = true;
  }

  for (const c of executionOrClosure) {
    if (c.stage === "CLOSURE_OR_EFFECTIVENESS_CONDITION") {
      if (rootCauseMateriallyRequired(subject)) {
        warnings.push(
          finding(
            "WARN_SHALLOW_ROOT_CAUSE",
            `Closure/effectiveness condition remains open: ${c.text}`,
            [
              "facts.missingInformation",
              "missingInformation.stage:CLOSURE_OR_EFFECTIVENESS_CONDITION",
            ],
          ),
        );
      } else {
        warnings.push(
          finding(
            "WARN_OPTIONAL_EVIDENCE_MISSING",
            `Closure/effectiveness condition (non-blocking for current decision): ${c.text}`,
            [
              "facts.missingInformation",
              "missingInformation.stage:CLOSURE_OR_EFFECTIVENESS_CONDITION",
            ],
          ),
        );
      }
    } else {
      // EXECUTION_CONDITION
      const liquidityLike =
        /liquidity|cash|remittance|ctm/i.test(c.text) ||
        /liquidity|cash|remittance|ctm/i.test(c.what);
      warnings.push(
        finding(
          liquidityLike
            ? "WARN_STALE_OR_CURRENT_INFO"
            : "WARN_OPTIONAL_EVIDENCE_MISSING",
          `Execution condition (direction may proceed CONDITIONAL): ${c.text}`,
          [
            "facts.missingInformation",
            "missingInformation.stage:EXECUTION_CONDITION",
          ],
        ),
      );
    }
  }

  // Optional missings already classified as EXECUTION without blocks — covered above.
  // Items with no text match that returned EXECUTION via residual false blocksReadiness
  // are included in executionOrClosure.

  // --- Critical: safety / compliance ---
  if (
    /safety emergency|minimum safe manning emergency|must replace immediately for safety/i.test(
      recWhy,
    ) &&
    /no immediate (?:safety|manning)/i.test(blob(subject.confirmedTexts)) ===
      false &&
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
    /earth.?fault.*(?:closed|cleared)|declare.*electrical.*closed/i.test(
      recWhy,
    ) &&
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

  // --- Finance dependency (v0.1.1 P1: F1∨F2∨F3; F0 = extension alone insufficient) ---
  // Callers should set financeGateActive via resolveFinanceGateActivation.
  // If unset: F1 only (FINANCE_COMMERCIAL) — do NOT treat llm finance.present alone as active.
  const financeActive =
    subject.financeGateActive === true ||
    (subject.financeGateActive === undefined &&
      subject.primaryCaseType === "FINANCE_COMMERCIAL");
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
    if (subject.finance && subject.finance.doNotAuthorizePayment === false) {
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
    if (
      /treat.*receipt.*as (?:received|confirmed)|uncertain future receipts as received/i.test(
        recWhy,
      )
    ) {
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
      warnings.push(
        finding(
          "WARN_SHALLOW_ROOT_CAUSE",
          "Root-cause quality must remain challenged before Company closure.",
        ),
      );
    }
  }

  // --- Stale info: warn; escalate when material READY ---
  const staleHint =
    /as of|liquidity|current (?:cash|class|flag|crew|document|survey)|near (?:the )?remittance|time-sensitive/i.test(
      prose,
    ) &&
    (subject.finance?.liquidityConfirmed === false ||
      /unconfirmed|not yet|pending confirmation|near remittance/i.test(prose));
  if (
    staleHint ||
    (financeActive && subject.finance?.liquidityConfirmed === false)
  ) {
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

  // READY forbidden while any Critical remains
  if (!passed && enforcedReadiness === "READY") {
    enforcedReadiness = financeActive ? "CONDITIONAL" : "NOT_READY";
    if (
      subject.recommendation.trim().length > 0 &&
      criticals.every((c) => c.code !== "SAFETY_OR_COMPLIANCE_UNRESOLVED")
    ) {
      enforcedReadiness = "CONDITIONAL";
    }
  }

  // EXECUTION / CLOSURE only → do not auto-force NOT_READY
  if (
    passed &&
    hasExecutionOrClosureOnly &&
    !hasDecisionBlockingMissing &&
    enforcedReadiness === "NOT_READY"
  ) {
    enforcedReadiness = "CONDITIONAL";
  }

  // READY + material execution/closure conditions (Class confirm, liquidity, RC closure)
  // → CONDITIONAL. Ordinary non-material warnings (e.g. JP port/ETA) must NOT downgrade READY.
  if (passed && enforcedReadiness === "READY") {
    const materialPending = executionOrClosure.some((c) => {
      const t = `${c.text} ${c.what}`.toLowerCase();
      if (
        /\b(port|eta)\b/.test(t) &&
        !/class|liquidity|root\s*cause|horizontal|effectiveness/.test(t)
      ) {
        return false;
      }
      return /class(?:nk)?|liquidity|remittance|root\s*cause|horizontal|effectiveness|corrective\s*action/.test(
        t,
      );
    });
    if (materialPending) {
      enforcedReadiness = "CONDITIONAL";
    }
  }

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
    missingClassifications,
  };
}
