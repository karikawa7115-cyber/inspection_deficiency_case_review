import { type Deficiency, type FollowUpTab } from "@/lib/inspection/schema";

export type FollowUpDraftContext = {
  vesselName: string;
  inspectionLabel: string;
};

function formatQuestions(questions: string[]): string {
  if (questions.length === 0) {
    return "(No review questions generated for this deficiency.)";
  }
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function formatAlerts(deficiency: Deficiency): string {
  if (deficiency.reviewAlerts.length === 0) {
    return "No AI review alerts for this deficiency.";
  }
  return deficiency.reviewAlerts.map((a) => `- ${a.message}`).join("\n");
}

function buildReviewComment(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  const no = String(deficiency.number).padStart(2, "0");
  return [
    `[Internal] ${context.vesselName} · ${context.inspectionLabel}`,
    `Deficiency No.${no} · Code ${deficiency.code}`,
    "",
    "Supervisor notes:",
    formatAlerts(deficiency),
    "",
    "Vessel CR-5 cause:",
    deficiency.cr5RootCause?.trim() || "—",
    "",
    "Next step: finalize vessel revision EN and handover after master response.",
  ].join("\n");
}

function buildVesselRevisionEn(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  const no = String(deficiency.number).padStart(2, "0");
  return [
    `To: Master, M/V ${context.vesselName}`,
    `Re: PSC deficiency No.${no} (Code ${deficiency.code}) — revision request`,
    "",
    "Dear Master,",
    "",
    "Thank you for your CR-5/CR-6 report. Before we close this item, please revise your response to address the points below.",
    "",
    "Questions:",
    formatQuestions(deficiency.reviewQuestions),
    "",
    "Please include: responsible rank, inspection frequency, record format, and master verification for preventive measures.",
    "",
    "Regards,",
    "Technical Superintendent (draft — supervisor approve before send)",
  ].join("\n");
}

function buildHandoverNote(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  const no = String(deficiency.number).padStart(2, "0");
  return [
    `Handover — ${context.vesselName} · Deficiency No.${no} (${deficiency.code})`,
    "",
    "Situation:",
    deficiency.description,
    "",
    "Root cause (vessel report):",
    deficiency.cr5RootCause?.trim() || "—",
    "",
    "On-board actions to maintain:",
    "- Assign responsible rank per SMS for periodic checks",
    "- Record in planned maintenance / fire-fighting checklist as applicable",
    "- Master to verify closure at next crew change briefing",
    "",
    "Company follow-up: include in next internal audit sample if repeated on sister vessels.",
  ].join("\n");
}

function buildTrainingPoint(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  return [
    `Training point — ${context.vesselName}`,
    `Topic: Deficiency ${deficiency.code} — ${deficiency.description}`,
    "",
    "Objective:",
    "Ensure crew can explain why the deficiency occurred and how SMS records prevent recurrence.",
    "",
    "Discussion prompts:",
    formatQuestions(deficiency.reviewQuestions),
    "",
    "Evidence to retain: signed drill or toolbox meeting sheet referencing SMS procedure.",
  ].join("\n");
}

function buildOwnerSummaryJp(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  const no = String(deficiency.number).padStart(2, "0");
  return [
    `【船主向け要約】${context.vesselName} / ${context.inspectionLabel}`,
    "",
    `指摘 No.${no}（コード ${deficiency.code}）`,
    deficiency.description,
    "",
    "本船報告の要点:",
    deficiency.cr5RootCause?.trim() || "—",
    "",
    "管理会社対応:",
    "原因の具体化と再発防止（担当・頻度・記録）について本船へ修正依頼を送付予定。引き継ぎノートおよび内部監査チェックリストへ反映予定。",
    "",
    "（ドラフト — 監督確認後に船主送付）",
  ].join("\n");
}

function buildInternalAuditChecklist(
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  return [
    `Internal Audit Checklist — add / update proposal`,
    `Vessel: ${context.vesselName}`,
    "",
    `[ ] Verify periodic inspection records for Code ${deficiency.code} related equipment`,
    `[ ] Confirm responsible rank documented in SMS job description`,
    `[ ] Sample last 3 months maintenance / inspection entries`,
    `[ ] Confirm master verification signature on closure record`,
    `[ ] If repeated deficiency: review fleet-wide bulletin need`,
    "",
    "Rationale:",
    formatAlerts(deficiency),
    "",
    "Decision: Add / Update / No change (supervisor + DP approve)",
  ].join("\n");
}

const DRAFT_BUILDERS: Record<
  FollowUpTab,
  (deficiency: Deficiency, context: FollowUpDraftContext) => string
> = {
  review_comment: buildReviewComment,
  vessel_revision_en: buildVesselRevisionEn,
  handover_note: buildHandoverNote,
  training_point: buildTrainingPoint,
  owner_summary_jp: buildOwnerSummaryJp,
  internal_audit_checklist: buildInternalAuditChecklist,
};

/** P4 タブのドラフト本文を生成（reviewOutputs 未設定時の SSoT）。 */
export function buildFollowUpDraft(
  tab: FollowUpTab,
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  return DRAFT_BUILDERS[tab](deficiency, context);
}

/** 保存済み reviewOutputs があれば優先、なければドラフト生成。 */
export function resolveFollowUpContent(
  tab: FollowUpTab,
  deficiency: Deficiency,
  context: FollowUpDraftContext,
): string {
  const saved = deficiency.reviewOutputs?.find((output) => output.tab === tab);
  if (saved) {
    return saved.content;
  }
  return buildFollowUpDraft(tab, deficiency, context);
}

/** タブの承認状態（保存済みがなければ draft）。 */
export function resolveFollowUpStatus(
  tab: FollowUpTab,
  deficiency: Deficiency,
) {
  const saved = deficiency.reviewOutputs?.find((output) => output.tab === tab);
  return saved?.status ?? "draft";
}

/** タブの承認ログ（保存済みがなければ空）。 */
export function resolveFollowUpApprovals(
  tab: FollowUpTab,
  deficiency: Deficiency,
) {
  const saved = deficiency.reviewOutputs?.find((output) => output.tab === tab);
  return saved?.approvals ?? [];
}
