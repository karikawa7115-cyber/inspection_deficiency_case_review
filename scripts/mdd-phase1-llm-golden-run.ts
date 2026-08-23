/**
 * Phase 1 live LLM Golden Case run (GC01–GC04).
 * Pipeline: Pre-Control Structural → Decision Control → Canonical Schema →
 * Quality Gate → Golden LLM Evaluation.
 * Does not modify frozen Specs / Prompt / Schema / Gate / Eval rules.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/mdd-phase1-llm-golden-run.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GOLDEN_CASE_SPECS } from "../lib/mdd/golden/specs";
import { getGoldenCaseCdq } from "../lib/mdd/golden/cdq-envelopes";
import { runGoldenLlmEvalPipeline } from "../lib/mdd/golden/llm-eval-v1";
import { isDecisionControlV01Enabled } from "../lib/mdd/decision-control";
import { resolveFinanceGateActivation } from "../lib/mdd/quality-gate/finance-activation-v1.1";
import {
  parseMddStructuredOutputStructural,
  type MddStructuredOutput,
} from "../lib/mdd/schema/structured-output-v1";
import {
  callLlmForStructuredOutput,
  resolveLlmConfigFromEnv,
} from "../lib/mdd/llm/propose-structured-v1";

type FinanceLabel =
  | "F0"
  | "F1"
  | "F2"
  | "F3"
  | "F1+F2"
  | "F1+F3"
  | "F2+F3"
  | "F1+F2+F3"
  | "inactive";

type CaseRunRecord = {
  goldenId: string;
  latencyMs?: number;
  error?: string;
  responseFormat?: string;
  normalizationRepairs?: string[];
  providerRawJson?: unknown;
  rawJson?: unknown;
  structuralValid?: boolean;
  canonicalValid?: boolean;
  schemaValid?: boolean;
  notes?: string;
  financeGateActivation?: {
    active: boolean;
    reasons: Array<"F1" | "F2" | "F3">;
    spuriousLlmFinanceExtension: boolean;
    label: FinanceLabel;
  };
  decisionControl?: {
    applied: boolean;
    controlVersion: string;
    needsSemanticFill: boolean;
    findings: { code: string; message: string }[];
    interventions: {
      ruleId: string;
      fieldPath: string;
      reason: string;
    }[];
    raw: {
      primaryCaseType?: string;
      tags?: string[];
      authorities?: { roleLabel: string; authority: string; status: string }[];
      presidentDecision?: { text: string; requiredNow: boolean };
      reviewCandidate?: unknown;
      decisionReadiness?: string;
      financePresent?: boolean;
    };
    controlled: {
      primaryCaseType?: string;
      tags?: string[];
      authorities?: { roleLabel: string; authority: string; status: string }[];
      presidentDecision?: { text: string; requiredNow: boolean };
      reviewCandidate?: unknown;
      decisionReadiness?: string;
      financePresent?: boolean;
    };
  };
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

function financeLabel(
  reasons: Array<"F1" | "F2" | "F3">,
  spurious: boolean,
): FinanceLabel {
  if (reasons.length === 0) return spurious ? "F0" : "inactive";
  if (reasons.length === 3) return "F1+F2+F3";
  if (reasons.length === 2) {
    const key = [...reasons].sort().join("+");
    if (key === "F1+F2") return "F1+F2";
    if (key === "F1+F3") return "F1+F3";
    return "F2+F3";
  }
  return reasons[0]!;
}

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
      const cdq = getGoldenCaseCdq(spec.id);
      const financeSourceInput = spec.financeSnapshot
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
        : null;

      const llm = await callLlmForStructuredOutput(
        {
          title: spec.title,
          vessel: spec.vessel,
          pastedText: spec.inputFactsText,
          currentDecisionQuestion: cdq,
          financeSourceInput: financeSourceInput ?? undefined,
        },
        config,
      );

      const structural = parseMddStructuredOutputStructural(llm.rawJson);
      const report = await runGoldenLlmEvalPipeline(spec, llm.rawJson, {
        applyDecisionControl: isDecisionControlV01Enabled(),
        envelope: {
          title: spec.title,
          vessel: spec.vessel,
          pastedText: spec.inputFactsText,
          currentDecisionQuestion: cdq,
        },
        financeSourceInput,
        semanticRefillLlmConfig: {
          ...config,
          model:
            process.env.MDD_SEMANTIC_REFILL_MODEL?.trim() ||
            config.model ||
            "gpt-4o-mini",
        },
      });
      const dc = report.decisionControl;
      const draftForFinance: MddStructuredOutput | null = dc?.controlled
        ? dc.controlled
        : structural.success
          ? structural.data
          : null;
      const financeAct = draftForFinance
        ? resolveFinanceGateActivation({
            primaryCaseType: draftForFinance.primaryCaseType,
            currentDecisionQuestion: cdq,
            financeSourceInput,
            llmFinanceExtensionPresent: Boolean(draftForFinance.finance),
          })
        : null;

      const summarizeDraft = (d: MddStructuredOutput) => ({
        primaryCaseType: d.primaryCaseType,
        tags: d.tags,
        authorities: d.executive.decisionAuthorities.map((a) => ({
          roleLabel: a.roleLabel,
          authority: String(a.authority),
          status: a.status,
        })),
        presidentDecision: {
          text: d.executive.presidentDecision.text,
          requiredNow: d.executive.presidentDecision.requiredNow,
        },
        reviewCandidate: d.reviewCandidate,
        decisionReadiness: d.executive.decisionReadiness,
        financePresent: Boolean(d.finance),
      });

      const structuralValid = structural.success;
      const canonicalValid = report.schemaValid;

      cases.push({
        goldenId: spec.id,
        latencyMs: llm.latencyMs,
        responseFormat: llm.responseFormat,
        normalizationRepairs: llm.normalizationRepairs,
        providerRawJson: llm.providerRawJson,
        rawJson: llm.rawJson,
        structuralValid,
        canonicalValid,
        schemaValid: report.schemaValid,
        notes: report.notes,
        financeGateActivation: financeAct
          ? {
              active: financeAct.active,
              reasons: financeAct.reasons,
              spuriousLlmFinanceExtension:
                financeAct.spuriousLlmFinanceExtension,
              label: financeLabel(
                financeAct.reasons,
                financeAct.spuriousLlmFinanceExtension,
              ),
            }
          : undefined,
        decisionControl: dc
          ? {
              applied: dc.applied,
              controlVersion: dc.controlVersion,
              needsSemanticFill: dc.needsSemanticFill,
              findings: dc.findings,
              interventions: (dc.audit ?? []).map((a) => ({
                ruleId: a.ruleId,
                fieldPath: a.fieldPath,
                reason: a.reason,
              })),
              raw: summarizeDraft(dc.originalLlmDraft),
              controlled: summarizeDraft(dc.controlled),
            }
          : undefined,
        qualityGate: {
          passed: report.qualityGate.passed,
          enforcedReadiness: report.qualityGate.enforcedReadiness,
          criticalFailures: report.qualityGate.criticalFailures,
          warnings: report.qualityGate.warnings,
        },
        assembledFinalQualityGate: report.assembledOutput?.qualityGate,
        originalLlmQualityGate:
          report.originalLlmDraft?.qualityGate ??
          (structural.success ? structural.data.qualityGate : undefined),
        readiness: {
          rawLlm: report.originalLlmDraft?.executive.decisionReadiness,
          controlStaged: dc?.controlled.executive.decisionReadiness,
          finalEnforced: report.qualityGate.enforcedReadiness,
          assembledFinal:
            report.assembledOutput?.executive.decisionReadiness,
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
        `  ${spec.id}: structural=${structuralValid} canonical=${canonicalValid} gate=${report.qualityGate.passed} golden=${report.overall} finance=${financeAct ? financeLabel(financeAct.reasons, financeAct.spuriousLlmFinanceExtension) : "n/a"} control=${dc?.applied ?? false}`,
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
    note: "Decision Pipeline v0.1.2: Control → Gate-owned qualityGate/readiness → Canonical Assembly → Canonical Schema. Quality Gate v1.1. Model gpt-4o-mini. Frozen Prompt/Schema/Golden Spec/Eval not tuned after run.",
    responseFormat: "json_schema_strict",
    qualityGateVersion: "1.1",
    decisionControlVersion: isDecisionControlV01Enabled() ? "0.1+0.1.1" : "off",
    pipeline:
      "Raw+CDQ → LLM → Pre-Control Structural → Decision Control → Quality Gate v1.1 → Enforced Readiness → Canonical Assembly → Canonical Schema v1.0 → Golden Eval",
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
    `- Decision Control: ${payload.decisionControlVersion}`,
    `- Pipeline: ${payload.pipeline}`,
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
      `- **${c.goldenId}**: structural=${c.structuralValid} · canonical=${c.canonicalValid} · gate.passed=${c.qualityGate?.passed} · enforced=${c.qualityGate?.enforcedReadiness} · finance=${c.financeGateActivation?.label} · golden=${c.goldenEvaluation?.overall}`,
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

  console.log(
    JSON.stringify(
      {
        jsonPath,
        mdPath,
        summary: cases.map((c) => ({
          id: c.goldenId,
          error: c.error,
          structuralValid: c.structuralValid,
          canonicalValid: c.canonicalValid,
          finance: c.financeGateActivation?.label,
          gatePassed: c.qualityGate?.passed,
          enforced: c.qualityGate?.enforcedReadiness,
          golden: c.goldenEvaluation?.overall,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
