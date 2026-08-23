/**
 * Phase 1 production LLM connection — Structured Output Schema v1.0.
 * System prompt: MDD_SYSTEM_PROMPT_V1 (frozen). Does not alter Golden Spec.
 * Provider-enforced Structured Outputs (strict JSON Schema); Zod remains final validation.
 */
import type { CurrentDecisionQuestion } from "../case-envelope/current-decision-question";
import { injectQualityGateEvaluatedAt } from "../quality-gate/evaluated-at";
import { MDD_SYSTEM_PROMPT_V1 } from "../prompts/system-prompt-v1";
import { normalizeMddStructuredOutputV1 } from "./normalize-structured-v1";
import {
  getMddOpenAiStrictJsonSchema,
  MDD_OPENAI_STRUCTURED_OUTPUT_NAME,
} from "./openai-strict-json-schema-v1";

export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmCaseInput = {
  title: string;
  vessel?: string;
  pastedText: string;
  /** First-class Case Envelope CDQ — passed to the model; not inferred from narrative. */
  currentDecisionQuestion?: CurrentDecisionQuestion | null;
  /** Source/input finance figures only — not expected decisions. */
  financeSourceInput?: {
    reportedShipFund?: number;
    pendingExpenses?: number;
    adjustedBalance?: number;
    targetClosing?: number;
    standardCtm?: number;
    recoveryCtm?: number;
    vesselRequiredApprox?: number;
    recommendedCtm?: number;
    companyLiquidityConfirmed?: boolean;
    companyLiquidityNote?: string;
    asOfDate?: string;
    notes?: string;
  };
};

export type LlmStructuredCallResult = {
  provider: string;
  model: string;
  baseUrl: string;
  /** Exact JSON parsed from the provider response (before local normalization). */
  providerRawJson: unknown;
  /** Representation-normalized JSON for Zod / Gate / Golden pipeline. */
  rawJson: unknown;
  rawContent: string;
  normalizationRepairs: string[];
  responseFormat: "json_schema_strict";
  latencyMs: number;
  refusal?: string;
};

const CASE_USER_INSTRUCTION = `Produce one MDD Structured Output object for this case from the facts alone.

Rules:
- Analyze ONLY from the provided case input facts.
- Do NOT look up or invent Golden Case expected answers.
- Do NOT redefine System Prompt priorities.
- Empty risks/options/professionalBoundaries are allowed — do not invent filler.
- If managementReviewCandidate is true, reviewCandidate.flag should normally be true (monitorOnly may keep flag false).
- READY is invalid if critical material issues remain.
- When finance judgment is material, include the finance extension with separationPreserved=true and doNotAuthorizePayment=true.
- qualityGate.criticalFailures and warnings must be arrays of { code, message } objects (may be empty; server re-evaluates Quality Gate).
- qualityGate.evaluatedAt may be any placeholder string; the application overwrites it as system metadata (do not invent meaningful runtime timestamps).
- Use Decision Authority enum values exactly (e.g. President/DP, not President).
- Optional fields: use null when absent (provider schema); do not invent missing authorities or finance.`;

export function resolveLlmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig | null {
  const apiKey = env.MDD_AI_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    baseUrl: (env.MDD_AI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: env.MDD_AI_MODEL ?? "gpt-4o-mini",
  };
}

export async function callLlmForStructuredOutput(
  input: LlmCaseInput,
  config: LlmProviderConfig,
): Promise<LlmStructuredCallResult> {
  const started = Date.now();
  const userPayload = {
    instruction:
      "Produce MddStructuredOutput JSON for this case from the facts alone. Use Current Decision Question as the principal decision framing — do not invent a different current decision from narrative alone.",
    caseInput: {
      title: input.title,
      vessel: input.vessel ?? null,
      pastedText: input.pastedText,
      financeSourceInput: input.financeSourceInput ?? null,
      currentDecisionQuestion: input.currentDecisionQuestion ?? null,
    },
  };

  const schema = getMddOpenAiStrictJsonSchema();

  // gpt-5* / some reasoning models reject non-default temperature; omit so API uses default.
  const supportsCustomTemperature = !/^gpt-5/i.test(config.model);

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      ...(supportsCustomTemperature ? { temperature: 0.1 } : {}),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: MDD_OPENAI_STRUCTURED_OUTPUT_NAME,
          strict: true,
          schema,
        },
      },
      messages: [
        {
          role: "system",
          content: MDD_SYSTEM_PROMPT_V1,
        },
        {
          role: "user",
          content: `${CASE_USER_INSTRUCTION}\n\nCASE INPUT JSON:\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `LLM HTTP ${res.status}: ${errText.slice(0, 800) || res.statusText}`,
    );
  }

  const payload = (await res.json()) as {
    choices?: {
      message?: { content?: string | null; refusal?: string | null };
    }[];
  };
  const message = payload.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`LLM refusal: ${message.refusal}`);
  }
  const rawContent = message?.content;
  if (!rawContent) {
    throw new Error("LLM returned empty content");
  }

  let providerRawJson: unknown;
  try {
    providerRawJson = JSON.parse(rawContent);
  } catch {
    throw new Error("LLM content was not valid JSON");
  }

  const { normalized, repairs } =
    normalizeMddStructuredOutputV1(providerRawJson);
  // Quality Gate Rules v1.1 §10: evaluatedAt is system metadata, not model judgment.
  const withEvaluatedAt = injectQualityGateEvaluatedAt(normalized);

  const provider = config.baseUrl.includes("openai.com")
    ? "openai-compatible"
    : "custom-openai-compatible";

  return {
    provider,
    model: config.model,
    baseUrl: config.baseUrl,
    providerRawJson,
    rawJson: withEvaluatedAt,
    rawContent,
    normalizationRepairs: repairs,
    responseFormat: "json_schema_strict",
    latencyMs: Date.now() - started,
    refusal: message?.refusal ?? undefined,
  };
}
