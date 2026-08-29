/**
 * Attachment Semantic Analysis v0.2 — bounded heuristic synthesis.
 * Does not auto-confirm attachment facts. Does not modify Gate/Control/Schema.
 * Not Golden-specific and must not hard-code a single vessel case.
 */

import type {
  CaseType,
  DecisionAuthorityItem,
  DecisionReadiness,
  FactItem,
} from "../types";
import type { IntakeAttachmentRecord } from "./types";
import type { CaseFollowUp } from "../types";
import {
  evidenceSearchBlob,
  evidenceSourceLabel,
  normalizeAnalyzeEvidence,
  type AttachmentEvidenceUnit,
} from "./normalize-evidence";

export type CoveredTopic =
  | "equipment_identity"
  | "defect_reported"
  | "contamination"
  | "temporary_measures"
  | "operational_status"
  | "repair_parts"
  | "class_flag_notification"
  | "owner_company_notification"
  | "decision_owner_onboard";

export type AttachmentSemanticSynthesis = {
  units: AttachmentEvidenceUnit[];
  caseTypeHint: CaseType;
  hasMaterialAttachmentText: boolean;
  materialReportedFacts: { text: string; sourceLabel: string }[];
  operationalStatus?: string;
  suspectedCause?: string;
  temporaryMeasures: string[];
  repairPartsStatus?: string;
  contaminationDamage?: string;
  unresolvedTechnicalQuestions: string[];
  notificationStatus?: string;
  managementEscalationTriggers: string[];
  coveredTopics: CoveredTopic[];
  proposedDecisionQuestion: {
    decisionRequiredNow: string;
    expectedDecider: string;
    deferredToExecutionOrClosure: string[];
  };
  recommendation: string;
  presidentDecision: string;
  why: string;
  decisionReadiness: DecisionReadiness;
  decisionAuthorities: Omit<DecisionAuthorityItem, "id">[];
  nextActions: { text: string; owner: string }[];
  missingInformation: Omit<FactItem, "id" | "classification">[];
  suggestedQuestionsToVessel: string[];
  risks: string[];
  delegation: { assignee: string; task: string }[];
  learningNotes: string;
};

function idLessFact(
  text: string,
  extra?: Partial<Omit<FactItem, "id" | "classification" | "text">>,
): Omit<FactItem, "id" | "classification"> {
  return { text, ...extra };
}

function includesAny(blob: string, words: string[]): boolean {
  return words.some((w) => blob.includes(w.toLowerCase()));
}

function inferCaseType(blob: string): CaseType {
  if (
    includesAny(blob, [
      "generator",
      "valve",
      "diesel",
      "engine",
      "defect",
      "trouble report",
      "machinery",
      "fo outlet",
      "vlsfo",
      "contamination",
    ])
  ) {
    return "TECHNICAL";
  }
  if (includesAny(blob, ["psc", "audit", "deficiency", "ism"])) {
    return "INSPECTION_COMPLIANCE";
  }
  if (includesAny(blob, ["ctm", "invoice", "remittance", "ship fund"])) {
    return "FINANCE_COMMERCIAL";
  }
  if (includesAny(blob, ["crew", "manning", "visa"])) {
    return "CREW_MANNING";
  }
  return "OPERATIONAL";
}

