/**
 * LLM call for Bounded President Decision Refill v0.3.
 * Separate prompt from System Prompt v1.0. Model configurable.
 */
import type { LlmProviderConfig } from "../llm/propose-structured-v1";
import type { SemanticRefillAllowlistedPayload } from "./build-payload";
import {
  buildSemanticRefillUserMessage,
  SEMANTIC_REFILL_SYSTEM,
} from "./prompt";
import { SEMANTIC_REFILL_PROMPT_VERSION } from "./version";

export type SemanticRefillLlmResult = {
  text: string;
  model: string;
  promptVersion: typeof SEMANTIC_REFILL_PROMPT_VERSION;
  rawContent: string;
  latencyMs: number;
};

export async function callLlmForPresidentDecisionRefill(
  payload: SemanticRefillAllowlistedPayload,
  config: LlmProviderConfig,
): Promise<SemanticRefillLlmResult> {
  const started = Date.now();
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
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SEMANTIC_REFILL_SYSTEM },
        {
          role: "user",
          content: buildSemanticRefillUserMessage(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Semantic Refill LLM HTTP ${res.status}: ${errText.slice(0, 800) || res.statusText}`,
    );
  }

  const body = (await res.json()) as {
    choices?: {
      message?: { content?: string | null; refusal?: string | null };
    }[];
  };
  const message = body.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`Semantic Refill LLM refusal: ${message.refusal}`);
  }
  const rawContent = message?.content;
  if (!rawContent) {
    throw new Error("Semantic Refill LLM returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Semantic Refill LLM content was not valid JSON");
  }

  const text =
    typeof parsed === "object" &&
    parsed !== null &&
    "text" in parsed &&
    typeof (parsed as { text: unknown }).text === "string"
      ? (parsed as { text: string }).text
      : null;

  if (text == null) {
    throw new Error("Semantic Refill LLM JSON missing string field `text`");
  }

  return {
    text,
    model: config.model,
    promptVersion: SEMANTIC_REFILL_PROMPT_VERSION,
    rawContent,
    latencyMs: Date.now() - started,
  };
}
