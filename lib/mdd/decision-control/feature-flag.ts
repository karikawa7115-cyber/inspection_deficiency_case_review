/**
 * Feature flag for Decision Control Layer v0.1.
 * Enable with MDD_DECISION_CONTROL_V01=1|true|yes
 */
export function isDecisionControlV01Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = (env.MDD_DECISION_CONTROL_V01 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