function detectCoveredTopics(blob: string): CoveredTopic[] {
  const topics: CoveredTopic[] = [];
  if (
    includesAny(blob, [
      "diesel generator",
      "d/g",
      "dg ",
      "3-way",
      "3 way",
      "fo outlet",
      "valve",
      "equipment",
    ])
  ) {
    topics.push("equipment_identity");
  }
  if (
    includesAny(blob, [
      "defect",
      "defective",
      "failure",
      "trouble",
      "fault",
      "malfunction",
    ])
  ) {
    topics.push("defect_reported");
  }
  if (
    includesAny(blob, [
      "contamination",
      "contaminated",
      "vlsfo",
      "do service",
      "diesel oil",
    ])
  ) {
    topics.push("contamination");
  }
  if (
    includesAny(blob, [
      "temporary",
      "contingency",
      "isolat",
      "blank",
      "bypass",
      "measure",
      "temporary measure",
    ])
  ) {
    topics.push("temporary_measures");
  }
  if (
    includesAny(blob, [
      "available",
      "in operation",
      "stopped",
      "not available",
      "out of service",
      "running",
      "standby",
      "operational status",
    ])
  ) {
    topics.push("operational_status");
  }
  if (
    includesAny(blob, [
      "spare",
      "parts",
      "repair",
      "replace",
      "eta",
      "completion",
      "workshop",
    ])
  ) {
    topics.push("repair_parts");
  }
  if (includesAny(blob, ["class", "classnk", "flag", "statutory"])) {
    topics.push("class_flag_notification");
  }
  if (includesAny(blob, ["owner", "company notified", "shore notified", "dp "])) {
    topics.push("owner_company_notification");
  }
  if (
    includesAny(blob, [
      "chief engineer",
      "c/e",
      "master",
      "superintendent",
      "who owns",
    ])
  ) {
    topics.push("decision_owner_onboard");
  }
  return topics;
}

function pickMaterialLines(
  units: AttachmentEvidenceUnit[],
  max = 16,
): { text: string; sourceLabel: string }[] {
  const out: { text: string; sourceLabel: string }[] = [];
  for (const unit of units) {
    if (unit.verificationStatus !== "reported_unverified") continue;
    if (
      unit.sourceType !== "attachment_sheet" &&
      unit.sourceType !== "attachment_text" &&
      unit.sourceType !== "intake_narrative" &&
      unit.sourceType !== "follow_up"
    ) {
      continue;
    }
    const sourceLabel = evidenceSourceLabel(unit);
    for (const raw of unit.extractedText.split(/\r?\n/)) {
      const line = raw.trim().replace(/^,+|,+$/g, "");
      if (line.length < 4) continue;
      if (line.startsWith("[") && line.endsWith("]")) continue;
      // Prefer informative rows (key,value or sentence-like)
      const useful =
        line.includes(",") ||
        line.length > 24 ||
        /defect|valve|tank|contamin|generat|repair|isolat|status|failure|vlsfo|temporary/i.test(
          line,
        );
      if (!useful) continue;
      const clipped = line.length > 260 ? `${line.slice(0, 260)}…` : line;
      out.push({ text: clipped, sourceLabel });
      if (out.length >= max) return out;
    }
  }
  return out;
}

function inferField(
  blob: string,
  patterns: { when: string[]; value: string }[],
): string | undefined {
  for (const p of patterns) {
    if (includesAny(blob, p.when)) return p.value;
  }
  return undefined;
}

/**
 * Bounded heuristic synthesis from normalized evidence.
 */
