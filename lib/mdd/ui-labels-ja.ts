/**
 * Japanese-first display labels for MDD UI.
 * Canonical enums / schema keys remain English in code and storage.
 */

import type {
  CaseStatus,
  CaseType,
  DecisionReadiness,
} from "./types";
import type { ExtractionStatus } from "./attachments/types";

export const MDD_UI = {
  caseIntake: "案件入力",
  caseIntakeEn: "Case Intake",
  caseIntakeHelp:
    "左パネル全体が案件入力です。タイトルと船名を入れ、メール・報告内容を入力し、必要なら添付資料を追加してから右上の「解析」を押してください。",
  title: "タイトル",
  vessel: "船名",
  narrative: "メール・報告内容",
  narrativePlaceholder: "本船メール / 報告文を貼り付け…",
  attachments: "添付資料",
  attachmentsHelp:
    "ドラッグ＆ドロップまたはファイル選択。元ファイルはこのブラウザセッションのみ保持されます。再読み込み後は必要に応じて再添付してください（抽出テキストは保存されます）。添付リストは解析後も残ります。",
  browseFiles: "ファイルを選択",
  dropHint: "ここにファイルをドロップ、または選択",
  dropFormats: "PDF, DOCX, XLSX/XLS, CSV, TXT/MD, JPG/PNG/WEBP",
  inspectExtracted: "抽出内容を確認",
  extractionDetails: "抽出の詳細",
  sheets: "シート",
  charsExtracted: "文字を抽出",
  followUpThread: "追加情報スレッド",
  followUpHelp:
    "同一案件に本船・岸側の返信を追加し、「再解析」してください。作成者ラベルは任意。添付は追加情報ごとに可能です。",
  followUpEmpty:
    "まだ追加情報がありません。解析後、次の返信をここに貼って継続できます。",
  addFollowUp: "追加情報を登録",
  followUpAttachments: "追加情報の添付",
  analyze: "解析",
  reanalyze: "再解析",
  analyzing: "解析中…",
  closeCase: "案件を完了",
  backCases: "← 案件一覧",
  decisionBrief: "判断ブリーフ",
  decisionBriefEmpty:
    "「解析」を実行すると、社長向けの経営判断ビューが用意されます。",
  executiveDecision: "経営判断",
  executiveDecisionEn: "Executive Decision",
  executiveHelp:
    "社長向けの主画面（約30秒）。順序：推奨対応 → 社長判断 → 判断準備状況 → 判断権限 → 判断理由 → 次の対応。",
  recommendation: "推奨対応",
  presidentDecision: "社長判断",
  decisionReadiness: "判断準備状況",
  decisionAuthorities: "判断権限・担当",
  decisionAuthoritiesHelp: "役割 → 権限（社長判断とは別）",
  why: "判断理由",
  nextActions: "次の対応",
  currentDecisionQuestion: "いま決めるべきこと",
  currentDecisionQuestionEn: "Current Decision Question",
  expectedDecider: "想定決定者",
  deferredItems: "実行・クローズに委ねる事項",
  decisionDetail: "判断詳細",
  confirmedFacts: "確認済み事実",
  reportedUnverified: "報告済み・未検証",
  assumptions: "仮定",
  missingInformation: "不足情報",
  risks: "リスク",
  options: "選択肢",
  delegation: "担当・委任",
  managementLearning: "管理上の学び",
  suggestedQuestions: "本船への確認事項",
  suggestedQuestionsHelp: "クリックでコピー（未解決の確認のみ表示）",
  humanReviewRequired: "人による確認が必要",
  humanReviewHelp:
    "1回の操作で必須5項目を人確認済みにします。変更が必要なときだけ編集してください。",
  humanReviewed: "人確認済み",
  humanReviewedEssentials:
    "案件種別 · タグ · 推奨対応 · 社長判断 · レビュー候補 — 変更時のみ編集（個別クリック不要）。",
  closedReviewCandidateRemains:
    "案件は完了済みですが、レビュー候補フラグは残っています。",
  markAllReviewed: "必須5項目を人確認済みにする",
  editEssentials: "必須項目のみ編集",
  hideEdits: "編集を隠す",
  reviewCandidate: "レビュー候補",
  reviewCandidateHelp: "レビュー候補（完了後も保持）",
  yes: "はい",
  no: "いいえ",
  qualityGateCritical: "Quality Gate — 重大な不備",
  qualityGateWarning: "Quality Gate — 警告",
  qualityGateOk: "Quality Gate — 重大な不備なし",
  qualityGateBlocksReady: "解消するまで「判断可能」はブロックされます。",
  qualityGateDoesNotBlock: "これだけでは「判断可能」をブロックしません。",
  who: "誰が",
  what: "何を",
  evidence: "根拠",
  source: "出典",
  learningCa: "是正処置",
  learningPa: "予防処置",
  learningEffectiveness: "有効性確認",
  learningHorizontal: "水平展開",
  learningIa: "内部監査候補",
  learningMr: "マネジメントレビュー候補",
  learningKnowledge: "知見更新",
} as const;

export const READINESS_LABEL_JA: Record<DecisionReadiness, string> = {
  READY: "判断可能",
  CONDITIONAL: "条件付き",
  NOT_READY: "判断不可",
};

export const EXTRACTION_STATUS_LABEL_JA: Record<ExtractionStatus, string> = {
  READY: "準備完了",
  EXTRACTING: "抽出中",
  EXTRACTED: "抽出済み",
  PREVIEW_ONLY: "プレビューのみ",
  FAILED: "抽出失敗",
};

export const CASE_TYPE_LABEL_JA: Record<CaseType, string> = {
  TECHNICAL: "技術",
  CREW_MANNING: "乗組員・配乗",
  FINANCE_COMMERCIAL: "資金・商務",
  INSPECTION_COMPLIANCE: "検査・法令",
  ISM_MANAGEMENT: "ISM・管理",
  OPERATIONAL: "運航",
};

export const CASE_STATUS_LABEL_JA: Record<CaseStatus, string> = {
  NEW: "新規",
  ANALYZING: "解析中",
  WAITING_FOR_INFORMATION: "情報待ち",
  DECISION_REQUIRED: "判断待ち",
  ACTION_IN_PROGRESS: "対応中",
  MONITORING: "監視中",
  CLOSED: "完了",
};

/** Known analysis tags → Japanese display. Unknown tags keep a readable fallback. */
export const TAG_LABEL_JA: Record<string, string> = {
  pluto_leader: "Pluto Leader",
  crew_change: "クルーチェンジ",
  owner_interest: "船主関心",
  operational_continuity: "運航継続",
  fairwind: "Fairwind",
  class_nk: "Class NK",
  maintenance: "整備",
  cms: "CMS",
  knowledge_update_candidate: "知見更新候補",
  financial_risk: "財務リスク",
  three_way_valve: "3ウェイバルブ",
  fo_system: "FO系統",
  temporary_repair: "応急修理",
  class_matter: "船級案件",
  deficiency: "不適合",
  inspection: "検査",
  ism: "ISM",
  technical: "技術",
  manning: "配乗",
  commercial: "商務",
  operational: "運航",
  semantic_v0_2: "添付意味解析",
};

export function formatTagLabelJa(tag: string): string {
  return TAG_LABEL_JA[tag] ?? tag.replaceAll("_", " ");
}

export function formatTagsJa(tags: string[]): string {
  if (tags.length === 0) return "(なし)";
  return tags.map(formatTagLabelJa).join("、");
}
