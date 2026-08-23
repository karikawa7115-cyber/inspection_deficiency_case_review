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
 * Default: deterministic heuristic proposer (stable for Golden Lab / static export clients).
 * Optional LLM when MDD_AI_API_KEY or OPENAI_API_KEY is set and mode=llm.
 * LLM path returns Schema v1.0 structured JSON; callers should run Quality Gate + Golden eval separately.
 *
 * Note: with `output: "export"`, this route is not available in static production builds.
 * Use `scripts/mdd-phase1-llm-golden-run.ts` for Phase 1 live Golden validation.
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

  if (data.mode === "llm") {
    const { resolveLlmConfigFromEnv, callLlmForStructuredOutput } =
      await import("@/lib/mdd/llm/propose-structured-v1");
    const { runGoldenLlmEvalPipeline } = await import(
      "@/lib/mdd/golden/llm-eval-v1"
    );
    const config = resolveLlmConfigFromEnv();
    if (!config) {
      return NextResponse.json(
        { error: "LLM not configured (MDD_AI_API_KEY / OPENAI_API_KEY)" },
        { status: 503 },
      );
    }
    try {
      const llm = await callLlmForStructuredOutput(
        {
          title: data.title,
          vessel: data.vessel,
          pastedText: data.pastedText,
          financeSourceInput: data.financeSnapshot,
        },
        config,
      );
      const goldenId = data.goldenCaseId;
      if (goldenId) {
        const { GOLDEN_CASE_SPECS } = await import("@/lib/mdd/golden/specs");
        const spec = GOLDEN_CASE_SPECS.find((s) => s.id === goldenId);
        if (spec) {
          const report = runGoldenLlmEvalPipeline(spec, llm.rawJson);
          return NextResponse.json({
            engine: "llm",
            model: llm.model,
            provider: llm.provider,
            rawStructuredOutput: llm.rawJson,
            schemaValid: report.schemaValid,
            qualityGate: report.qualityGate,
            goldenEvaluation: {
              overall: report.overall,
              criticalFailCodes: report.criticalFailCodes,
              dimensions: report.dimensions,
            },
          });
        }
      }
      const { parseMddStructuredOutput } = await import(
        "@/lib/mdd/schema/structured-output-v1"
      );
      const { evaluateQualityGateV1, subjectFromStructuredOutput } =
        await import("@/lib/mdd/quality-gate/evaluate-v1");
      const parsedOut = parseMddStructuredOutput(llm.rawJson);
      if (!parsedOut.success) {
        return NextResponse.json({
          engine: "llm",
          model: llm.model,
          provider: llm.provider,
          rawStructuredOutput: llm.rawJson,
          schemaValid: false,
          schemaError: parsedOut.error.flatten(),
        });
      }
      const gate = evaluateQualityGateV1(
        subjectFromStructuredOutput(parsedOut.data),
      );
      return NextResponse.json({
        engine: "llm",
        model: llm.model,
        provider: llm.provider,
        rawStructuredOutput: {
          ...parsedOut.data,
          executive: {
            ...parsedOut.data.executive,
            decisionReadiness: gate.enforcedReadiness,
          },
          qualityGate: {
            passed: gate.passed,
            criticalFailures: gate.criticalFailures,
            warnings: gate.warnings,
            evaluatedAt: gate.evaluatedAt,
          },
        },
        schemaValid: true,
        qualityGate: {
          passed: gate.passed,
          enforcedReadiness: gate.enforcedReadiness,
          criticalFailures: gate.criticalFailures,
          warnings: gate.warnings,
        },
      });
    } catch (e) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : "LLM call failed",
        },
        { status: 502 },
      );
    }
  }

  let proposal = proposeFromHeuristics(data);

  if (!CASE_TYPES.includes(proposal.primaryCaseType)) {
    return NextResponse.json({ error: "Invalid case type from engine" }, { status: 500 });
  }

  const brief = applyGateToBrief(proposal, {
    reviewCandidateFlag:
      data.goldenCaseId === "GC03" ? true : undefined,
    financeSnapshot: data.financeSnapshot,
  });
  return NextResponse.json({
    primaryCaseType: proposal.primaryCaseType,
    tags: proposal.tags,
    brief,
    engine: "heuristic",
  });
}
