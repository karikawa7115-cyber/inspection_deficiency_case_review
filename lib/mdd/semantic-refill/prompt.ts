/**
 * Bounded Semantic Refill v0.3 prompt — separate from System Prompt v1.0.
 * Produces President Decision text only.
 */
import type { SemanticRefillAllowlistedPayload } from "./build-payload";
import { SEMANTIC_REFILL_PROMPT_VERSION } from "./version";

export const SEMANTIC_REFILL_SYSTEM = `You are MDD Bounded President Decision Refill v0.3.
Your ONLY job is to write the President Decision text for a case where Control already set requiredNow=true but the draft President Decision prose is unusable.

Output STRICT JSON: { "text": "<president decision sentence(s)>" }
Do not output any other keys.

Rules:
- State the management decision required NOW from Current Decision Question (paraphrase allowed).
- Keep requiredNow semantics: President Decision IS required now.
- Respect Decision Authorities: do not make President the Class/technical/Flag interpreter when those authorities exist.
- Align with Recommendation direction without restating the full recommendation memo.
- Stay brief (executive 30-second usable).
- Do NOT say or imply President Decision is not required / not needed / deferred.
- Do NOT convert deferred execution/closure items into the current decision.
- Do NOT invent Class/technical/Flag conclusions or acceptance.
- Do NOT invent financial affordability, remittance approvals, or unsupported amounts.
- Do NOT violate Professional Boundaries.
- Do NOT invent facts.`;

export function buildSemanticRefillUserMessage(
  payload: SemanticRefillAllowlistedPayload,
): string {
  return `Write only the President Decision text.

REFILL_INPUT_JSON (${SEMANTIC_REFILL_PROMPT_VERSION}):
${JSON.stringify(payload, null, 2)}

Respond with JSON: {"text":"..."}`;
}

export { SEMANTIC_REFILL_PROMPT_VERSION };
