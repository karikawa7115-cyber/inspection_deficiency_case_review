/**
 * Decision Policy v0.2 — Review Candidate B-guarded + Management Review hybrid ownership.
 * Removes R6b assumption that LLM MR=true forces Review=true.
 */
import type { CurrentDecisionQuestion, DecisionClass } from "../case-envelope/current-decision-question";
import type { MddStructuredOutput } from "../schema/structured-output-v1";

export type ReviewPolicyCriteria = {
  Repeat: boolean;
  HighRisk: boolean;
  SystemWeakness: boolean;
  FleetWide: boolean;
  IneffectiveCA: boolean;
  KnowledgeGap: boolean;
  ReportingFailure: boolean;
  ExternalSignal: boolean;
};

export type ReviewPolicyEvaluation = {
  fires: boolean;
  criteria: ReviewPolicyCriteria;
};

export function evaluateReviewPolicyCriteria(input: {
  decisionClass: DecisionClass;
  primaryCaseType: string;
  cdq: CurrentDecisionQuestion;
  controlled: MddStructuredOutput;
}): ReviewPolicyEvaluation {
  const c = input.controlled;
  const learning = c.learning;
  const prose = [
    c.executive.recommendation.text,
    c.executive.presidentDecision.text,
    c.executive.why.text,
    input.cdq.decisionRequiredNow,
    ...c.facts.assumptions.map((a) => a.text),
    ...c.facts.confirmed.map((f) => f.text),
  ].join("\n");

  const HighRisk =
    input.primaryCaseType === "INSPECTION_COMPLIANCE" ||
    input.primaryCaseType === "ISM_MANAGEMENT" ||
    input.decisionClass === "inspection_non_closure" ||
    /high[\s-]?risk|safety.?critical|compliance.?critical/i.test(prose);

  const ExternalSignal =
    c.executive.decisionAuthorities.some((a) =>
      /Flag Administration|External Authority|Class/i.test(String(a.authority)),
    ) ||
    /flag|asi|class|external|psc|port state/i.test(
      `${input.cdq.decisionRequiredNow} ${input.cdq.expectedDecider}`,
    );

  const SystemWeakness =
    c.tags.some((t) => /system_weakness|root_cause|sms/i.test(t)) ||
    c.facts.assumptions.some((a) =>
      /system weakness|broader weakness|sms (?:gap|weak)/i.test(a.text),
    ) ||
    /system weakness/i.test(prose);

  const FleetWide =
    learning.fleetWideRelevance === "yes" ||
    learning.fleetWideRelevance === "possible";

  const IneffectiveCA =
    (learning.correctiveAction || learning.preventiveAction) &&
    /ineffective|failed capa|repeat capa|not effective/i.test(prose);

  const Repeat =
    /repeat(?:ed)?|recurrence|recurring|same deficiency again/i.test(prose) ||
    c.tags.some((t) => /repeat|recurrence/i.test(t));

  const KnowledgeGap =
    learning.knowledgeUpdateCandidate === true &&
    /procedure|knowledge|guidance|unknown|unclear (?:rule|requirement)/i.test(
      prose,
    );

  const ReportingFailure =
    c.tags.some((t) => /recordkeeping|document_control|reporting/i.test(t)) ||
    /reporting failure|recordkeeping|document control failure|not reported/i.test(
      prose,
    );

  const criteria: ReviewPolicyCriteria = {
    Repeat,
    HighRisk,
    SystemWeakness,
    FleetWide,
    IneffectiveCA,
    KnowledgeGap,
    ReportingFailure,
    ExternalSignal,
  };

  // Retention: HighRisk alone is insufficient without another retention signal
  // (avoids marking every inspection as Review). Require HighRisk + (External|System|…)
  // OR any strong standalone signal (Repeat, FleetWide, IneffectiveCA, KnowledgeGap, ReportingFailure).
  const strongStandalone =
    Repeat || FleetWide || IneffectiveCA || KnowledgeGap || ReportingFailure;
  const highRiskBundle =
    HighRisk && (ExternalSignal || SystemWeakness || strongStandalone);

  const fires = strongStandalone || highRiskBundle;

  return { fires, criteria };
}

export type ReviewCandidateApplyResult = {
  reviewFlagChanged: boolean;
  mrFiltered: boolean;
  previousReviewFlag: boolean;
  finalReviewFlag: boolean;
  previousMr: boolean;
  finalMr: boolean;
  criteria: ReviewPolicyCriteria;
  fires: boolean;
};

/**
 * Apply B-guarded Review flag + Option-2 hybrid MR on assembled controlled draft.
 * originalLlmDraft is not mutated (caller keeps it separately).
 */
export function applyReviewCandidateBGuarded(input: {
  controlled: MddStructuredOutput;
  decisionClass: DecisionClass;
  cdq: CurrentDecisionQuestion;
}): ReviewCandidateApplyResult {
  const { fires, criteria } = evaluateReviewPolicyCriteria({
    decisionClass: input.decisionClass,
    primaryCaseType: input.controlled.primaryCaseType,
    cdq: input.cdq,
    controlled: input.controlled,
  });

  const previousReviewFlag = input.controlled.reviewCandidate.flag === true;
  const previousMr =
    input.controlled.learning.managementReviewCandidate === true;

  const finalReviewFlag = fires;
  let finalMr = previousMr;
  let mrFiltered = false;

  // Hybrid Option 2: when Review policy does not fire, assembled MR must not stay true
  // (Canonical coherence without R6b forcing Review from MR).
  if (!fires && previousMr) {
    finalMr = false;
    mrFiltered = true;
  }

  input.controlled.reviewCandidate = {
    ...input.controlled.reviewCandidate,
    flag: finalReviewFlag,
    retainAfterClose: finalReviewFlag
      ? true
      : input.controlled.reviewCandidate.retainAfterClose,
    monitorOnly: finalReviewFlag
      ? false
      : input.controlled.reviewCandidate.monitorOnly,
    reason: finalReviewFlag
      ? input.controlled.reviewCandidate.reason ??
        "Review Candidate set by generalized retention policy (Decision Policy v0.2)."
      : fires
        ? input.controlled.reviewCandidate.reason
        : previousReviewFlag
          ? "Review Candidate cleared — no qualifying retention criteria (Decision Policy v0.2)."
          : input.controlled.reviewCandidate.reason,
  };

  input.controlled.learning = {
    ...input.controlled.learning,
    managementReviewCandidate: finalMr,
  };

  return {
    reviewFlagChanged: previousReviewFlag !== finalReviewFlag,
    mrFiltered,
    previousReviewFlag,
    finalReviewFlag,
    previousMr,
    finalMr,
    criteria,
    fires,
  };
}