export function synthesizeAttachmentSemantics(input: {
  title: string;
  vessel?: string;
  narrative: string;
  attachments: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
  /** Explicit CDQ from user if any (UI/API). */
  explicitDecisionQuestion?: string;
}): AttachmentSemanticSynthesis {
  const units = normalizeAnalyzeEvidence({
    narrative: input.narrative,
    attachments: input.attachments,
    followUps: input.followUps,
  });
  const blob = evidenceSearchBlob(units);
  const titleBlob = `${input.title}\n${input.narrative}`.toLowerCase();
  const fullBlob = `${titleBlob}\n${blob}`;
  const caseTypeHint = inferCaseType(fullBlob);
  const coveredTopics = detectCoveredTopics(fullBlob);
  const hasMaterialAttachmentText = units.some(
    (u) =>
      (u.sourceType === "attachment_sheet" ||
        u.sourceType === "attachment_text") &&
      u.verificationStatus === "reported_unverified" &&
      u.extractedText.trim().length > 0,
  );
  const materialReportedFacts = pickMaterialLines(units);

  const operationalStatus = inferField(fullBlob, [
    {
      when: ["out of service", "not available", "stopped", "unavailable"],
      value:
        "Reported: affected equipment may be out of normal service / availability constrained (unverified).",
    },
    {
      when: ["in operation", "running", "available", "standby"],
      value:
        "Reported: some operational / availability status language is present in evidence (unverified).",
    },
  ]);

  const suspectedCause = inferField(fullBlob, [
    {
      when: ["defective", "defect", "failure", "malfunction", "stuck", "leak"],
      value:
        "Reported defect / failure language is present for the named equipment (cause not auto-confirmed).",
    },
  ]);

  const temporaryMeasures: string[] = [];
  if (coveredTopics.includes("temporary_measures")) {
    temporaryMeasures.push(
      "Evidence mentions temporary / contingency / isolation-type measures (details remain Reported but Unverified).",
    );
  }

  const repairPartsStatus = coveredTopics.includes("repair_parts")
    ? "Evidence mentions repair / parts / completion language (timing and method not auto-confirmed)."
    : undefined;

  const contaminationDamage = coveredTopics.includes("contamination")
    ? "Evidence reports fuel / oil contamination or related tank/system impact (extent not auto-confirmed)."
    : undefined;

  const notificationBits: string[] = [];
  if (coveredTopics.includes("class_flag_notification")) {
    notificationBits.push("Class/Flag language present in evidence");
  }
  if (coveredTopics.includes("owner_company_notification")) {
    notificationBits.push("Owner/company notification language present");
  }
  const notificationStatus =
    notificationBits.length > 0
      ? `${notificationBits.join("; ")} (status not auto-confirmed).`
      : undefined;

  const managementEscalationTriggers: string[] = [];
  if (
    includesAny(fullBlob, [
      "off-hire",
      "delay",
      "stoppage",
      "blackout",
      "cannot sail",
      "operational interruption",
    ])
  ) {
    managementEscalationTriggers.push(
      "Possible operational interruption / vessel utilization impact",
    );
  }
  if (
    includesAny(fullBlob, [
      "significant cost",
      "capital",
      "owner approval",
      "purchase order",
      "usd",
      "cost estimate",
    ])
  ) {
    managementEscalationTriggers.push(
      "Possible significant cost or owner approval requirement",
    );
  }
  if (includesAny(fullBlob, ["management decision", "president", "board"])) {
    managementEscalationTriggers.push(
      "Evidence language suggests company-level management confirmation may be requested",
    );
  }

  const unresolvedTechnicalQuestions: string[] = [];
  if (!coveredTopics.includes("operational_status")) {
    unresolvedTechnicalQuestions.push(
      "Current safe availability / operational status of the affected equipment is not clearly established.",
    );
  }
  if (
    coveredTopics.includes("contamination") &&
    !includesAny(fullBlob, ["extent", "quantity", "cleared", "cleaned", "flushed"])
  ) {
    unresolvedTechnicalQuestions.push(
      "Contamination / damage extent and recovery handling plan need explicit confirmation.",
    );
  }
  if (!coveredTopics.includes("repair_parts")) {
    unresolvedTechnicalQuestions.push(
      "Repair method, parts readiness, and completion timing are not clearly established.",
    );
  }
  if (!coveredTopics.includes("class_flag_notification")) {
    unresolvedTechnicalQuestions.push(
      "Whether Class / Flag notification is required or already done is not established.",
    );
  }
  if (
    coveredTopics.includes("temporary_measures") === false &&
    caseTypeHint === "TECHNICAL"
  ) {
    unresolvedTechnicalQuestions.push(
      "Temporary / contingency measures currently in force are not clearly established.",
    );
  }

  const expectedDecider =
    managementEscalationTriggers.length > 0
      ? "Superintendent first; escalate to President/DP only if escalation triggers below apply"
      : "Chief Engineer / Superintendent (technical); President only if escalation triggers apply";

  const proposedDecisionQuestion = {
    decisionRequiredNow:
      input.explicitDecisionQuestion?.trim() ||
      (caseTypeHint === "TECHNICAL"
        ? "What company-side technical confirmation or management approval is required now regarding continued operation, temporary measures, repair plan, and any shore-side support?"
        : "What decision is required now from shore, who should decide it, and what can wait for execution / closure?"),
    expectedDecider,
    deferredToExecutionOrClosure: [
      "Detailed repair workmanship and onboard execution steps (once method is agreed)",
      "Routine documentation filing after technical confirmation",
      ...(managementEscalationTriggers.length === 0
        ? ["President-level approval unless cost, interruption, or owner confirmation arises"]
        : []),
    ],
  };

  const missingInformation: Omit<FactItem, "id" | "classification">[] = [];
  if (!coveredTopics.includes("operational_status")) {
    missingInformation.push(
      idLessFact(
        "Confirm whether the affected equipment remains safe/available for operation.",
        {
          who: "Chief Engineer / Superintendent",
          what: "Current operational status / test result",
          evidenceRequired: "Technical confirmation from vessel or Superintendent",
        },
      ),
    );
  }
  if (!coveredTopics.includes("temporary_measures") && caseTypeHint === "TECHNICAL") {
    missingInformation.push(
      idLessFact("Confirm temporary isolation / contingency measures in force now.", {
        who: "Chief Engineer",
        what: "Temporary measures currently applied",
        evidenceRequired: "Vessel report or updated trouble-report fields",
      }),
    );
  }
  if (!coveredTopics.includes("repair_parts")) {
    missingInformation.push(
      idLessFact("Confirm repair method, parts status, and expected completion timing.", {
        who: "Superintendent / Chief Engineer",
        what: "Repair plan and parts ETA",
        evidenceRequired: "Repair/parts plan",
      }),
    );
  }
  if (!coveredTopics.includes("class_flag_notification")) {
    missingInformation.push(
      idLessFact(
        "Confirm whether Class / Flag / owner notification is required or already completed.",
        {
          who: "Superintendent / DPA",
          what: "Notification requirement and status",
          evidenceRequired: "Notification record or reasoned N/A",
        },
      ),
    );
  }
  if (managementEscalationTriggers.length > 0) {
    missingInformation.push(
      idLessFact(
        "Confirm whether President/owner approval is required for cost, interruption, or company-level commitment.",
        {
          who: "Superintendent → President/DP",
          what: "Escalation necessity and decision package",
          evidenceRequired: "Cost / impact / owner-requirement summary",
        },
      ),
    );
  }
  if (missingInformation.length === 0 && hasMaterialAttachmentText) {
    missingInformation.push(
      idLessFact(
        "Human verification that attachment-sourced Reported facts match current onboard reality.",
        {
          who: "Superintendent",
          what: "Confirm or correct Reported facts",
          evidenceRequired: "Human review of Brief facts vs vessel",
        },
      ),
    );
  }

  const recommendationLines: string[] = [];
  if (caseTypeHint === "TECHNICAL" && hasMaterialAttachmentText) {
    recommendationLines.push(
      "Superintendent to verify equipment availability and safety for continued operation against the trouble-report evidence.",
    );
    recommendationLines.push(
      coveredTopics.includes("temporary_measures")
        ? "Confirm that temporary isolation / contingency measures described in the report remain in force and adequate."
        : "Confirm temporary isolation / contingency measures currently applied onboard.",
    );
    if (coveredTopics.includes("contamination")) {
      recommendationLines.push(
        "Confirm contamination extent and the fuel / tank handling plan (flushing, segregation, sampling as applicable).",
      );
    }
    recommendationLines.push(
      coveredTopics.includes("repair_parts")
        ? "Confirm repair method, parts readiness, and completion timing stated or implied in the evidence."
        : "Define repair method, parts status, and completion timing.",
    );
    recommendationLines.push(
      coveredTopics.includes("class_flag_notification")
        ? "Confirm Class / Flag / owner notification status already referenced in evidence."
        : "Confirm whether Class / Flag / owner notification is required.",
    );
    recommendationLines.push(
      managementEscalationTriggers.length > 0
        ? `Escalate to President/DP only if: ${managementEscalationTriggers.join("; ")}.`
        : "Escalate to President only if operational interruption, significant cost, owner approval, or company-level confirmation becomes required.",
    );
  } else if (hasMaterialAttachmentText) {
    recommendationLines.push(
      "Review attachment-sourced Reported facts against the email narrative, confirm what is operationally true, and escalate only what requires management confirmation.",
    );
  } else {
    recommendationLines.push(
      "Organize facts, identify missing information, assign decision authorities, and prepare a President Decision only for what requires management confirmation.",
    );
  }

  const established: string[] = [];
  if (hasMaterialAttachmentText) {
    established.push(
      "Attachment text was ingested with sheet/source boundaries and yields material Reported facts.",
    );
  }
  if (coveredTopics.includes("equipment_identity")) {
    established.push("Evidence identifies affected equipment / system (unverified).");
  }
  if (coveredTopics.includes("defect_reported")) {
    established.push("Evidence reports a defect / failure condition (unverified).");
  }
  if (contaminationDamage) {
    established.push(contaminationDamage);
  }
  if (temporaryMeasures.length > 0) {
    established.push(temporaryMeasures[0]!);
  }

  const readiness: DecisionReadiness = "NOT_READY";
  const why = [
    established.length > 0
      ? `Already in evidence (Reported but Unverified): ${established.join(" ")}`
      : "Insufficient structured attachment evidence for a management decision.",
    unresolvedTechnicalQuestions.length > 0
      ? `Still unresolved: ${unresolvedTechnicalQuestions.join(" ")}`
      : "Primary technical unknowns appear addressed in Reported evidence pending human verification.",
    `Readiness is ${readiness} because attachment-sourced facts are not auto-confirmed and remaining confirmations/escalation checks are open.`,
  ].join(" ");

  const presidentDecision =
    managementEscalationTriggers.length === 0
      ? "President Decision: Not required at this stage if Superintendent / vessel can complete technical confirmation and execution. Escalate only if cost, operational interruption, owner approval, or company-level confirmation arises."
      : `President Decision: Possibly required — escalation triggers indicated: ${managementEscalationTriggers.join("; ")}. Superintendent should package impact/cost/owner need before President confirmation.`;

  const decisionAuthorities: Omit<DecisionAuthorityItem, "id">[] = [
    {
      roleLabel: "Technical confirmation / temporary measures / repair plan",
      authority: "Other",
      notes: "Chief Engineer / Superintendent",
      status: "pending",
    },
    {
      roleLabel: "Class / Flag / statutory notification (if required)",
      authority: "Class/Flag",
      status: "pending",
    },
    {
      roleLabel: "Management approval (only if escalation triggers apply)",
      authority: "President/DP",
      status: "pending",
    },
  ];

  const suggestedQuestionsToVessel = buildFilteredQuestions({
    caseType: caseTypeHint,
    coveredTopics,
    fullBlob,
    followUpCount: input.followUps?.length ?? 0,
  });

  const nextActions: { text: string; owner: string }[] = [];
  nextActions.push({
    text: "Superintendent: verify Reported attachment facts against current onboard status (do not treat extraction as confirmed).",
    owner: "Superintendent",
  });
  if (!coveredTopics.includes("operational_status")) {
    nextActions.push({
      text: "Confirm safe availability of affected equipment for continued operation.",
      owner: "Chief Engineer / Superintendent",
    });
  }
  if (coveredTopics.includes("contamination")) {
    nextActions.push({
      text: "Confirm contamination extent and fuel/tank handling plan.",
      owner: "Chief Engineer / Superintendent",
    });
  }
  if (!coveredTopics.includes("class_flag_notification")) {
    nextActions.push({
      text: "Decide and record Class / Flag / owner notification requirement.",
      owner: "Superintendent / DPA",
    });
  }
  if (suggestedQuestionsToVessel.length > 0) {
    nextActions.push({
      text: "Send only the remaining Suggested Questions to vessel/shore (skip items already answered in attachments), then register replies as Follow-up.",
      owner: "Case owner",
    });
  } else {
    nextActions.push({
      text: "No major vessel questions remain from the standard checklist — close open Missing Information via Superintendent confirmation and re-analyze if needed.",
      owner: "Case owner",
    });
  }
  if (managementEscalationTriggers.length > 0) {
    nextActions.push({
      text: "If escalation triggers remain after technical check, prepare a concise President package (impact / cost / owner need).",
      owner: "Superintendent",
    });
  }

  return {
    units,
    caseTypeHint,
    hasMaterialAttachmentText,
    materialReportedFacts,
    operationalStatus,
    suspectedCause,
    temporaryMeasures,
    repairPartsStatus,
    contaminationDamage,
    unresolvedTechnicalQuestions,
    notificationStatus,
    managementEscalationTriggers,
    coveredTopics,
    proposedDecisionQuestion,
    recommendation: recommendationLines.join(" "),
    presidentDecision,
    why,
    decisionReadiness: readiness,
    decisionAuthorities,
    nextActions,
    missingInformation,
    suggestedQuestionsToVessel,
    risks: [
      "Treating attachment extraction as confirmed fact without human review",
      "Silently reconciling conflicts between email narrative and attachments",
      ...(managementEscalationTriggers.length > 0
        ? ["Delayed escalation when cost / interruption / owner approval is actually required"]
        : ["Unnecessary President escalation for a pure technical execution matter"]),
    ],
    delegation: [
      {
        assignee: "Superintendent",
        task: "Own technical verification, shore support, and escalation gate to President.",
      },
      {
        assignee: "Chief Engineer",
        task: "Confirm operational status, temporary measures, and repair execution facts.",
      },
    ],
    learningNotes: hasMaterialAttachmentText
      ? `Attachment Semantic Analysis v0.2 applied (${units.length} evidence units; topics: ${coveredTopics.join(", ") || "none"}). Facts remain Reported but Unverified. Embedded image vision deferred.`
      : "No material attachment text for semantic synthesis.",
  };
}

