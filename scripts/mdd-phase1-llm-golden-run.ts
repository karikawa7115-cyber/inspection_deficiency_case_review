/**
 * Phase 1 live LLM Golden Case run (GC01–GC04).
 * Pipeline: Schema → Quality Gate → enforced Readiness → Golden LLM Evaluation.
 * Does not modify frozen Specs / Prompt / Schema / Gate / Eval rules.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/mdd-phase1-llm-golden-run.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GOLDEN_CASE_SPECS } from "../lib/mdd/golden/specs";
import { runGoldenLlmEvalPipeline } from "../lib/mdd/golden/llm-eval-v1";
import {
  callLlmForStructuredOutput,
  resolveLlmConfigFromEnv,
} from "../lib/mdd/llm/propose-structured-v1";

type CaseRunRecord = {
  goldenId: string;
  latencyMs?: number;
  error?: string;
  rawJson?: unknown;
  schemaValid?: boolean;
  qualityGate?: {
    passed: boolean;
    enforcedReadiness: string;
    criticalFailures: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
  };
  goldenEvaluation?: {
    overall: string;
    criticalFailCodes: string[];
    dimensions: { id: string; severity: string; detail?: string }[];
  };
};

async function main() {
  const config = resolveLlmConfigFromEnv();
  if (!config) {
    console.error(
      "Missing MDD_AI_API_KEY or OPENAI_API_KEY. Add to .env.local and re-run.",
    );
    process.exitCode = 2;
    return;
  }

  const startedAt = new Date().toISOString();
  const cases: CaseRunRecord[] = [];

  for (const spec of GOLDEN_CASE_SPECS) {
    console.error(`Running ${spec.id}…`);
    try {
      const llm = await callLlmForStructuredOutput(
        {
          title: spec.title,
          vessel: spec.vessel,
          pastedText: spec.inputFactsText,
          financeSourceInput: spec.financeSnapshot
            ? {
                reportedShipFund: spec.financeSnapshot.reportedShipFund,
                pendingExpenses: spec.financeSnapshot.pendingExpenses,
                adjustedBalance: spec.financeSnapshot.adjustedBalance,
                targetClosing: spec.financeSnapshot.targetClosing,
                standardCtm: spec.financeSnapshot.standardCtm,
                recoveryCtm: spec.financeSnapshot.recoveryCtm,
                vesselRequiredApprox: spec.financeSnapshot.vesselRequiredApprox,
                recommendedCtm: spec.financeSnapshot.recommendedCtm,
                companyLiquidityConfirmed:
                  spec.financeSnapshot.companyLiquidityConfirmed,
              }
            : undefined,
        },
        config,
      );

      const report = runGoldenLlmEvalPipeline(spec, llm.rawJson);
      cases.push({
        goldenId: spec.id,
        latencyMs: llm.latencyMs,
        rawJson: llm.rawJson,
        schemaValid: report.schemaValid,
        qualityGate: {
          passed: report.qualityGate.passed,
          enforcedReadiness: report.qualityGate.enforcedReadiness,
          criticalFailures: report.qualityGate.criticalFailures,
          warnings: report.qualityGate.warnings,
        },
        goldenEvaluation: {
          overall: report.overall,
          criticalFailCodes: report.criticalFailCodes,
          dimensions: report.dimensions.map((d) => ({
            id: d.id,
            severity: d.severity,
            detail: d.detail,
          })),
        },
      });
      console.error(
        `  ${spec.id}: schema=${report.schemaValid} gate=${report.qualityGate.passed} golden=${report.overall}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      cases.push({ goldenId: spec.id, error: message });
      console.error(`  ${spec.id}: ERROR ${message}`);
    }
  }

  const outDir = path.join(process.cwd(), "tmp");
  await mkdir(outDir, { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `mdd-llm-golden-run-${stamp}.json`);
  const mdPath = path.join(outDir, `mdd-llm-golden-run-${stamp}.md`);

  const payload = {
    startedAt,
    finishedAt: new Date().toISOString(),
    provider: config.baseUrl.includes("openai.com")
      ? "openai-compatible"
      : "custom-openai-compatible",
    model: config.model,
    baseUrl: config.baseUrl,
    note: "First live Phase 1 LLM validation. Frozen specs were not tuned.",
    cases,
  };

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  const lines: string[] = [
    `# MDD Phase 1 LLM Golden Run`,
    ``,
    `- Started: ${payload.startedAt}`,
    `- Provider: ${payload.provider}`,
    `- Model: ${payload.model}`,
    `- Base URL: ${payload.baseUrl}`,
    ``,
    `## Summary`,
    ``,
  ];

  for (const c of cases) {
    if (c.error) {
      lines.push(`- **${c.goldenId}**: ERROR — ${c.error}`);
      continue;
    }
    lines.push(
      `- **${c.goldenId}**: schema=${c.schemaValid} · gate.passed=${c.qualityGate?.passed} · enforced=${c.qualityGate?.enforcedReadiness} · golden=${c.goldenEvaluation?.overall}`,
    );
    if (c.qualityGate?.criticalFailures.length) {
      lines.push(
        `  - Critical gates: ${c.qualityGate.criticalFailures.map((f) => f.code).join(", ")}`,
      );
    }
    if (c.qualityGate?.warnings.length) {
      lines.push(
        `  - Warnings: ${c.qualityGate.warnings.map((f) => f.code).join(", ")}`,
      );
    }
    if (c.goldenEvaluation?.criticalFailCodes.length) {
      lines.push(
        `  - Golden CF codes: ${c.goldenEvaluation.criticalFailCodes.join(", ")}`,
      );
    }
  }

  lines.push(``, `Full JSON: \`${jsonPath}\``);
  await writeFile(mdPath, lines.join("\n"), "utf8");

  console.log(JSON.stringify({ jsonPath, mdPath, summary: cases.map((c) => ({
    id: c.goldenId,
    error: c.error,
    schemaValid: c.schemaValid,
    gatePassed: c.qualityGate?.passed,
    enforced: c.qualityGate?.enforcedReadiness,
    golden: c.goldenEvaluation?.overall,
  })) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
