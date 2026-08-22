import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { CASE_TYPES } from "@/lib/mdd/types";

const bodySchema = z.object({
  title: z.string(),
  vessel: z.string().optional(),
  pastedText: z.string(),
  goldenCaseId: z.enum(["GC01", "GC02", "GC03", "GC04"]).optional(),
  financeSnapshot: z
    .object({
      reportedShipFund: z.number().optional(),
      pendingExpenses: z.number().optional(),
      adjustedBalance: z.number().optional(),
      targetClosing: z.number().optional(),
      standardCtm: z.number().optional(),
      recoveryCtm: z.number().optional(),
      vesselRequiredApprox: z.number().optional(),
      recommendedCtm: z.number().optional(),
      companyLiquidityNote: z.string().optional(),
      companyLiquidityConfirmed: z.boolean().optional(),
      asOfDate: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  mode: z.enum(["heuristic", "llm"]).optional(),
});

/**
 * Phase 1 analyze endpoint.
 * Default: deterministic heuristic proposer (stable for Golden Lab).
 * Optional LLM when MDD_AI_API_KEY + MDD_AI_BASE_URL are set and mode=llm.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  let proposal = proposeFromHeuristics(data);

  if (data.mode === "llm") {
    const llm = await tryLlmPropose(data);
    if (llm) proposal = llm;
  }

  if (!CASE_TYPES.includes(proposal.primaryCaseType)) {
    return NextResponse.json({ error: "Invalid case type from engine" }, { status: 500 });
  }

  const brief = applyGateToBrief(proposal);
  return NextResponse.json({
    primaryCaseType: proposal.primaryCaseType,
    tags: proposal.tags,
    brief,
    engine: data.mode === "llm" ? "llm-or-fallback" : "heuristic",
  });
}

async function tryLlmPropose(
  data: z.infer<typeof bodySchema>,
): Promise<ReturnType<typeof proposeFromHeuristics> | null> {
  const apiKey = process.env.MDD_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseUrl =
    process.env.MDD_AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.MDD_AI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) return null;

  // For Phase 1 reliability, LLM path still seeds from heuristics then asks for refinement JSON.
  // If the call fails, caller keeps heuristic result.
  const seed = proposeFromHeuristics(data);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are MDD Decision Preparation Engine. Propose structured analysis only. AI proposes, human confirms. Never invent safety emergencies. Separate Confirmed/Unverified/Assumption/Missing. Necessary≠Affordable. Do not substitute for Class/Flag/Master/Tech Supt. Return JSON with keys primaryCaseType, tags, recommendation, decisionReadiness, presidentDecision, why.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title: data.title,
              vessel: data.vessel,
              pastedText: data.pastedText,
              seedType: seed.primaryCaseType,
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    const refined = JSON.parse(content) as {
      primaryCaseType?: string;
      tags?: string[];
      recommendation?: string;
      decisionReadiness?: string;
      presidentDecision?: string;
      why?: string;
    };
    return {
      ...seed,
      primaryCaseType:
        (refined.primaryCaseType as typeof seed.primaryCaseType) ??
        seed.primaryCaseType,
      tags: refined.tags ?? seed.tags,
      brief: {
        ...seed.brief,
        recommendation: refined.recommendation ?? seed.brief.recommendation,
        decisionReadiness:
          (refined.decisionReadiness as typeof seed.brief.decisionReadiness) ??
          seed.brief.decisionReadiness,
        presidentDecision:
          refined.presidentDecision ?? seed.brief.presidentDecision,
        why: refined.why ?? seed.brief.why,
      },
    };
  } catch {
    return null;
  }
}