function buildFilteredQuestions(input: {
  caseType: CaseType;
  coveredTopics: CoveredTopic[];
  fullBlob: string;
  followUpCount: number;
}): string[] {
  const covered = new Set(input.coveredTopics);
  const qs: string[] = [];

  if (input.caseType === "TECHNICAL") {
    if (!covered.has("operational_status")) {
      qs.push(
        "Is the affected equipment currently usable / available for operation?",
      );
    }
    if (!covered.has("temporary_measures")) {
      qs.push("What temporary / contingency measures are in place onboard now?");
    }
    if (!covered.has("repair_parts")) {
      qs.push("What is the estimated parts / repair completion timing?");
    }
  }

  if (
    covered.has("contamination") ||
    includesAny(input.fullBlob, ["valve", "generator", "diesel", "vlsfo"])
  ) {
    // Ask extent only if not already described with extent-like language
    if (
      !includesAny(input.fullBlob, [
        "extent",
        "quantity",
        "litre",
        "liter",
        "cleared",
        "cleaned",
        "flushed",
        "sampled",
      ])
    ) {
      qs.push(
        "Please confirm contamination extent and whether DO service tank / FO system isolation is complete.",
      );
    }
    if (!covered.has("class_flag_notification")) {
      qs.push(
        "What Class / company notifications (if any) have already been made?",
      );
    }
  }

  if (input.caseType === "CREW_MANNING" && !covered.has("decision_owner_onboard")) {
    qs.push("What is the latest embarkation / document readiness status?");
  }
  if (input.caseType === "FINANCE_COMMERCIAL") {
    qs.push(
      "Please confirm latest Ship Fund / pending expense figures and as-of date.",
    );
  }

  if (input.followUpCount === 0 && !covered.has("decision_owner_onboard")) {
    qs.push(
      "Who onboard owns this issue now (Master / C/E / other), and what decision do you need from shore?",
    );
  } else if (input.followUpCount > 0) {
    qs.push(
      "Please confirm any remaining open points after the latest follow-up (list unknowns only).",
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of qs) {
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}
