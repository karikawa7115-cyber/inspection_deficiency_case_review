/**
 * Decision Pipeline v0.1.2 — Canonical Output Assembly.
 * Final qualityGate + decisionReadiness are Gate-owned.
 * LLM draft qualityGate must not remain authoritative (retained in originalLlmDraft only).
 */
import type { QualityGateEvaluation } from "../quality-gate/evaluate-v1";
import type { MddStructuredOutput } from "../schema/structured-output-v1";

/**
 * Write system-owned finals onto a controlled (or structural) draft.
 * Does not mutate the input draft.
 */
export function assembleCanonicalOutputV012(
  draft: MddStructuredOutput,
  gate: QualityGateEvaluation,
): MddStructuredOutput {
  return {
    ...draft,
    executive: {
      ...draft.executive,
      decisionReadiness: gate.enforcedReadiness,
    },
    qualityGate: {
      passed: gate.passed,
      criticalFailures: gate.criticalFailures,
      warnings: gate.warnings,
      evaluatedAt: gate.evaluatedAt,
    },
  };
}
