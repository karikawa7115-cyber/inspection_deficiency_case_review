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
  currentDecisionQuestion: z
    .object({
      decisionRequiredNow: z.string(),
      expectedDecider: z.string(),
      deferredToExecutionOrClosure: z.array(z.string()),
      decisionClass: z
        .enum([
          "crew_change_postponement",
          "technical_class_handling_confirm",
          "inspection_non_closure",
          "finance_funding_amount",
          "generic",
        ])
        .optional(),
    })
    .optional()
    .nullable(),
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
      const { getGoldenCaseCdq } = await import("@/lib/mdd/golden/cdq-envelopes");
      const {
        applyDecisionControlV01,
        isDecisionControlV01Enabled,
      } = await import("@/lib/mdd/decision-control");

      const cdq =
        data.currentDecisionQuestion ??
        (data.goldenCaseId ? getGoldenCaseCdq(data.goldenCaseId) : null);

      const llm = await callLlmForStructuredOutput(
        {
          title: data.title,
          vessel: data.vessel,
          pastedText: data.pastedText,
          financeSourceInput: data.financeSnapshot,
          currentDecisionQuestion: cdq,
        },
        config,
      );
      const goldenId = data.goldenCaseId;
      if (goldenId) {
        const { GOLDEN_CASE_SPECS } = await import("@/lib/mdd/golden/specs");
        const spec = GOLDEN_CASE_SPECS.find((s) => s.id === goldenId);
        if (spec) {
          const { resolveSemanticRefillModel } = await import(
            "@/lib/mdd/semantic-refill"
          );
          const refillModel = resolveSemanticRefillModel();
          const report = await runGoldenLlmEvalPipeline(spec, llm.rawJson, {
            applyDecisionControl: isDecisionControlV01Enabled(),
            envelope: {
              title: data.title,
              vessel: data.vessel,
              pastedText: data.pastedText,
              currentDecisionQuestion: cdq,
            },
            financeSourceInput: data.financeSnapshot ?? spec.financeSnapshot ?? null,
            semanticRefillLlmConfig: { ...config, model: refillModel },
            semanticRefillModel: refillModel,
          });
          return NextResponse.json({
            engine: "llm",
            model: llm.model,
            provider: llm.provider,
            rawStructuredOutput: llm.rawJson,
            decisionControl: report.decisionControl
              ? {
                  applied: report.decisionControl.applied,
                  controlVersion: report.decisionControl.controlVersion,
                  needsSemanticFill: report.decisionControl.needsSemanticFill,
                  findings: report.decisionControl.findings,
                  auditCount: report.decisionControl.auditCount,
                  controlledStructuredOutput: report.decisionControl.controlled,
                }
              : undefined,
            semanticRefill: report.semanticRefill,
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
      const { parseMddStructuredOutput, parseMddStructuredOutputStructural } =
        await import("@/lib/mdd/schema/structured-output-v1");
      const { evaluateQualityGateV1_1, subjectFromStructuredOutput } =
        await import("@/lib/mdd/quality-gate/evaluate-v1.1");
      const { resolveFinanceGateActivation } = await import(
        "@/lib/mdd/quality-gate/finance-activation-v1.1"
      );
      const { assembleCanonicalOutputV012 } = await import(
        "@/lib/mdd/pipeline/assemble-canonical-v0.1.2"
      );

      const structural = parseMddStructuredOutputStructural(llm.rawJson);
      if (!structural.success) {
        return NextResponse.json({
          engine: "llm",
          model: llm.model,
          provider: llm.provider,
          rawStructuredOutput: llm.rawJson,
          schemaValid: false,
          structuralValid: false,
          schemaError: structural.error.flatten(),
          notes: "Failed Pre-Control structural validation",
        });
      }

      const originalLlmDraft = structuredClone(structural.data);
      let draft = structural.data;
      let controlMeta: Record<string, unknown> | undefined;
      let semanticRefillMeta: unknown;
      if (isDecisionControlV01Enabled()) {
        const ctrl = applyDecisionControlV01({
          envelope: {
            title: data.title,
            vessel: data.vessel,
            pastedText: data.pastedText,
            currentDecisionQuestion: cdq,
          },
          llmDraft: draft,
          financeSourceInput: data.financeSnapshot ?? null,
        });
        draft = ctrl.controlled;
        controlMeta = {
          applied: ctrl.applied,
          controlVersion: ctrl.controlVersion,
          needsSemanticFill: ctrl.needsSemanticFill,
          findings: ctrl.findings,
          audit: ctrl.audit,
          originalLlmDraft: ctrl.originalLlmDraft,
        };

        const { runSemanticRefillStage, resolveSemanticRefillModel } =
          await import("@/lib/mdd/semantic-refill");
        const refillModel = resolveSemanticRefillModel();
        const refill = await runSemanticRefillStage({
          envelope: {
            title: data.title,
            vessel: data.vessel,
            pastedText: data.pastedText,
            currentDecisionQuestion: cdq,
          },
          controlled: draft,
          findings: ctrl.findings,
          needsSemanticFill: ctrl.needsSemanticFill,
          model: refillModel,
          llmConfig: { ...config, model: refillModel },
        });
        if (refill) {
          draft = refill.controlled;
          semanticRefillMeta = refill.audit;
          controlMeta = {
            ...controlMeta,
            needsSemanticFill: refill.needsSemanticFill,
            findings: refill.findings,
          };
        }
      }

      const financeAct = resolveFinanceGateActivation({
        primaryCaseType: draft.primaryCaseType,
        currentDecisionQuestion: cdq,
        financeSourceInput: data.financeSnapshot ?? null,
        llmFinanceExtensionPresent: Boolean(draft.finance),
      });

      const gate = evaluateQualityGateV1_1(
        subjectFromStructuredOutput(draft, {
          financeGateActive: financeAct.active,
        }),
      );

      const assembled = assembleCanonicalOutputV012(draft, gate);
      const canonical = parseMddStructuredOutput(assembled);
      if (!canonical.success) {
        return NextResponse.json({
          engine: "llm",
          model: llm.model,
          provider: llm.provider,
          decisionControl: controlMeta,
          semanticRefill: semanticRefillMeta,
          financeGateActivation: financeAct,
          originalLlmDraft: controlMeta?.originalLlmDraft ?? originalLlmDraft,
          preAssemblyDraft: draft,
          assembledOutput: assembled,
          rawStructuredOutput: assembled,
          schemaValid: false,
          structuralValid: true,
          schemaError: canonical.error.flatten(),
          notes:
            "Failed Canonical Schema v1.0 after Gate-owned Canonical Output Assembly",
          qualityGate: {
            passed: gate.passed,
            enforcedReadiness: gate.enforcedReadiness,
            criticalFailures: gate.criticalFailures,
            warnings: gate.warnings,
          },
        });
      }

      return NextResponse.json({
        engine: "llm",
        model: llm.model,
        provider: llm.provider,
        decisionControl: controlMeta,
        semanticRefill: semanticRefillMeta,
        financeGateActivation: financeAct,
        originalLlmDraft: controlMeta?.originalLlmDraft ?? originalLlmDraft,
        rawStructuredOutput: canonical.data,
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
