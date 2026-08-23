/**
 * Orchestrate Semantic Refill v0.3 after Decision Control.
 */
import type { CaseEnvelope } from "../case-envelope/current-decision-question";
import type { ControlFinding } from "../decision-control/apply-v0.1";
import type { LlmProviderConfig } from "../llm/propose-structured-v1";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import {
  applySemanticRefillV03,
  shouldTriggerSemanticRefillV03,
  type SemanticRefillResult,
} from "./apply";
import { buildSemanticRefillPayload } from "./build-payload";
import { callLlmForPresidentDecisionRefill } from "./call-llm";
import {
  isSemanticRefillV03Enabled,
  resolveSemanticRefillModel,
} from "./feature-flag";

export type RunSemanticRefillStageOptions = {
  envelope: CaseEnvelope;
  controlled: MddStructuredOutput;
  findings: ControlFinding[];
  needsSemanticFill: boolean;
  /** Injected text (tests / pre-fetched). Skips network when set. */
  proposedText?: string;
  model?: string;
  nowIso?: string;
  /** When true/false, overrides env feature flag. */
  enabled?: boolean;
  /** LLM config for live propose when proposedText omitted and enabled. */
  llmConfig?: LlmProviderConfig | null;
  env?: NodeJS.ProcessEnv;
};

/**
 * Run refill stage when flag on and trigger holds.
 * Sync when proposedText provided; async LLM otherwise.
 */
export async function runSemanticRefillStage(
  options: RunSemanticRefillStageOptions,
): Promise<SemanticRefillResult | null> {
  const env = options.env ?? process.env;
  const enabled = options.enabled ?? isSemanticRefillV03Enabled(env);
  if (!enabled) return null;

  const { trigger, defectClass } = shouldTriggerSemanticRefillV03({
    needsSemanticFill: options.needsSemanticFill,
    controlled: options.controlled,
    envelope: options.envelope,
  });
  if (!trigger || !defectClass) return null;

  const model =
    options.model ??
    (options.llmConfig
      ? options.llmConfig.model
      : resolveSemanticRefillModel(env));

  let proposedText = options.proposedText;
  let latencyMs: number | undefined;
  if (proposedText == null) {
    if (!options.llmConfig) {
      return null;
    }
    const payload = buildSemanticRefillPayload({
      envelope: options.envelope,
      controlled: options.controlled,
      defectClass,
    });
    const llm = await callLlmForPresidentDecisionRefill(
      payload,
      options.llmConfig,
    );
    proposedText = llm.text;
    latencyMs = llm.latencyMs;
  }

  return applySemanticRefillV03({
    envelope: options.envelope,
    controlled: options.controlled,
    findings: options.findings,
    needsSemanticFill: options.needsSemanticFill,
    proposedText,
    model,
    nowIso: options.nowIso,
    latencyMs,
  });
}
