import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const files = readdirSync("tmp")
  .filter((f) => f.startsWith("mdd-llm-golden-run-") && f.endsWith(".json"))
  .sort();
const curPath = `tmp/${files[files.length - 1]!}`;
const prevPath = "tmp/mdd-llm-golden-run-2026-08-23T10-18-25-728Z.json";
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
        findings?: { code: string; message: string }[];
        interventions?: { ruleId: string; fieldPath: string; reason: string }[];
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
  const interventions = dc?.interventions ?? [];
  const ad = interventions.filter((i) =>
    /AD-INSPECT-RC|AD-FINANCE-SHIPFUND|authorityDomain/i.test(
      `${i.ruleId} ${i.fieldPath}`,
    ),
  );
  const rcBg = interventions.filter((i) =>
    /RC-B-GUARDED|RC-MR-FILTER/i.test(i.ruleId),
  );
  return {
    side: label,
    id: c.goldenId,
    structuralValid: c.structuralValid,
    canonicalValid: c.canonicalValid ?? c.schemaValid,
    notes: c.notes,
    finance: (c.financeGateActivation as { label?: string } | undefined)?.label,
    controlApplied: dc?.applied,
    needsSemanticFill: dc?.needsSemanticFill,
    findings: (dc?.findings ?? []).map((f) => f.code),
    interventions: interventions.map((i) => `${i.ruleId}:${i.fieldPath}`),
    authorityDomain: ad.map((i) => `${i.ruleId}:${i.fieldPath} — ${i.reason}`),
    reviewPolicy: rcBg.map((i) => `${i.ruleId}:${i.fieldPath} — ${i.reason}`),
    readiness: c.readiness ?? {
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
    // MR: from original vs controlled if we can infer from findings / need rawJson
    rawMr: (c.rawJson as { learning?: { managementReviewCandidate?: boolean } })
      ?.learning?.managementReviewCandidate,
    // controlled MR not in summarizeDraft — pull from decisionControl if extended later
    gatePassed: qg?.passed,
    criticals: (qg?.criticalFailures ?? []).map((f) => f.code),
    warnings: (qg?.warnings ?? []).map((f) => f.code),
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
    note: cur.note,
    cases: cur.cases.map((c: Record<string, unknown>) =>
      summarize(c, "v0.2"),
    ),
  },
  previousV012: {
    path: prevPath,
    startedAt: prev.startedAt,
    cases: prev.cases.map((c: Record<string, unknown>) =>
      summarize(c, "v0.1.2"),
    ),
  },
};

writeFileSync("tmp/mdd-v02-live-rerun-extract.json", JSON.stringify(out, null, 2));

// Enrich MR final from controlled learning if present in full controlled object — script may not store it
for (const c of cur.cases) {
  const dc = c.decisionControl;
  if (!dc) continue;
  // re-read from interventions / we need to parse controlled from report - check if script stored learning
}

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
        ad: c.authorityDomain,
        rcPolicy: c.reviewPolicy,
        rawRC: c.rawRC,
        ctrlRC: c.ctrlRC,
        rawMr: c.rawMr,
        rawAuth: c.rawAuth,
        ctrlAuth: c.ctrlAuth,
      })),
      prev: out.previousV012.cases.map((c) => ({
        id: c.id,
        canon: c.canonicalValid,
        golden: c.golden,
        fails: c.failedDims,
        ctrlRC: c.ctrlRC,
        ctrlAuth: c.ctrlAuth,
      })),
    },
    null,
    2,
  ),
);
