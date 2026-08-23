/**
 * Golden Case LLM Evaluation Rules v1.0.
 * Human SSoT: docs/mdd/GOLDEN_CASE_LLM_EVALUATION_RULES_v1.0.md (frozen).
 * Pipeline: Schema → Quality Gate → enforced Readiness → Golden eval.
 * Does not connect production LLM.
 */
import type { AnalyzeProposal, DecisionReadiness } from "../types";
import {
  parseMddStructuredOutput,
  type MddStructuredOutput,
} from "../schema/structured-output-v1";
import {
  evaluateQualityGateV1,
  subjectFromStructuredOutput,
  type QualityGateEvaluation,
} from "../quality-gate/evaluate-v1";
import type { GoldenCaseSpec } from "./specs";

export type DimensionSeverity = "pass" | "warning" | "fail" | "critical_fail";

export type GoldenDimensionResult = {
  id: string;
  label: string;
  severity: DimensionSeverity;
  detail?: string;
};

export type GoldenOverall =
  | "Pass"
  | "PassWithWarnings"
  | "Fail"
  | "CriticalFail";

export type CriticalFailCode =
  | "CF_WRONG_CASE_TYPE"
  | "CF_WRONG_AUTHORITY"
  | "CF_BOUNDARY_VIOLATION"
  | "CF_UNSAFE_OR_COMPLIANCE_REC"
  | "CF_FORBIDDEN_RECOMMENDATION"
  | "CF_READY_WITH_CRITICAL_GATE"
  | "CF_FACT_DISCIPLINE_BREAK"
  | "CF_REVIEW_FLAG_REQUIRED_MISSING"
  | "CF_SCHEMA_INVALID"
  | "CF_UNRESOLVED_CRITICAL_GATE";

export type GoldenLlmEvalReport = {
  goldenId: GoldenCaseSpec["id"];
  overall: GoldenOverall;
  dimensions: GoldenDimensionResult[];
  criticalFailCodes: CriticalFailCode[];
  qualityGate: {
    passed: boolean;
    criticalFailures: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
    enforcedReadiness: DecisionReadiness;
  };
  schemaValid: boolean;
  notes?: string;
};

