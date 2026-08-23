/**
 * Phase 1 production LLM connection — Structured Output Schema v1.0.
 * System prompt: MDD_SYSTEM_PROMPT_V1 (frozen). Does not alter Golden Spec.
 */
import { MDD_SYSTEM_PROMPT_V1 } from "../prompts/system-prompt-v1";

export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmCaseInput = {
  title: string;
  vessel?: string;
  pastedText: string;
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
  rawContent: string;
  rawJson: unknown;
  latencyMs: number;
};

const SCHEMA_OUTPUT_CONTRACT = `OUTPUT CONTRACT — MDD Structured Output Schema v1.0 (mandatory)
Return ONE JSON object only (no markdown fences, no commentary).
Top-level keys:
- schemaVersion: must be exactly "1.0"
- primaryCaseType: one of OPERATIONAL | TECHNICAL | CREW_MANNING | FINANCE_COMMERCIAL | INSPECTION_COMPLIANCE | ISM_MANAGEMENT
- tags: string array (may be empty of optional tags; include material tags)
- executive: {
    recommendation: { text },
    presidentDecision: { text, requiredNow: boolean },
    decisionReadiness: READY | CONDITIONAL | NOT_READY,
    decisionAuthorities: [{ id, roleLabel, authority, status }] where authority is one of
      President/DP | Superintendent | Master | Owner | Manning Agent | Class | Flag Administration | Finance/Accounting | External Authority | Other
      and status is pending | confirmed | not_required; at least one authority
    why: { text },
    nextActions: [{ id, who, what, dueOrTrigger?, status: open|done }]
  }
- facts: {
    confirmed: [{ id, text }],
    unverified: [{ id, text }],
    assumptions: [{ id, text, hypothesis? }],
    missingInformation: [{ id, text, who, what, evidenceRequired, blocksReadiness? }]
  }
- risks: string[] (may be [])
- options: [{ id, title, summary }] (may be []; do not invent artificial options)
- professionalBoundaries: [{ id, domain, issue, responsibleAuthority, ... }] (may be [])
- qualityGate: { passed: boolean, criticalFailures: [], warnings: [], evaluatedAt: ISO-8601 }
  (You may leave criticalFailures/warnings empty; the server re-evaluates Quality Gate.)
- reviewCandidate: { flag: boolean, retainAfterClose: boolean, reason?, monitorOnly? }
- learning: {
    correctiveAction, preventiveAction, effectivenessVerification, horizontalCheck: boolean,
    fleetWideRelevance: yes|possible|no,
    internalAuditCandidate, managementReviewCandidate, knowledgeUpdateCandidate: boolean,
    notes?
  }
- finance?: optional; only when finance judgment is material. Use sourceFacts vs derivedValues.
  Money amounts with origin "source"|"derived". separationPreserved and doNotAuthorizePayment must be true when finance present.
- inspectionIsm?: optional; when inspection/ISM depth applies.
- debug?: optional non-canonical.

Rules:
- Analyze ONLY from the provided case input facts.
- Do NOT look up or invent Golden Case expected answers.
- Do NOT redefine System Prompt priorities.
- Empty risks/options/professionalBoundaries are allowed — do not invent filler.
- If managementReviewCandidate is true, reviewCandidate.flag should normally be true (monitorOnly may keep flag false).
- READY is invalid if critical material issues remain.`;

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
      "Produce MddStructuredOutput JSON for this case from the facts alone.",
    caseInput: {
      title: input.title,
      vessel: input.vessel ?? null,
      pastedText: input.pastedText,
      financeSourceInput: input.financeSourceInput ?? null,
    },
  };

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: MDD_SYSTEM_PROMPT_V1,
        },
        {
          role: "user",
          content: `${SCHEMA_OUTPUT_CONTRACT}\n\nCASE INPUT JSON:\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `LLM HTTP ${res.status}: ${errText.slice(0, 500) || res.statusText}`,
    );
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("LLM returned empty content");
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawContent);
  } catch {
    throw new Error("LLM content was not valid JSON");
  }

  const provider = config.baseUrl.includes("openai.com")
    ? "openai-compatible"
    : "custom-openai-compatible";

  return {
    provider,
    model: config.model,
    baseUrl: config.baseUrl,
    rawContent,
    rawJson,
    latencyMs: Date.now() - started,
  };
}
