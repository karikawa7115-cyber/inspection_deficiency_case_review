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
      ? "まず Technical Superintendent。Escalation条件に該当する場合のみ President/DP"
      : "本船 C/E・Master および Technical Superintendent（技術）。Escalation条件が無い限り President は不要";

  const proposedDecisionQuestion = {
    decisionRequiredNow:
      input.explicitDecisionQuestion?.trim() ||
      (caseTypeHint === "TECHNICAL"
        ? "継続運転の可否、一時措置の妥当性、修理計画、岸側支援について、いま会社側で必要な技術確認または経営承認は何か？"
        : "いま岸側で決めるべきことは何か。誰が決め、何を実行・クローズに委ねるか？"),
    expectedDecider,
    deferredToExecutionOrClosure: [
      "修理方法合意後の詳細施工・本船実施手順",
      "技術確認後の定型書類整理",
      ...(managementEscalationTriggers.length === 0
        ? ["費用・運航停止・Owner承認が無い限りの President 承認"]
        : []),
    ],
  };

  const missingInformation: Omit<FactItem, "id" | "classification">[] = [];
  if (!coveredTopics.includes("operational_status")) {
    missingInformation.push(
      idLessFact("対象機器の現在の安全な使用可否を確認する。", {
        who: "C/E / Technical Superintendent",
        what: "現在の運航・使用可否 / 試験結果",
        evidenceRequired: "本船または Superintendent の技術確認",
      }),
    );
  }
  if (!coveredTopics.includes("temporary_measures") && caseTypeHint === "TECHNICAL") {
    missingInformation.push(
      idLessFact("現在実施中の一時隔離・応急措置を確認する。", {
        who: "C/E",
        what: "実施中の一時措置",
        evidenceRequired: "本船報告または Trouble Report 更新欄",
      }),
    );
  }
  if (!coveredTopics.includes("repair_parts")) {
    missingInformation.push(
      idLessFact("修理方法・部品状況・完了見込みを確認する。", {
        who: "Technical Superintendent / C/E",
        what: "修理計画と部品 ETA",
        evidenceRequired: "修理・部品計画",
      }),
    );
  }
  if (!coveredTopics.includes("class_flag_notification")) {
    missingInformation.push(
      idLessFact("Class / Flag / Owner への通知要否と実施状況を確認する。", {
        who: "Technical Superintendent / DPA",
        what: "通知要否と実施状況",
        evidenceRequired: "通知記録または不要である理由",
      }),
    );
  }
  if (managementEscalationTriggers.length > 0) {
    missingInformation.push(
      idLessFact(
        "費用・運航影響・Owner承認など、President/Owner 承認が必要かを確認する。",
        {
          who: "Technical Superintendent → President/DP",
          what: "Escalation 要否と判断材料",
          evidenceRequired: "費用 / 影響 / Owner要件の要約",
        },
      ),
    );
  }
  if (missingInformation.length === 0 && hasMaterialAttachmentText) {
    missingInformation.push(
      idLessFact(
        "添付由来の Reported 事実が、現在の本船実態と一致するか人確認する。",
        {
          who: "Technical Superintendent",
          what: "Reported 事実の確認または訂正",
          evidenceRequired: "Brief 事実と本船状況の突合",
        },
      ),
    );
  }

  const recommendationLines: string[] = [];
  if (caseTypeHint === "TECHNICAL" && hasMaterialAttachmentText) {
    recommendationLines.push(
      "Technical Superintendentが、Trouble Reportに照らして対象機器の現在の使用可否と継続運転の安全性を確認する。",
    );
    recommendationLines.push(
      coveredTopics.includes("temporary_measures")
        ? "報告済みの一時隔離・応急措置が、いまも有効で十分かを確認する。"
        : "本船で実施中の一時隔離・応急措置を確認する。",
    );
    if (coveredTopics.includes("contamination")) {
      recommendationLines.push(
        "燃料混入の範囲と、燃料／タンク処置（必要に応じフラッシング・分離・サンプリング）を確認する。",
      );
    }
    recommendationLines.push(
      coveredTopics.includes("repair_parts")
        ? "証拠に示された修理方法・部品準備・完了時期を確認する。"
        : "修理方法・部品状況・完了時期を定める。",
    );
    recommendationLines.push(
      coveredTopics.includes("class_flag_notification")
        ? "証拠に言及のある Class / Flag / Owner 通知の要否と実施状況を確認する。"
        : "Class / Flag / Owner への通知要否を判断する。",
    );
    recommendationLines.push(
      managementEscalationTriggers.length > 0
        ? `次の場合のみ President/DP へ Escalate する：${managementEscalationTriggers.join("；")}。`
        : "運航停止、大きな費用、Owner承認、会社レベルの判断が必要な場合のみ President/DP へ Escalate する。",
    );
  } else if (hasMaterialAttachmentText) {
    recommendationLines.push(
      "添付由来の Reported 事実をメール本文と突合し、運航上の事実を確認したうえで、経営判断が必要な事項だけ Escalate する。",
    );
  } else {
    recommendationLines.push(
      "事実を整理し、不足情報を特定し、判断権限を割り当てる。経営確認が必要な事項に限って President Decision を準備する。",
    );
  }

  const established: string[] = [];
  if (hasMaterialAttachmentText) {
    established.push(
      "添付テキストをシート／出典境界付きで取り込み、判断材料となる Reported 事実が得られている",
    );
  }
  if (coveredTopics.includes("equipment_identity")) {
    established.push("対象機器・系統が証拠上特定されている（未検証）");
  }
  if (coveredTopics.includes("defect_reported")) {
    established.push("不具合／故障の報告がある（未検証）");
  }
  if (contaminationDamage) {
    established.push(
      "燃料／油の混入またはタンク・系統への影響が報告されている（範囲は未確定）",
    );
  }
  if (temporaryMeasures.length > 0) {
    established.push(
      "一時措置・隔離・応急対応の記載がある（詳細は Reported のまま）",
    );
  }

  // Pre-Gate proposal: CONDITIONAL when material attachment evidence exists.
  // Final badge/text ownership remains Quality Gate (applyGateToBrief).
  const readiness: DecisionReadiness = hasMaterialAttachmentText
    ? "CONDITIONAL"
    : "NOT_READY";

  const whyParts: string[] = [];
  if (established.length > 0) {
    whyParts.push(`添付等から把握できている点：${established.join("。")}。`);
  } else {
    whyParts.push("経営判断に足る添付証拠が不足している。");
  }
  if (unresolvedTechnicalQuestions.length > 0) {
    whyParts.push(
      `未確認の点：${unresolvedTechnicalQuestions
        .map((q) =>
          q
            .replace(
              "Current safe availability / operational status of the affected equipment is not clearly established.",
              "対象機器の現在の安全な使用可否が明確でない",
            )
            .replace(
              "Contamination / damage extent and recovery handling plan need explicit confirmation.",
              "混入・損傷の範囲と燃料処置計画の明示確認が必要",
            )
            .replace(
              "Repair method, parts readiness, and completion timing are not clearly established.",
              "修理方法・部品・完了時期が明確でない",
            )
            .replace(
              "Whether Class / Flag notification is required or already done is not established.",
              "Class / Flag 通知の要否または実施状況が未確定",
            )
            .replace(
              "Temporary / contingency measures currently in force are not clearly established.",
              "現在の一時措置・応急対応が明確でない",
            ),
        )
        .join("。")}。`,
    );
  } else {
    whyParts.push(
      "主要な技術論点は Reported 証拠上おおむね揃っており、人による確認待ちである。",
    );
  }
  // Do not embed a final readiness verdict here — Gate owns the last word.
  const why = whyParts.join("");

  const presidentDecision =
    managementEscalationTriggers.length === 0
      ? "社長判断：現時点では不要（Technical Superintendent / 本船で技術確認と実施が可能な場合）。費用・運航停止・Owner承認・会社レベルの確認が必要になった場合のみ Escalate する。"
      : `社長判断：必要になる可能性あり — Escalation 兆候：${managementEscalationTriggers.join("；")}。Technical Superintendent が影響・費用・Owner要件を整理してから President 確認に上げる。`;

  const decisionAuthorities: Omit<DecisionAuthorityItem, "id">[] =
    caseTypeHint === "TECHNICAL"
      ? [
          {
            roleLabel: "技術状況の評価・一時技術措置・修理実施",
            authority: "C/E",
            notes: "Chief Engineer（機関・設備の技術判断と実施）",
            status: "pending",
          },
          {
            roleLabel: "本船運航・安全の統括確認",
            authority: "Master",
            notes: "運航継続可否・本船安全の最終統括",
            status: "pending",
          },
          {
            roleLabel: "岸側の技術確認・修理調整・部品・技術フォロー",
            authority: "Superintendent",
            notes: "Technical Superintendent",
            status: "pending",
          },
          {
            roleLabel: "Class / 法定の通知・受理（要否判断含む）",
            authority: "Class",
            notes: "必要時は Flag Administration も検討",
            status: "pending",
          },
          {
            roleLabel: "経営承認（Escalation 条件に該当する場合のみ）",
            authority: "President/DP",
            status:
              managementEscalationTriggers.length > 0 ? "pending" : "not_required",
            notes:
              managementEscalationTriggers.length > 0
                ? managementEscalationTriggers.join("；")
                : "費用・運航停止・Owner承認等が無い限り不要",
          },
        ]
      : [
          {
            roleLabel: "案件調整・事実確認",
            authority: "Superintendent",
            status: "pending",
          },
          {
            roleLabel: "経営確認（必要な場合のみ）",
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
    text: "Technical Superintendent：添付の Reported 事実を現在の本船状況と突合する（抽出＝確定としない）。",
    owner: "Superintendent",
  });
  if (!coveredTopics.includes("operational_status")) {
    nextActions.push({
      text: "対象機器の継続運転に対する安全な使用可否を確認する。",
      owner: "C/E / Superintendent",
    });
  } else if (coveredTopics.includes("temporary_measures")) {
    nextActions.push({
      text: "一時措置後の対象機器の現在の使用可否を確認する。",
      owner: "C/E / Superintendent",
    });
  }
  if (
    coveredTopics.includes("contamination") &&
    !includesAny(fullBlob, [
      "extent",
      "quantity",
      "cleared",
      "cleaned",
      "flushed",
      "sampled",
    ])
  ) {
    nextActions.push({
      text: "混入範囲と燃料／タンク処置の現状を確認する。",
      owner: "C/E / Superintendent",
    });
  }
  if (!coveredTopics.includes("class_flag_notification")) {
    nextActions.push({
      text: "Class / Flag / Owner 通知の要否を判断し記録する。",
      owner: "Superintendent / DPA",
    });
  }
  if (suggestedQuestionsToVessel.length > 0) {
    nextActions.push({
      text: "本船への確認事項のうち未解決分のみ送付し、返信は追加情報として登録する。",
      owner: "Case owner",
    });
  } else {
    nextActions.push({
      text: "定型の本船質問は残っていない。不足情報は Superintendent 確認で埋め、必要なら再解析する。",
      owner: "Case owner",
    });
  }
  if (managementEscalationTriggers.length > 0) {
    nextActions.push({
      text: "技術確認後も Escalation 条件が残る場合、President 向けに影響・費用・Owner要件を短く整理する。",
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
    recommendation: recommendationLines.join(""),
    presidentDecision,
    why,
    decisionReadiness: readiness,
    decisionAuthorities,
    nextActions,
    missingInformation,
    suggestedQuestionsToVessel,
    risks: [
      "添付抽出を人確認なしに確定事実として扱うこと",
      "メールと添付の矛盾を黙って解消すること",
      ...(managementEscalationTriggers.length > 0
        ? ["費用・運航停止・Owner承認が必要なのに Escalate が遅れること"]
        : ["純粋な技術実施案件に不要な President Escalate を行うこと"]),
    ],
    delegation: [
      {
        assignee: "Technical Superintendent",
        task: "技術確認、岸側調整、President への Escalate 判断を担う。",
      },
      {
        assignee: "C/E",
        task: "運航状況・一時措置・修理実施の事実を確認する。",
      },
    ],
    learningNotes: hasMaterialAttachmentText
      ? `Attachment Semantic Analysis v0.2（証拠単位 ${units.length}、topics: ${coveredTopics.join(", ") || "none"}）。事実は Reported but Unverified。埋め込み画像の vision は deferred。`
      : "意味合成に足る添付テキストなし。",
  };
}

function questionAlreadyAnswered(question: string, blob: string): boolean {
  const q = question.toLowerCase();
  // Do not suppress "current availability after temporary measures" style follow-ups.
  const asksCurrentAvailability = /使用可否|available|availability|現在の/.test(
    q,
  );

  if (
    !asksCurrentAvailability &&
    /一時措置|temporary|contingency/.test(q) &&
    includesAny(blob, ["temporary", "contingency", "isolat", "一時"])
  ) {
    return true;
  }
  if (
    /混入範囲|contaminat.*extent|extent.*contaminat|隔離完了/.test(q) &&
    includesAny(blob, ["contamination", "contaminated", "vlsfo", "混入"]) &&
    includesAny(blob, ["tank", "isolat", "service tank", "タンク", "隔離"])
  ) {
    return true;
  }
  if (
    /^(?=.*原因)(?!.*確認).*$|what.*cause|suspected cause/.test(q) &&
    includesAny(blob, ["defect", "defective", "failure", "cause", "不具合"])
  ) {
    return true;
  }
  if (
    /修理完了|parts \/ repair|estimated parts/.test(q) &&
    includesAny(blob, ["spare", "parts", "repair", "eta", "completion", "修理"])
  ) {
    return true;
  }
  if (
    /class \/ 会社への通知|class \/ company notifications/.test(q) &&
    includesAny(blob, ["class", "classnk", "flag", "notified", "notification"])
  ) {
    return true;
  }
  return false;
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
      qs.push("対象機器は現在、運航・使用可能な状態か？");
    } else if (covered.has("temporary_measures")) {
      // Evidence already describes measures — ask current post-measure status only.
      qs.push("一時措置後の対象機器の現在の使用可否を確認してください。");
    }
    if (!covered.has("temporary_measures")) {
      qs.push("現在、本船で実施中の一時措置・応急対応は何か？");
    }
    if (!covered.has("repair_parts")) {
      qs.push("部品手配と修理完了の見込み時期は？");
    }
  }

  if (
    covered.has("contamination") ||
    includesAny(input.fullBlob, ["valve", "generator", "diesel", "vlsfo"])
  ) {
    // Do not re-ask contamination/isolation if already materially present.
    const contaminationAnswered =
      covered.has("contamination") &&
      includesAny(input.fullBlob, [
        "tank",
        "service tank",
        "isolat",
        "contaminat",
        "vlsfo",
      ]);
    if (!contaminationAnswered) {
      qs.push(
        "混入の範囲と、DOサービスタンク／FO系統の隔離完了状況を確認してください。",
      );
    }
    if (!covered.has("class_flag_notification")) {
      qs.push("Class / 会社への通知は、すでに実施済みか（実施内容含む）？");
    }
  }

  if (input.caseType === "CREW_MANNING" && !covered.has("decision_owner_onboard")) {
    qs.push("最新の乗船・書類準備状況は？");
  }
  if (input.caseType === "FINANCE_COMMERCIAL") {
    qs.push("Ship Fund / 未払費用の最新値と基準日を確認してください。");
  }

  if (input.followUpCount === 0 && !covered.has("decision_owner_onboard")) {
    qs.push(
      "本船で本件を主担当しているのは誰か（Master / C/E / 他）。岸側に求める判断は何か？",
    );
  } else if (input.followUpCount > 0) {
    qs.push("最新の追加情報のあと、未解決点だけを列挙してください。");
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of qs) {
    if (questionAlreadyAnswered(q, input.fullBlob)) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}
