import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const files = readdirSync("tmp")
  .filter((f) => f.startsWith("mdd-llm-golden-run-") && f.endsWith(".json"))
  .sort();
const curPath = `tmp/${files[files.length - 1]!}`;
const prevPath = "tmp/mdd-llm-golden-run-2026-08-23T09-05-22-818Z.json";
const cur = JSON.parse(readFileSync(curPath, "utf8"));
const prev = JSON.parse(readFileSync(prevPath, "utf8"));

function failDims(c: {
  goldenEvaluation?: {
    dimensions?: { id: string; severity: string; detail?: string }[];
  };
}) {
  return (c.goldenEvaluation?.dimensions ?? [])
    .filter((d) => d.severity === "fail" || d.severity === "critical_fail")
    .map((d) => `${d.id}${d.detail ? ` (${d.detail})` : ""}`);
}

function summarize(c: Record<string, unknown>, label: string) {
  const dc = c.decisionControl as
    | {
        applied?: boolean;
        needsSemanticFill?: boolean;
        findings?: { code: string }[];
        interventions?: { ruleId: string; fieldPath: string }[];
        raw?: Record<string, unknown>;
        controlled?: Record<string, unknown>;
      }
    | undefined;
  const qg = c.qualityGate as
    | {
        passed?: boolean;
        enforcedReadiness?: string;
        criticalFailures?: { code: string; message: string }[];
        warnings?: { code: string }[];
      }
    | undefined;
  const fin = c.financeGateActivation as { label?: string } | undefined;
  const readiness = c.readiness as Record<string, string> | undefined;
  return {
    side: label,
    id: c.goldenId,
    structuralValid: c.structuralValid,
    canonicalValid: c.canonicalValid ?? c.schemaValid,
    notes: c.notes,
    finance: fin?.label,
    controlApplied: dc?.applied,
    needsSemanticFill: dc?.needsSemanticFill,
    findings: (dc?.findings ?? []).map((f) => f.code),
    interventions: (dc?.interventions ?? []).map(
      (i) => `${i.ruleId}:${i.fieldPath}`,
    ),
    readiness: readiness ?? {
      raw: dc?.raw?.decisionReadiness,
      controlled: dc?.controlled?.decisionReadiness,
      enforced: qg?.enforcedReadiness,
    },
    rawAuth: dc?.raw?.authorities,
    ctrlAuth: dc?.controlled?.authorities,
    rawPD: dc?.raw?.presidentDecision,
    ctrlPD: dc?.controlled?.presidentDecision,
    rawRC: dc?.raw?.reviewCandidate,
    ctrlRC: dc?.controlled?.reviewCandidate,
    gatePassed: qg?.passed,
    criticals: (qg?.criticalFailures ?? []).map(
      (f) => `${f.code}: ${f.message}`,
    ),
    warnings: (qg?.warnings ?? []).map((f) => f.code),
    assembledQG: c.assembledFinalQualityGate,
    originalQG: c.originalLlmQualityGate,
    golden: (c.goldenEvaluation as { overall?: string } | undefined)?.overall,
    cfCodes:
      (c.goldenEvaluation as { criticalFailCodes?: string[] } | undefined)
        ?.criticalFailCodes ?? [],
    failedDims: failDims(c as never),
  };
}

const out = {
  current: {
    path: curPath,
    startedAt: cur.startedAt,
    finishedAt: cur.finishedAt,
    model: cur.model,
    pipeline: cur.pipeline,
    decisionControlVersion: cur.decisionControlVersion,
    cases: cur.cases.map((c: Record<string, unknown>) =>
      summarize(c, "v0.1.2"),
    ),
  },
  previousV011: {
    path: prevPath,
    startedAt: prev.startedAt,
    finishedAt: prev.finishedAt,
    cases: prev.cases.map((c: Record<string, unknown>) =>
      summarize(c, "v0.1.1"),
    ),
  },
};

writeFileSync(
  "tmp/mdd-v012-live-rerun-extract.json",
  JSON.stringify(out, null, 2),
);
console.log(
  JSON.stringify(
    {
      artifact: curPath,
      now: out.current.cases.map((c) => ({
        id: c.id,
        struct: c.structuralValid,
        canon: c.canonicalValid,
        finance: c.finance,
        gate: c.gatePassed,
        golden: c.golden,
        nsf: c.needsSemanticFill,
        readiness: c.readiness,
        fails: c.failedDims,
        findings: c.findings,
        criticals: c.criticals,
      })),
      prev: out.previousV011.cases.map((c) => ({
        id: c.id,
        struct: c.structuralValid,
        canon: c.canonicalValid,
        finance: c.finance,
        gate: c.gatePassed,
        golden: c.golden,
        fails: c.failedDims,
        criticals: c.criticals,
      })),
    },
    null,
    2,
  ),
);
