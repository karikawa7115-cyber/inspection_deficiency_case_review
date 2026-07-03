/**
 * 検査指摘レビュー（船舶管理）ドメインの Zod スキーマ。
 * デモ試作・将来の Supabase 連携の SSoT。
 */

import { z } from "zod";

/** 管理船の最大隻数（現行3隻 + 追加枠2隻）。 */
export const MAX_MANAGED_VESSELS = 5;

/**
 * 管理船ステータス。
 * - active: 現在管理中
 * - reserved: 追加枠（船名はプレースホルダー、入替え可能）
 */
export const vesselStatusSchema = z.enum(["active", "reserved"]);
export type VesselStatus = z.infer<typeof vesselStatusSchema>;

/** フォルダ名・ファイル名用の3文字船コード（例: PLR, FWD, OBT）。 */
export const vesselCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "船コードは大文字3文字");
export type VesselCode = z.infer<typeof vesselCodeSchema>;

/** Pane 1 に表示する管理船。 */
export const vesselSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: vesselCodeSchema,
  status: vesselStatusSchema,
});
export type Vessel = z.infer<typeof vesselSchema>;

/** inspection フォルダ名: `{CODE}_{TYPE}_{YYYY-MM-DD}_{PORT}` または末尾 `_CRITICAL` / `_CRITICAL_MATTER` */
export const inspectionFolderNameSchema = z
  .string()
  .regex(
    /^[A-Z]{3}_[A-Z0-9]+_\d{4}-\d{2}-\d{2}_[A-Z0-9]+(_CRITICAL_MATTER|_CRITICAL)?$/,
    "例: OBT_PSC_2026-02-17_PORTALPHA または OBT_PSC_2026-02-17_PORTALPHA_CRITICAL",
  );
export type InspectionFolderName = z.infer<typeof inspectionFolderNameSchema>;

export const vesselsSchema = z
  .array(vesselSchema)
  .max(MAX_MANAGED_VESSELS, {
    message: `管理船は最大 ${MAX_MANAGED_VESSELS} 隻までです`,
  });

// ===== Inspection / Deficiency（PSC レビュー） =====

export const deficiencyReviewStatusSchema = z.enum([
  "draft",
  "reviewing",
  "approved",
]);
export type DeficiencyReviewStatus = z.infer<
  typeof deficiencyReviewStatusSchema
>;

/** P2/P3 AI Review Alert 種別。 */
export const reviewAlertTypeSchema = z.enum([
  "repeated",
  "root_cause_shallow",
  "root_cause_too_general",
  "preventive_weak",
]);
export type ReviewAlertType = z.infer<typeof reviewAlertTypeSchema>;

export const reviewAlertSchema = z.object({
  type: reviewAlertTypeSchema,
  message: z.string(),
});
export type ReviewAlert = z.infer<typeof reviewAlertSchema>;

/** P4 Follow-up Output タブ種別。 */
export const followUpTabSchema = z.enum([
  "review_comment",
  "vessel_revision_en",
  "handover_note",
  "training_point",
  "owner_summary_jp",
  "internal_audit_checklist",
]);
export type FollowUpTab = z.infer<typeof followUpTabSchema>;

/** P4 出力の承認状態（将来: 監督 → DP）。 */
export const reviewOutputStatusSchema = z.enum([
  "draft",
  "supervisor_review",
  "dp_approved",
]);
export type ReviewOutputStatus = z.infer<typeof reviewOutputStatusSchema>;

/** P4 出力の承認者ロール。 */
export const reviewOutputApprovalRoleSchema = z.enum(["supervisor", "dp"]);
export type ReviewOutputApprovalRole = z.infer<
  typeof reviewOutputApprovalRoleSchema
>;

/** P4 出力の承認ログ1件。 */
export const reviewOutputApprovalSchema = z.object({
  role: reviewOutputApprovalRoleSchema,
  approvedAt: z.string(),
  approvedBy: z.string(),
});
export type ReviewOutputApproval = z.infer<typeof reviewOutputApprovalSchema>;

/** P4 タブ1件分の生成物。 */
export const reviewOutputSchema = z.object({
  tab: followUpTabSchema,
  content: z.string(),
  status: reviewOutputStatusSchema.default("draft"),
  approvals: z.array(reviewOutputApprovalSchema).optional(),
});
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;

/**
 * 指摘1件。PSC Form B + CR-5/CR-6 の同一番号行を Deficiency 行に分割して保持（Grill-me 合意 B）。
 */
export const deficiencySchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  code: z.string(),
  description: z.string(),
  actionCode: z.string().optional(),
  regulatoryCite: z.string().optional(),
  cr5Contingency: z.string().optional(),
  cr5RootCause: z.string().optional(),
  cr6Correction: z.string().optional(),
  reviewAlerts: z.array(reviewAlertSchema).default([]),
  reviewQuestions: z.array(z.string()).default([]),
  reviewStatus: deficiencyReviewStatusSchema.default("draft"),
  /** P4 タブ出力（未設定時は draft-outputs で生成）。 */
  reviewOutputs: z.array(reviewOutputSchema).optional(),
  /** デモで P3 深掘りの主役指摘 */
  isDemoFocus: z.boolean().optional(),
});
export type Deficiency = z.infer<typeof deficiencySchema>;

/** 検査ケース1件（1 inspection = CR-5/CR-6 各1セット、指摘は deficiencies 複数行）。 */
export const inspectionSchema = z.object({
  id: z.string(),
  vesselCode: vesselCodeSchema,
  vesselName: z.string(),
  imo: z.string().optional(),
  flag: z.string().optional(),
  shipType: z.string().optional(),
  inspectionType: z.string(),
  inspectionDate: z.string(),
  port: z.string(),
  folderName: inspectionFolderNameSchema,
  /** DETAIN・出港遅延など重大案件。フォルダ名 `_CRITICAL` / `_CRITICAL_MATTER` からも判定可。 */
  criticalMatter: z.boolean().default(false),
  /** 重大案件の補足（出港遅延・NK 臨時検査等）。 */
  criticalMatterNote: z.string().optional(),
  detained: z.boolean().default(false),
  masterName: z.string().optional(),
  pscoName: z.string().optional(),
  companyName: z.string().optional(),
  deficiencies: z.array(deficiencySchema).min(1),
});
export type Inspection = z.infer<typeof inspectionSchema>;

export const inspectionsSchema = z.array(inspectionSchema);
