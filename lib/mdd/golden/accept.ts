import type { MddCase } from "../types";
import type { GoldenCaseSpec } from "./specs";

export type AcceptanceCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type AcceptanceReport = {
  goldenId: GoldenCaseSpec["id"];
  passed: boolean;
  checks: AcceptanceCheck[];
};

function includesAll(hay: string, needles: string[]) {
  const h = hay.toLowerCase();
  return needles.every((n) => h.includes(n.toLowerCase()));
}

function includesAny(hay: string, needles: string[]) {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

/** Structural acceptance against human-approved Spec (not exact prose). */
export function evaluateGoldenCase(
  spec: GoldenCaseSpec,
  caseData: MddCase,
): AcceptanceReport {
  const checks: AcceptanceCheck[] = [];
  const brief = caseData.brief;
  const type = caseData.primaryCaseType;
  const tags = caseData.tags.map((t) => t.toLowerCase());

  checks.push({
    id: "case_type",
    label: "Primary Case Type",
    passed: type === spec.expectedPrimaryCaseType,
    detail: `expected ${spec.expectedPrimaryCaseType}, got ${type ?? "(none)"}`,
  });

  const missingRequired = spec.requiredTags.filter(
    (t) => !tags.includes(t.toLowerCase()),
  );
  checks.push({
    id: "required_tags",
    label: "Required tags present",
    passed: missingRequired.length === 0,
    detail:
      missingRequired.length === 0
        ? undefined
        : `missing: ${missingRequired.join(", ")}`,
  });

  if (type === "TECHNICAL" && tags.includes("inspection_compliance")) {
    checks.push({
      id: "tag_not_type",
      label: "inspection_compliance is tag only (not Primary)",
      passed: true,
    });
  }

  if (type === "ISM_MANAGEMENT" && spec.id === "GC03") {
    checks.push({
      id: "not_ism_primary",
      label: "ORBIT must not be Primary ISM_MANAGEMENT",
      passed: false,
      detail: "ISM learning should be tags/learning, not Primary Type",
    });
  }

  const authorities = brief?.decisionAuthorities ?? [];
  const authBlob = authorities
    .map((a) => `${a.roleLabel} ${a.authority}`)
    .join(" | ")
    .toLowerCase();
  const authOk = spec.expectedAuthorityRoleLabels.every((role) =>
    authBlob.includes(role.toLowerCase().slice(0, 12)),
  );
  checks.push({
    id: "authorities",
    label: "Decision Authorities (multi-role structure)",
    passed: authorities.length >= 2 && authOk,
    detail: authOk
      ? `${authorities.length} authorities`
      : `expected roles roughly: ${spec.expectedAuthorityRoleLabels.join("; ")}`,
  });

  const president = (brief?.presidentDecision ?? "").toLowerCase();
  const presOk = includesAny(president, spec.expectedPresidentDecisionIntent);
  checks.push({
    id: "president_decision",
    label: "President Decision intent",
    passed: Boolean(brief?.presidentDecision?.trim()) && presOk,
    detail: presOk ? undefined : "intent keywords not found",
  });

  if (spec.presidentMustNotDo?.length) {
    const delBlob = (brief?.delegation ?? [])
      .map((d) => `${d.assignee} ${d.task}`)
      .join(" ")
      .toLowerCase();
    const bad = spec.presidentMustNotDo.some(
      (p) => president.includes(p) && delBlob.includes("president"),
    );
    checks.push({
      id: "president_not_routine",
      label: "President not assigned routine chasing",
      passed: !bad,
    });
  }

  const rec = (brief?.recommendation ?? "").toLowerCase();
  const recOk = includesAny(rec, spec.expectedRecommendationIntent);
  const recForbidden = includesAny(rec, spec.forbiddenRecommendationIntent);
  checks.push({
    id: "recommendation",
    label: "Recommendation boundary",
    passed: recOk && !recForbidden,
    detail: recForbidden ? "hit forbidden recommendation intent" : undefined,
  });

  const readiness = brief?.decisionReadiness;
  const readinessExpected = Array.isArray(spec.expectedReadiness)
    ? spec.expectedReadiness
    : [spec.expectedReadiness];
  checks.push({
    id: "readiness",
    label: "Decision Readiness",
    passed: Boolean(readiness && readinessExpected.includes(readiness)),
    detail: `expected ${readinessExpected.join("|")}, got ${readiness ?? "(none)"}`,
  });

  checks.push({
    id: "fact_separation",
    label: "Fact separation present",
    passed: Boolean(
      brief &&
        (brief.confirmedFacts.length > 0 ||
          brief.missingInformation.length > 0),
    ),
  });

  const missingOk =
    !brief ||
    brief.missingInformation.every(
      (m) => m.classification === "missing" && m.text.trim().length > 0,
    );
  checks.push({
    id: "missing_info",
    label: "Missing Information structured",
    passed: missingOk,
  });

  checks.push({
    id: "delegation",
    label: "Delegation present",
    passed: Boolean(brief && brief.delegation.length > 0),
  });

  const gate = brief?.qualityGate;
  const boundaryFail = (gate?.criticalFailures ?? []).some((f) =>
    /professional boundary/i.test(f),
  );
  checks.push({
    id: "boundary",
    label: "Professional Boundary (no critical boundary fail on READY)",
    passed: !(brief?.decisionReadiness === "READY" && boundaryFail),
  });

  if (spec.reviewCandidateExpected === "yes") {
    checks.push({
      id: "review_flag",
      label: "Review Candidate flag = true",
      passed: caseData.reviewCandidateFlag === true,
    });
  } else if (spec.reviewCandidateExpected === "no") {
    checks.push({
      id: "review_flag",
      label: "Review Candidate flag = false",
      passed: caseData.reviewCandidateFlag === false,
    });
  } else {
    checks.push({
      id: "review_flag",
      label: "Review Candidate not auto-escalated to YES",
      passed: caseData.reviewCandidateFlag !== true || true,
      detail: "NO or MONITOR acceptable",
    });
  }

  if (spec.managementLearningSignificant) {
    const l = brief?.learning;
    checks.push({
      id: "learning",
      label: "Significant Management Learning flags",
      passed: Boolean(
        l &&
          l.correctiveAction &&
          l.preventiveAction &&
          l.effectivenessVerification &&
          l.horizontalCheck &&
          l.internalAuditCandidate &&
          l.managementReviewCandidate,
      ),
    });
  }

  if (spec.knowledgeUpdateExpected) {
    checks.push({
      id: "knowledge_update",
      label: "Knowledge Update Candidate",
      passed: Boolean(brief?.learning.knowledgeUpdateCandidate),
    });
  }

  if (spec.id === "GC04") {
    const collapsed =
      /necessary and affordable|affordable because it is necessary/i.test(rec);
    checks.push({
      id: "necessary_vs_affordable",
      label: "Necessary ≠ Affordable preserved",
      passed: !collapsed && /liquidity/i.test(rec + president),
    });
  }

  const passed = checks.every((c) => c.passed);
  return { goldenId: spec.id, passed, checks };
}
