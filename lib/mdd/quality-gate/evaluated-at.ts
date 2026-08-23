/**
 * qualityGate.evaluatedAt is system-owned execution metadata (Quality Gate Rules v1.1 §10).
 * Not semantic LLM content — do not invent via model judgment.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Ensure `qualityGate.evaluatedAt` is a non-empty ISO timestamp before Schema parse.
 * Does not alter recommendation, readiness, authorities, facts, learning, or review flags.
 */
export function injectQualityGateEvaluatedAt(
  input: unknown,
  at: string = new Date().toISOString(),
): unknown {
  if (!isPlainObject(input)) return input;
  const qualityGate = input.qualityGate;
  if (!isPlainObject(qualityGate)) {
    return {
      ...input,
      qualityGate: {
        passed: true,
        criticalFailures: [],
        warnings: [],
        evaluatedAt: at,
      },
    };
  }
  return {
    ...input,
    qualityGate: {
      ...qualityGate,
      evaluatedAt: at,
    },
  };
}
