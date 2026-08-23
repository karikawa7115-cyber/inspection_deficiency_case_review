/**
 * Allowlisted refill payload — no readiness, no Golden strings, no learning/review/gate.
 */
import type {
  CaseEnvelope,
  CurrentDecisionQuestion,
} from "../case-envelope/current-decision-question";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import type { PresidentProseDefectClass } from "./prose-defect";

export type SemanticRefillTriggerMetadata = {
  defectClass: Exclude<PresidentProseDefectClass, null>;
  needsSemanticFill: true;
  originalPresidentDecisionText: string;
  requiredNow: true;
};

export type SemanticRefillAllowlistedPayload = {
  currentDecisionQuestion: CurrentDecisionQuestion;
  primaryCaseType: MddStructuredOutput["primaryCaseType"];
  decisionAuthorities: MddStructuredOutput["executive"]["decisionAuthorities"];
  facts: {
    confirmed: MddStructuredOutput["facts"]["confirmed"];
    unverified: MddStructuredOutput["facts"]["unverified"];
    assumptions: MddStructuredOutput["facts"]["assumptions"];
    missingInformation: MddStructuredOutput["facts"]["missingInformation"];
  };
  recommendation: MddStructuredOutput["executive"]["recommendation"];
  professionalBoundaries: MddStructuredOutput["professionalBoundaries"];
  trigger: SemanticRefillTriggerMetadata;
};

export function buildSemanticRefillPayload(input: {
  envelope: CaseEnvelope;
  controlled: MddStructuredOutput;
  defectClass: Exclude<PresidentProseDefectClass, null>;
}): SemanticRefillAllowlistedPayload {
  const cdq = input.envelope.currentDecisionQuestion;
  if (!cdq) {
    throw new Error("Semantic Refill requires Current Decision Question");
  }
  const pd = input.controlled.executive.presidentDecision;
  return {
    currentDecisionQuestion: {
      decisionRequiredNow: cdq.decisionRequiredNow,
      expectedDecider: cdq.expectedDecider,
      deferredToExecutionOrClosure: [
        ...(cdq.deferredToExecutionOrClosure ?? []),
      ],
      decisionClass: cdq.decisionClass,
    },
    primaryCaseType: input.controlled.primaryCaseType,
    decisionAuthorities: input.controlled.executive.decisionAuthorities.map(
      (a) => ({ ...a }),
    ),
    facts: {
      confirmed: input.controlled.facts.confirmed.map((f) => ({ ...f })),
      unverified: input.controlled.facts.unverified.map((f) => ({ ...f })),
      assumptions: input.controlled.facts.assumptions.map((f) => ({ ...f })),
      missingInformation: input.controlled.facts.missingInformation.map(
        (m) => ({ ...m }),
      ),
    },
    recommendation: { ...input.controlled.executive.recommendation },
    professionalBoundaries: input.controlled.professionalBoundaries.map(
      (b) => ({ ...b }),
    ),
    trigger: {
      defectClass: input.defectClass,
      needsSemanticFill: true,
      originalPresidentDecisionText: pd.text,
      requiredNow: true,
    },
  };
}
