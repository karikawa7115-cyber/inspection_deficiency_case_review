/**
 * Semantic Refill v0.3 — apply stage (fail-closed).
 */
import type { CaseEnvelope } from "../case-envelope/current-decision-question";
import type { ControlFinding } from "../decision-control/apply-v0.1";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import { buildSemanticRefillPayload } from "./build-payload";
import {
  classifyPresidentProseDefect,
  type PresidentProseDefectClass,
} from "./prose-defect";
import {
  validatePresidentDecisionRefill,
  type RefillValidationCode,
} from "./validate";
import {
  SEMANTIC_REFILL_PROMPT_VERSION,
  SEMANTIC_REFILL_VERSION,
} from "./version";

export type SemanticRefillAudit = {
  refillVersion: typeof SEMANTIC_REFILL_VERSION;
  promptVersion: typeof SEMANTIC_REFILL_PROMPT_VERSION;
  model: string;
  timestamp: string;
  triggerReason: Exclude<PresidentProseDefectClass, null> | "not_triggered";
  originalLlmPresidentDecision: { text: string; requiredNow: boolean };
  refillOutput: { text: string } | null;
  finalPresidentDecision: { text: string; requiredNow: boolean };
  validationResult: "accepted" | "rejected" | "skipped";
  validationCodes: RefillValidationCode[];
  applied: boolean;
};

export type SemanticRefillResult = {
  triggered: boolean;
  applied: boolean;
  needsSemanticFill: boolean;
  controlled: MddStructuredOutput;
  findings: ControlFinding[];
  audit: SemanticRefillAudit;
};

function stripNsf(findings: ControlFinding[]): ControlFinding[] {
  return findings.filter((f) => f.code !== "NEEDS_SEMANTIC_FILL");
}

export function shouldTriggerSemanticRefillV03(input: {
  needsSemanticFill: boolean;
  controlled: MddStructuredOutput;
  envelope: CaseEnvelope;
}): {
  trigger: boolean;
  defectClass: PresidentProseDefectClass;
} {
  if (!input.needsSemanticFill) {
    return { trigger: false, defectClass: null };
  }
  if (!input.envelope.currentDecisionQuestion) {
    return { trigger: false, defectClass: null };
  }
  const pd = input.controlled.executive.presidentDecision;
  if (!pd.requiredNow) {
    return { trigger: false, defectClass: null };
  }
  const defectClass = classifyPresidentProseDefect(pd.text, true);
  if (!defectClass) {
    return { trigger: false, defectClass: null };
  }
  return { trigger: true, defectClass };
}

/**
 * Apply Semantic Refill with an already-proposed text (LLM or test inject).
 * Does not call the network.
 */
export function applySemanticRefillV03(input: {
  envelope: CaseEnvelope;
  controlled: MddStructuredOutput;
  findings: ControlFinding[];
  needsSemanticFill: boolean;
  proposedText: string;
  model: string;
  nowIso?: string;
}): SemanticRefillResult {
  const at = input.nowIso ?? new Date().toISOString();
  const originalPd = {
    text: input.controlled.executive.presidentDecision.text,
    requiredNow: input.controlled.executive.presidentDecision.requiredNow,
  };

  const { trigger, defectClass } = shouldTriggerSemanticRefillV03(input);
  if (!trigger || !defectClass) {
    return {
      triggered: false,
      applied: false,
      needsSemanticFill: input.needsSemanticFill,
      controlled: input.controlled,
      findings: input.findings,
      audit: {
        refillVersion: SEMANTIC_REFILL_VERSION,
        promptVersion: SEMANTIC_REFILL_PROMPT_VERSION,
        model: input.model,
        timestamp: at,
        triggerReason: "not_triggered",
        originalLlmPresidentDecision: originalPd,
        refillOutput: null,
        finalPresidentDecision: originalPd,
        validationResult: "skipped",
        validationCodes: [],
        applied: false,
      },
    };
  }

  const cdq = input.envelope.currentDecisionQuestion!;
  buildSemanticRefillPayload({
    envelope: input.envelope,
    controlled: input.controlled,
    defectClass,
  });

  const candidate = structuredClone(input.controlled);
  candidate.executive.presidentDecision = {
    ...candidate.executive.presidentDecision,
    text: input.proposedText,
    requiredNow: true,
  };

  const validation = validatePresidentDecisionRefill({
    proposedText: input.proposedText,
    cdq,
    controlled: input.controlled,
    candidateDraft: candidate,
  });

  if (!validation.accepted) {
    const findings: ControlFinding[] = [
      ...input.findings.filter(
        (f) =>
          f.code !== "SEMANTIC_REFILL_REJECTED" &&
          f.code !== "SEMANTIC_REFILL_APPLIED",
      ),
    ];
    if (!findings.some((f) => f.code === "NEEDS_SEMANTIC_FILL")) {
      findings.push({
        code: "NEEDS_SEMANTIC_FILL",
        message:
          "President Decision semantic refill rejected; original text retained.",
        relatedFieldPaths: ["executive.presidentDecision.text"],
      });
    }
    findings.push({
      code: "SEMANTIC_REFILL_REJECTED",
      message: `Semantic Refill v0.3 rejected: ${validation.codes.join(", ")}`,
      relatedFieldPaths: ["executive.presidentDecision.text"],
    });

    return {
      triggered: true,
      applied: false,
      needsSemanticFill: true,
      controlled: input.controlled,
      findings,
      audit: {
        refillVersion: SEMANTIC_REFILL_VERSION,
        promptVersion: SEMANTIC_REFILL_PROMPT_VERSION,
        model: input.model,
        timestamp: at,
        triggerReason: defectClass,
        originalLlmPresidentDecision: originalPd,
        refillOutput: { text: input.proposedText },
        finalPresidentDecision: originalPd,
        validationResult: "rejected",
        validationCodes: validation.codes,
        applied: false,
      },
    };
  }

  const findings: ControlFinding[] = [
    ...stripNsf(input.findings).filter(
      (f) =>
        f.code !== "SEMANTIC_REFILL_REJECTED" &&
        f.code !== "SEMANTIC_REFILL_APPLIED",
    ),
    {
      code: "SEMANTIC_REFILL_APPLIED",
      message:
        "Bounded President Decision Semantic Refill v0.3 accepted; NSF cleared.",
      relatedFieldPaths: ["executive.presidentDecision.text"],
    },
  ];

  return {
    triggered: true,
    applied: true,
    needsSemanticFill: false,
    controlled: candidate,
    findings,
    audit: {
      refillVersion: SEMANTIC_REFILL_VERSION,
      promptVersion: SEMANTIC_REFILL_PROMPT_VERSION,
      model: input.model,
      timestamp: at,
      triggerReason: defectClass,
      originalLlmPresidentDecision: originalPd,
      refillOutput: { text: input.proposedText },
      finalPresidentDecision: {
        text: candidate.executive.presidentDecision.text,
        requiredNow: true,
      },
      validationResult: "accepted",
      validationCodes: [],
      applied: true,
    },
  };
}
