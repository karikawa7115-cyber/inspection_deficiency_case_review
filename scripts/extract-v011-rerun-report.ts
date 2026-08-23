import { readFileSync, writeFileSync } from "node:fs";
import { getGoldenCaseCdq } from "../lib/mdd/golden/cdq-envelopes";
import { GOLDEN_CASE_SPECS } from "../lib/mdd/golden/specs";
import { resolveFinanceGateActivation } from "../lib/mdd/quality-gate/finance-activation-v1.1";
import { parseMddStructuredOutput } from "../lib/mdd/schema/structured-output-v1";

const curPath = "tmp/mdd-llm-golden-run-2026-08-23T08-58-14-913Z.json";
const prevPath = "tmp/mdd-llm-golden-run-2026-08-23T08-15-01-073Z.json";
const cur = JSON.parse(readFileSync(curPath, "utf8"));
const prev = JSON.parse(readFileSync(prevPath, "utf8"));

function failDims(c: {
  goldenEvaluation?: {
    dimensions?: { id: string; severity: string; detail?: string }[];
  };
}) {
  return (c.goldenEvaluation?.dimensions ?? []).filter(
    (d) => d.severity === "fail" || d.severity === "critical_fail",
  );
}

function reconstructFinance(c: {
  goldenId: string;
  rawJson?: { finance?: unknown; primaryCaseType?: string };
  decisionControl?: {
    controlled?: { primaryCaseType?: string };
    raw?: { primaryCaseType?: string };
  };
}) {
  const spec = GOLDEN_CASE_SPECS.find((s) => s.id === c.goldenId);
  const type =
    c.decisionControl?.controlled?.primaryCaseType ??
    c.rawJson?.primaryCaseType ??
    "OPERATIONAL";
  const act = resolveFinanceGateActivation({
    primaryCaseType: type,
    currentDecisionQuestion: getGoldenCaseCdq(
      c.goldenId as "GC01" | "GC02" | "GC03" | "GC04",
    ),
    financeSourceInput: spec?.financeSnapshot ?? null,
    llmFinanceExtensionPresent: Boolean(c.rawJson?.finance),
  });
  const label =
    act.reasons.length === 0
      ? act.spuriousLlmFinanceExtension
        ? "F0"
        : "inactive"
      : act.reasons.join("+");
  return { ...act, label, llmFinancePresent: Boolean(c.rawJson?.finance) };
}

function summarize(c: Record<string, unknown>) {
  const dc = c.decisionControl as
    | {
        applied?: boolean;
        needsSemanticFill?: boolean;
        findings?: unknown[];
        interventions?: { ruleId: string; fieldPath: string; reason: string }[];
        raw?: Record<string, unknown>;
        controlled?: Record<string, unknown>;
      }
    | undefined;
  const finance =
    (c.financeGateActivation as Record<string, unknown> | undefined) ??
    reconstructFinance(c as never);

  let canonicalIssues: unknown = null;
  if (dc?.controlled && c.schemaValid === false) {
    // controlled summary may not be full draft — use rawJson + note that we need full controlled from audit path
    // Full controlled is not in summarize; try rawJson through control is lost.
    // Re-check from decisionControl if we stored full objects — we only stored summaries.
    canonicalIssues = "see notes; controlled full draft not in summary";
  }

  // If we have provider raw and control applied, re-parse from rawJson after noting MR/flag
  if (c.notes && String(c.notes).includes("Canonical")) {
    const full = c.rawJson as Record<string, unknown> | undefined;
    if (full) {
      // Attempt: parse structural then apply isn't available; check raw canonical issues
      const rawCanon = parseMddStructuredOutput(full);
      if (!rawCanon.success) {
        canonicalIssues = {
          stage: "raw_also_fails_or_controlled_diverged",
          issues: rawCanon.error.issues.slice(0, 8).map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        };
      }
    }
  }

  return {
    id: c.goldenId,
    structuralValid: c.structuralValid ?? (dc ? true : c.schemaValid),
    canonicalValid: c.canonicalValid ?? c.schemaValid,
    schemaValid: c.schemaValid,
    notes: c.notes,
    finance,
    controlApplied: dc?.applied,
    needsSemanticFill: dc?.needsSemanticFill,
    findings: dc?.findings ?? [],
    interventions: (dc?.interventions ?? []).map(
      (i) => `${i.ruleId}:${i.fieldPath}`,
    ),
    interventionDetails: dc?.interventions ?? [],
    rawReady: dc?.raw?.decisionReadiness,
    ctrlReady: dc?.controlled?.decisionReadiness,
    enforced: (c.qualityGate as { enforcedReadiness?: string } | undefined)
      ?.enforcedReadiness,
    rawAuth: dc?.raw?.authorities,
    ctrlAuth: dc?.controlled?.authorities,
    rawPD: dc?.raw?.presidentDecision,
    ctrlPD: dc?.controlled?.presidentDecision,
    rawRC: dc?.raw?.reviewCandidate,
    ctrlRC: dc?.controlled?.reviewCandidate,
    rawType: dc?.raw?.primaryCaseType,
    ctrlType: dc?.controlled?.primaryCaseType,
    rawTags: dc?.raw?.tags,
    ctrlTags: dc?.controlled?.tags,
    gatePassed: (c.qualityGate as { passed?: boolean } | undefined)?.passed,
    criticals:
      (c.qualityGate as { criticalFailures?: unknown[] } | undefined)
        ?.criticalFailures ?? [],
    warnings:
      (c.qualityGate as { warnings?: unknown[] } | undefined)?.warnings ?? [],
    golden: (c.goldenEvaluation as { overall?: string } | undefined)?.overall,
    cfCodes:
      (c.goldenEvaluation as { criticalFailCodes?: string[] } | undefined)
        ?.criticalFailCodes ?? [],
    failedDims: failDims(c as never),
    financePresentRaw: Boolean(
      (c.rawJson as { finance?: unknown } | undefined)?.finance,
    ),
    learningMR: (c.rawJson as { learning?: { managementReviewCandidate?: boolean } } | undefined)
      ?.learning?.managementReviewCandidate,
    canonicalIssues,
  };
}

const out = {
  current: {
    path: curPath,
    startedAt: cur.startedAt,
    finishedAt: cur.finishedAt,
    model: cur.model,
    decisionControlVersion: cur.decisionControlVersion,
    cases: cur.cases.map(summarize),
  },
  previousControlV01: {
    path: prevPath,
    startedAt: prev.startedAt,
    finishedAt: prev.finishedAt,
    model: prev.model,
    decisionControlVersion: prev.decisionControlVersion,
    note: prev.note,
    cases: prev.cases.map(summarize),
  },
};

writeFileSync(
  "tmp/mdd-v011-rerun-report-extract.json",
  JSON.stringify(out, null, 2),
);
console.log("wrote tmp/mdd-v011-rerun-report-extract.json");
for (const c of out.current.cases) {
  console.log(
    [
      c.id,
      `struct=${c.structuralValid}`,
      `canon=${c.canonicalValid}`,
      `fin=${(c.finance as { label?: string }).label}`,
      `gate=${c.gatePassed}/${c.enforced}`,
      `golden=${c.golden}`,
      `nsf=${c.needsSemanticFill}`,
      `ready ${c.rawReady}->${c.ctrlReady}`,
      `fails=${c.failedDims.map((d: { id: string }) => d.id).join(",") || "-"}`,
    ].join(" | "),
  );
  if (c.canonicalIssues) console.log("  canonIssues", JSON.stringify(c.canonicalIssues));
}
