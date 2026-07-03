/**
 * Supabase read model for Deficiency Database View.
 * Separate from lib/inspection/schema.ts (Case Review JSON / localStorage).
 */

import { z } from "zod";

export const dbRiskLevelSchema = z.enum(["low", "medium", "high"]);
export type DbRiskLevel = z.infer<typeof dbRiskLevelSchema>;

export const dbRootCauseStatusSchema = z.enum(["ok", "shallow", "too_general"]);
export type DbRootCauseStatus = z.infer<typeof dbRootCauseStatusSchema>;

export const dbPreventiveActionStatusSchema = z.enum(["ok", "weak"]);
export type DbPreventiveActionStatus = z.infer<
  typeof dbPreventiveActionStatusSchema
>;

export const dbInternalAuditStatusSchema = z.enum([
  "none",
  "candidate",
  "added",
]);
export type DbInternalAuditStatus = z.infer<typeof dbInternalAuditStatusSchema>;

export const dbCaseStatusSchema = z.enum(["open", "reviewing", "closed"]);
export type DbCaseStatus = z.infer<typeof dbCaseStatusSchema>;

/** Alert badges derived from deficiency flags (not stored as JSON array in DB). */
export const dbAlertKindSchema = z.enum([
  "repeated",
  "root_cause_too_general",
  "root_cause_shallow",
  "preventive_weak",
  "handover_required",
  "internal_audit_candidate",
]);
export type DbAlertKind = z.infer<typeof dbAlertKindSchema>;

export const dbVesselRowSchema = z.object({
  id: z.string().uuid(),
  vessel_code: z.string(),
  vessel_name: z.string(),
  vessel_type: z.string(),
  is_active: z.boolean(),
});
export type DbVesselRow = z.infer<typeof dbVesselRowSchema>;

export const dbDeficiencyListRowSchema = z.object({
  id: z.string().uuid(),
  deficiency_no: z.number().int().positive(),
  title: z.string(),
  category: z.string(),
  risk_level: dbRiskLevelSchema,
  is_repeated: z.boolean(),
  root_cause_status: dbRootCauseStatusSchema,
  preventive_action_status: dbPreventiveActionStatusSchema,
  handover_required: z.boolean(),
  internal_audit_status: dbInternalAuditStatusSchema,
  vessel_code: z.string(),
  vessel_name: z.string(),
  inspection_type: z.string(),
  inspection_date: z.string(),
  port: z.string(),
  country: z.string(),
  case_status: dbCaseStatusSchema,
  case_id: z.string(),
});
export type DbDeficiencyListRow = z.infer<typeof dbDeficiencyListRowSchema>;

export const dbDeficiencyDetailSchema = dbDeficiencyListRowSchema.extend({
  original_finding: z.string(),
  vessel_cause: z.string().nullable(),
  corrective_action: z.string().nullable(),
  preventive_action: z.string().nullable(),
  company_review_comment: z.string().nullable(),
  vessel_revision_request: z.string().nullable(),
  handover_note: z.string().nullable(),
  training_point: z.string().nullable(),
  owner_summary: z.string().nullable(),
  internal_audit_checklist_item: z.string().nullable(),
  how_to_check: z.string().nullable(),
  required_evidence: z.string().nullable(),
});
export type DbDeficiencyDetail = z.infer<typeof dbDeficiencyDetailSchema>;

export type DbDeficiencyFilters = {
  keyword: string;
  vesselCode: string;
  inspectionType: string;
  category: string;
  riskLevel: string;
  repeatedOnly: boolean;
  rootCauseTooGeneralOnly: boolean;
  preventiveActionTooWeakOnly: boolean;
  handoverRequiredOnly: boolean;
  internalAuditCandidateOnly: boolean;
};

export const EMPTY_DB_FILTERS: DbDeficiencyFilters = {
  keyword: "",
  vesselCode: "",
  inspectionType: "",
  category: "",
  riskLevel: "",
  repeatedOnly: false,
  rootCauseTooGeneralOnly: false,
  preventiveActionTooWeakOnly: false,
  handoverRequiredOnly: false,
  internalAuditCandidateOnly: false,
};