function includesAny(hay: string, needles: string[]) {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function includesAll(hay: string, needles: string[]) {
  const h = hay.toLowerCase();
  return needles.every((n) => h.includes(n.toLowerCase()));
}

const EXEC_WARN_CHARS = 1800;

function dim(
  id: string,
  label: string,
  severity: DimensionSeverity,
  detail?: string,
): GoldenDimensionResult {
  return { id, label, severity, detail };
}

function rollup(
  dimensions: GoldenDimensionResult[],
  criticalFailCodes: CriticalFailCode[],
  gatePassed: boolean,
): GoldenOverall {
  // Golden PASS cannot override unresolved Critical Gate
  if (!gatePassed) {
    if (
      criticalFailCodes.includes("CF_READY_WITH_CRITICAL_GATE") ||
      criticalFailCodes.includes("CF_UNRESOLVED_CRITICAL_GATE") ||
      dimensions.some((d) => d.severity === "critical_fail")
    ) {
      return "CriticalFail";
    }
    return "Fail";
  }
  if (
    criticalFailCodes.length > 0 ||
    dimensions.some((d) => d.severity === "critical_fail")
  ) {
    return "CriticalFail";
  }
  if (dimensions.some((d) => d.severity === "fail")) return "Fail";
  if (dimensions.some((d) => d.severity === "warning")) return "PassWithWarnings";
  return "Pass";
}

/**
 * Dimension evaluation against Spec (semantic equivalence).
 * Uses post-gate enforced readiness on the candidate.
 */
export function evaluateGoldenDimensions(
  spec: GoldenCaseSpec,
  output: MddStructuredOutput,
  gate: QualityGateEvaluation,
): {
  dimensions: GoldenDimensionResult[];
  criticalFailCodes: CriticalFailCode[];
} {
  const dimensions: GoldenDimensionResult[] = [];
  const criticalFailCodes: CriticalFailCode[] = [];
  const tags = output.tags.map((t) => t.toLowerCase());
  const rec = output.executive.recommendation.text;
  const president = output.executive.presidentDecision.text;
  const why = output.executive.why.text;
  const recWhy = `${rec}\n${president}\n${why}`;
  const readiness = output.executive.decisionReadiness;
  const authBlob = output.executive.decisionAuthorities
    .map((a) => `${a.roleLabel} ${a.authority}`)
    .join(" | ");
  const nextBlob = output.executive.nextActions
    .map((a) => `${a.who} ${a.what}`)
    .join(" | ");

  // D01 Case type
  if (output.primaryCaseType === spec.expectedPrimaryCaseType) {
    dimensions.push(dim("D01", "Primary Case Type", "pass"));
  } else {
    dimensions.push(
      dim(
        "D01",
        "Primary Case Type",
        "critical_fail",
        `expected ${spec.expectedPrimaryCaseType}, got ${output.primaryCaseType}`,
      ),
    );
    criticalFailCodes.push("CF_WRONG_CASE_TYPE");
  }

  // Tags
  const missingRequired = spec.requiredTags.filter(
    (t) => !tags.includes(t.toLowerCase()),
  );
  dimensions.push(
    dim(
      "T01",
      "Required tags",
      missingRequired.length === 0 ? "pass" : "fail",
      missingRequired.length
        ? `missing: ${missingRequired.join(", ")}`
        : undefined,
    ),
  );

  // D02 Fact separation
  const hasBuckets =
    output.facts.confirmed.length +
      output.facts.unverified.length +
      output.facts.assumptions.length +
      output.facts.missingInformation.length >
    0;
  const derivedAsConfirmed = output.facts.confirmed.some((f) =>
    /adjusted\s*(?:balance|≈)|derived (?:from|calculation)/i.test(f.text),
  );
  const hypothesisConfirmed = output.facts.confirmed.some((f) =>
    /system weakness|broader weakness/i.test(f.text),
  );
  if (hypothesisConfirmed || (spec.id === "GC04" && derivedAsConfirmed)) {
    dimensions.push(
      dim(
        "D02",
        "Fact separation",
        "critical_fail",
        "Derived/hypothesis improperly in Confirmed Facts",
      ),
    );
    criticalFailCodes.push("CF_FACT_DISCIPLINE_BREAK");
  } else {
    dimensions.push(
      dim(
        "D02",
        "Fact separation",
        hasBuckets ? "pass" : "fail",
        hasBuckets ? undefined : "fact buckets empty",
      ),
    );
  }

  // D03 Missing info quality
  const missingOk = output.facts.missingInformation.every(
    (m) => m.who.trim() && m.what.trim() && m.evidenceRequired.trim(),
  );
  const wronglyBlockedPort =
    spec.id === "GC01" &&
    readiness === "NOT_READY" &&
    output.facts.missingInformation.some((m) =>
      /port|eta/i.test(m.text),
    ) &&
    output.facts.missingInformation.every((m) =>
      /port|eta|document|continuation|manning/i.test(m.text),
    );
  if (wronglyBlockedPort) {
    dimensions.push(
      dim(
        "D03",
        "Missing Information quality",
        "fail",
        "JP port/ETA alone must not force NOT_READY",
      ),
    );
  } else {
    dimensions.push(
      dim(
        "D03",
        "Missing Information quality",
        missingOk || output.facts.missingInformation.length === 0
          ? "pass"
          : "fail",
      ),
    );
  }

  // D04 Authorities
  const authOk =
    output.executive.decisionAuthorities.length >= 2 &&
    spec.expectedAuthorityRoleLabels.every((role) =>
      authBlob.toLowerCase().includes(role.toLowerCase().slice(0, 12)),
    );
  const presidentVisaChase =
    spec.id === "GC01" &&
    ((/visa|document chasing|chase (?:every )?document/i.test(recWhy) &&
      /president/i.test(recWhy)) ||
      (/president/i.test(nextBlob) &&
        /visa|document chasing|document/i.test(nextBlob)));
  const presidentTechSubstitute =
    spec.id === "GC02" &&
    /president/i.test(recWhy) &&
    /(?:president|he|she) (?:should|must|to) (?:make|decide|interpret).{0,40}(?:technical|class)|substitutes? for (?:technical|class)|interpret class acceptance personally|make the (?:machinery\/)?class technical judgment personally/i.test(
      recWhy,
    ) &&
    !/does not make|do not make|not make the.{0,20}technical judgment/i.test(
      recWhy,
    );

  if (presidentVisaChase || presidentTechSubstitute || !authOk) {
    const critical = presidentVisaChase || presidentTechSubstitute;
    dimensions.push(
      dim(
        "D04",
        "Decision Authorities",
        critical ? "critical_fail" : "fail",
        critical
          ? presidentVisaChase
            ? "President assigned routine visa/document chasing"
            : "President substitutes for technical/Class judgment"
          : "Authority structure incomplete vs Spec",
      ),
    );
    if (critical) criticalFailCodes.push("CF_WRONG_AUTHORITY");
  } else {
    dimensions.push(dim("D04", "Decision Authorities", "pass"));
  }

  // D05 President Decision
  const presOk = includesAny(president, spec.expectedPresidentDecisionIntent);
  dimensions.push(
    dim(
      "D05",
      "President Decision",
      output.executive.presidentDecision.text.trim() && presOk
        ? "pass"
        : "fail",
      presOk ? undefined : "intent keywords not found",
    ),
  );

  // D06 Recommendation boundary
  const recOk = includesAny(rec, spec.expectedRecommendationIntent);
  const recForbidden = includesAny(
    recWhy,
    spec.forbiddenRecommendationIntent,
  );
  const closeOnPhotos =
    spec.id === "GC03" &&
    /photo|photograph|correction/i.test(recWhy) &&
    /(?:treat|case).{0,40}closed|close (?:the )?case|closed merely|merely because/i.test(
      recWhy,
    ) &&
    !/do not treat|not treat.*closed|must not close|do not close/i.test(recWhy);
  const forceNansha = includesAny(recWhy, ["force nansha", "insist on nansha"]);
  const classApprovedAll =
    spec.id === "GC02" &&
    /class(?:nk)? has approved everything|definitely applies to all/i.test(
      recWhy,
    );
  const necessaryCollapsed =
    spec.id === "GC04" &&
    /necessary and affordable|affordable because (?:it is )?necessary/i.test(
      recWhy,
    );

  if (
    closeOnPhotos ||
    forceNansha ||
    classApprovedAll ||
    necessaryCollapsed ||
    recForbidden
  ) {
    dimensions.push(
      dim(
        "D06",
        "Recommendation boundary",
        "critical_fail",
        closeOnPhotos
          ? "Closed merely because photos/corrections submitted"
          : classApprovedAll
            ? "Class acceptance overstated"
            : necessaryCollapsed
              ? "Necessary ≠ Affordable collapsed"
              : "Forbidden recommendation intent",
      ),
    );
    criticalFailCodes.push(
      closeOnPhotos
        ? "CF_UNSAFE_OR_COMPLIANCE_REC"
        : "CF_FORBIDDEN_RECOMMENDATION",
    );
    if (classApprovedAll) criticalFailCodes.push("CF_BOUNDARY_VIOLATION");
  } else {
    dimensions.push(
      dim(
        "D06",
        "Recommendation boundary",
        recOk ? "pass" : "fail",
        recOk ? undefined : "recommendation intent weak",
      ),
    );
  }

  // D07 Readiness
  const readinessExpected = Array.isArray(spec.expectedReadiness)
    ? spec.expectedReadiness
    : [spec.expectedReadiness];
  const readinessPass = readinessExpected.includes(readiness);
  const gc04ReadyNoLiquidity =
    spec.id === "GC04" &&
    readiness === "READY" &&
    output.finance?.companyFinancialFeasibility?.liquidityConfirmed !== true &&
    output.finance?.sourceFacts?.companyLiquidityConfirmed !== true &&
    output.finance?.snapshot?.companyLiquidityConfirmed !== true;

  if (gc04ReadyNoLiquidity) {
    dimensions.push(
      dim(
        "D07",
        "Decision Readiness",
        "critical_fail",
        "READY without confirmed Company liquidity",
      ),
    );
    criticalFailCodes.push("CF_READY_WITH_CRITICAL_GATE");
  } else {
    dimensions.push(
      dim(
        "D07",
        "Decision Readiness",
        readinessPass ? "pass" : "fail",
        `expected ${readinessExpected.join("|")}, got ${readiness}`,
      ),
    );
  }

  // D08 Delegation
  const delegationOk = output.executive.nextActions.length > 0;
  dimensions.push(
    dim(
      "D08",
      "Delegation",
      delegationOk ? "pass" : "fail",
      delegationOk ? undefined : "nextActions empty",
    ),
  );

  // D09 Professional boundary
  if (classApprovedAll || presidentTechSubstitute) {
    dimensions.push(
      dim(
        "D09",
        "Professional Boundary",
        "critical_fail",
        "Boundary violation in recommendation/authorities",
      ),
    );
    if (!criticalFailCodes.includes("CF_BOUNDARY_VIOLATION")) {
      criticalFailCodes.push("CF_BOUNDARY_VIOLATION");
    }
  } else if (
    gate.criticalFailures.some(
      (f) => f.code === "PROFESSIONAL_BOUNDARY_VIOLATION",
    )
  ) {
    dimensions.push(
      dim(
        "D09",
        "Professional Boundary",
        "critical_fail",
        "Quality Gate reported PROFESSIONAL_BOUNDARY_VIOLATION",
      ),
    );
    criticalFailCodes.push("CF_BOUNDARY_VIOLATION");
  } else {
    dimensions.push(dim("D09", "Professional Boundary", "pass"));
  }

  // D10 Learning
  if (spec.managementLearningSignificant) {
    const l = output.learning;
    const ok =
      l.correctiveAction &&
      l.preventiveAction &&
      l.effectivenessVerification &&
      l.horizontalCheck &&
      l.internalAuditCandidate &&
      l.managementReviewCandidate;
    dimensions.push(
      dim(
        "D10",
        "Management Learning",
        ok ? "pass" : "fail",
        ok ? undefined : "significant learning flags incomplete",
      ),
    );
  } else {
    dimensions.push(dim("D10", "Management Learning", "pass"));
  }
  if (spec.knowledgeUpdateExpected && !output.learning.knowledgeUpdateCandidate) {
    dimensions.push(
      dim("D10b", "Knowledge Update Candidate", "fail", "expected true"),
    );
  }

  // D11 Review Candidate
  if (spec.reviewCandidateExpected === "yes") {
    if (output.reviewCandidate.flag) {
      dimensions.push(dim("D11", "Review Candidate", "pass"));
    } else {
      dimensions.push(
        dim(
          "D11",
          "Review Candidate",
          "critical_fail",
          "Spec requires Review Candidate YES",
        ),
      );
      criticalFailCodes.push("CF_REVIEW_FLAG_REQUIRED_MISSING");
    }
  } else if (spec.reviewCandidateExpected === "no") {
    dimensions.push(
      dim(
        "D11",
        "Review Candidate",
        output.reviewCandidate.flag ? "fail" : "pass",
      ),
    );
  } else {
    dimensions.push(
      dim(
        "D11",
        "Review Candidate",
        output.reviewCandidate.flag && !output.reviewCandidate.monitorOnly
          ? "warning"
          : "pass",
        "NO or MONITOR acceptable",
      ),
    );
  }

  // D12 Brevity
  const execLen = rec.length + president.length + why.length;
  dimensions.push(
    dim(
      "D12",
      "Executive brevity / 30-second usability",
      execLen > EXEC_WARN_CHARS ? "warning" : "pass",
      execLen > EXEC_WARN_CHARS ? `executive length ${execLen}` : undefined,
    ),
  );

  // Gate interaction
  if (!gate.passed) {
    criticalFailCodes.push("CF_UNRESOLVED_CRITICAL_GATE");
    if (output.executive.decisionReadiness === "READY") {
      criticalFailCodes.push("CF_READY_WITH_CRITICAL_GATE");
    }
  }

  return {
    dimensions,
    criticalFailCodes: [...new Set(criticalFailCodes)],
  };
}

/** Full pipeline: Schema → Gate → enforce readiness → Golden eval. */
export function runGoldenLlmEvalPipeline(
  spec: GoldenCaseSpec,
  candidate: unknown,
): GoldenLlmEvalReport {
  const parsed = parseMddStructuredOutput(candidate);
  if (!parsed.success) {
    return {
      goldenId: spec.id,
      overall: "CriticalFail",
      dimensions: [
        dim("D00", "Schema validation", "critical_fail", "Schema v1.0 invalid"),
      ],
      criticalFailCodes: ["CF_SCHEMA_INVALID"],
      qualityGate: {
        passed: false,
        criticalFailures: [],
        warnings: [],
        enforcedReadiness: "NOT_READY",
      },
      schemaValid: false,
      notes: "Failed before Quality Gate / Golden dimensions",
    };
  }

  let output = parsed.data;
  const gate = evaluateQualityGateV1(subjectFromStructuredOutput(output));

  // Enforce readiness on copy
  if (output.executive.decisionReadiness !== gate.enforcedReadiness) {
    output = {
      ...output,
      executive: {
        ...output.executive,
        decisionReadiness: gate.enforcedReadiness,
      },
      qualityGate: {
        passed: gate.passed,
        criticalFailures: gate.criticalFailures,
        warnings: gate.warnings,
        evaluatedAt: gate.evaluatedAt,
      },
    };
  } else {
    output = {
      ...output,
      qualityGate: {
        passed: gate.passed,
        criticalFailures: gate.criticalFailures,
        warnings: gate.warnings,
        evaluatedAt: gate.evaluatedAt,
      },
    };
  }

  const { dimensions, criticalFailCodes } = evaluateGoldenDimensions(
    spec,
    output,
    gate,
  );

  // If candidate originally claimed READY with gate criticals, keep that Critical Fail code
  const originalReadyIllegal =
    parsed.data.executive.decisionReadiness === "READY" && !gate.passed;
  const codes = [...criticalFailCodes];
  if (originalReadyIllegal && !codes.includes("CF_READY_WITH_CRITICAL_GATE")) {
    codes.push("CF_READY_WITH_CRITICAL_GATE");
  }

  const overall = rollup(dimensions, codes, gate.passed);

  return {
    goldenId: spec.id,
    overall,
    dimensions,
    criticalFailCodes: codes,
    qualityGate: {
      passed: gate.passed,
      criticalFailures: gate.criticalFailures,
      warnings: gate.warnings,
      enforcedReadiness: gate.enforcedReadiness,
    },
    schemaValid: true,
  };
}

/** Build Schema v1.0 structured output from Phase-1 heuristic proposal (no LLM). */
export function structuredFromHeuristicProposal(
  proposal: AnalyzeProposal,
  opts?: {
    reviewCandidateFlag?: boolean;
    financeSnapshot?: {
      reportedShipFund?: number;
      pendingExpenses?: number;
      adjustedBalance?: number;
      targetClosing?: number;
      standardCtm?: number;
      recoveryCtm?: number;
      vesselRequiredApprox?: number;
      recommendedCtm?: number;
      companyLiquidityConfirmed?: boolean;
    };
  },
): MddStructuredOutput {
  const b = proposal.brief;
  const reviewFlag =
    opts?.reviewCandidateFlag ?? b.learning.managementReviewCandidate;
  const snap = opts?.financeSnapshot;

  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: proposal.primaryCaseType,
    tags: proposal.tags,
    executive: {
      recommendation: { text: b.recommendation },
      presidentDecision: {
        text: b.presidentDecision,
        requiredNow: !/not required at this stage/i.test(b.presidentDecision),
      },
      decisionReadiness: b.decisionReadiness,
      decisionAuthorities: b.decisionAuthorities.map((a) => ({
        id: a.id,
        roleLabel: a.roleLabel,
        authority: a.authority as MddStructuredOutput["executive"]["decisionAuthorities"][number]["authority"],
        status: a.status,
      })),
      why: { text: b.why },
      nextActions: b.nextActions.map((a) => ({
        id: a.id,
        who: a.owner,
        what: a.text,
        dueOrTrigger: a.dueDate,
        status: a.status === "done" ? "done" : "open",
      })),
    },
    facts: {
      confirmed: b.confirmedFacts.map((f) => ({
        id: f.id,
        text: f.text,
        classification: "confirmed" as const,
      })),
      unverified: b.unverifiedFacts.map((f) => ({
        id: f.id,
        text: f.text,
        classification: "unverified" as const,
      })),
      assumptions: b.assumptions.map((f) => ({
        id: f.id,
        text: f.text,
        classification: "assumption" as const,
        hypothesis: /hypothesis|may indicate|possible/i.test(f.text),
      })),
      missingInformation: b.missingInformation.map((f) => ({
        id: f.id,
        text: f.text,
        who: f.who ?? "Case owner",
        what: f.what ?? f.text,
        evidenceRequired: f.evidenceRequired ?? "Confirmation evidence",
        blocksReadiness: false,
      })),
    },
    risks: b.risks,
    options: b.options.map((o) => ({
      id: o.id,
      title: o.title,
      summary: o.summary,
    })),
    professionalBoundaries: [],
    qualityGate: {
      passed: true,
      criticalFailures: [],
      warnings: [],
      evaluatedAt: new Date().toISOString(),
    },
    reviewCandidate: {
      flag: Boolean(reviewFlag),
      retainAfterClose: Boolean(reviewFlag),
      monitorOnly: false,
    },
    learning: {
      correctiveAction: b.learning.correctiveAction,
      preventiveAction: b.learning.preventiveAction,
      effectivenessVerification: b.learning.effectivenessVerification,
      horizontalCheck: b.learning.horizontalCheck,
      fleetWideRelevance: b.learning.fleetWideRelevance,
      internalAuditCandidate: b.learning.internalAuditCandidate,
      managementReviewCandidate: b.learning.managementReviewCandidate,
      knowledgeUpdateCandidate: b.learning.knowledgeUpdateCandidate,
      notes: b.learning.notes,
    },
  };

  if (proposal.primaryCaseType === "FINANCE_COMMERCIAL" && snap) {
    base.finance = {
      separationPreserved: true,
      doNotAuthorizePayment: true,
      forecastsLabeledAsNonAccounting: true,
      sourceFacts: {
        reportedShipFund: snap.reportedShipFund,
        pendingExpenses: snap.pendingExpenses,
        targetClosing: snap.targetClosing,
        standardCtm: snap.standardCtm,
        recoveryCtm: snap.recoveryCtm,
        companyLiquidityConfirmed: snap.companyLiquidityConfirmed,
      },
      derivedValues: {
        adjustedBalance: snap.adjustedBalance,
        vesselRequiredApprox: snap.vesselRequiredApprox,
        recommendedCtm: snap.recommendedCtm,
      },
      companyFinancialFeasibility: {
        liquidityConfirmed: snap.companyLiquidityConfirmed === true,
        blockingIfUnconfirmed: true,
      },
      vesselOperationalRequirement: snap.vesselRequiredApprox
        ? {
            amount: snap.vesselRequiredApprox,
            currency: "USD",
            label: "Vessel-side requirement",
            origin: "derived",
          }
        : undefined,
    };
  }

  if (proposal.primaryCaseType === "INSPECTION_COMPLIANCE") {
    base.inspectionIsm = {
      rootCauseChallengeRequired: true,
      shallowRootCauseRejected: true,
      horizontalCheckExpected: true,
      effectivenessVerificationExpected: true,
      photoAloneInsufficient: true,
    };
    base.professionalBoundaries = [
      {
        id: "pb_1",
        domain: "Superintendent",
        issue:
          "Do not declare electrical/earth-fault closed from photographs alone.",
        responsibleAuthority: "Superintendent",
      },
    ];
  }

  return base;
}
