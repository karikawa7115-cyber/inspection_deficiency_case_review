/**
 * Feature flag for Bounded President Decision Semantic Refill v0.3.
 * Enable with MDD_SEMANTIC_REFILL_V03=1|true|yes|on
 * Independent of MDD_DECISION_CONTROL_V01.
 */
export function isSemanticRefillV03Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = (env.MDD_SEMANTIC_REFILL_V03 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Configurable refill model. Defaults to gpt-4o-mini (first controlled live test).
 */
export function resolveSemanticRefillModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const m = (env.MDD_SEMANTIC_REFILL_MODEL ?? "").trim();
  return m || env.MDD_AI_MODEL?.trim() || "gpt-4o-mini";
}
