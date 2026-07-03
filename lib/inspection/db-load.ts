import { getSupabaseClient, getSupabaseConfig } from "@/lib/supabase/client";
import {
  dbDeficiencyDetailSchema,
  dbDeficiencyListRowSchema,
  dbVesselRowSchema,
  type DbDeficiencyDetail,
  type DbDeficiencyListRow,
  type DbVesselRow,
} from "@/lib/inspection/db-types";

export type DbLoadError = {
  kind: "not_configured" | "query_failed";
  message: string;
};

type DbLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DbLoadError };

const DEFICIENCY_SELECT = `
  id,
  deficiency_no,
  title,
  category,
  risk_level,
  is_repeated,
  root_cause_status,
  preventive_action_status,
  handover_required,
  internal_audit_status,
  original_finding,
  vessel_cause,
  corrective_action,
  preventive_action,
  inspection_cases!inner (
    case_id,
    inspection_type,
    inspection_date,
    port,
    country,
    status,
    vessels!inner (
      vessel_code,
      vessel_name
    )
  ),
  review_outputs (
    company_review_comment,
    vessel_revision_request,
    handover_note,
    training_point,
    owner_summary,
    internal_audit_checklist_item,
    how_to_check,
    required_evidence
  )
`;

type RawVessel = {
  vessel_code: string;
  vessel_name: string;
};

type RawInspectionCase = {
  case_id: string;
  inspection_type: string;
  inspection_date: string;
  port: string;
  country: string;
  status: string;
  vessels: RawVessel | RawVessel[];
};

type NormalizedInspectionCase = Omit<RawInspectionCase, "vessels"> & {
  vessels: RawVessel;
};

type RawReviewOutput = {
  company_review_comment: string | null;
  vessel_revision_request: string | null;
  handover_note: string | null;
  training_point: string | null;
  owner_summary: string | null;
  internal_audit_checklist_item: string | null;
  how_to_check: string | null;
  required_evidence: string | null;
} | null;

type RawDeficiencyRow = {
  id: string;
  deficiency_no: number;
  title: string;
  category: string;
  risk_level: string;
  is_repeated: boolean;
  root_cause_status: string;
  preventive_action_status: string;
  handover_required: boolean;
  internal_audit_status: string;
  original_finding: string;
  vessel_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  inspection_cases: RawInspectionCase | RawInspectionCase[];
  review_outputs: RawReviewOutput | RawReviewOutput[];
};

function normalizeInspectionCase(
  value: RawInspectionCase | RawInspectionCase[],
): NormalizedInspectionCase {
  const inspectionCase = Array.isArray(value) ? value[0] : value;
  if (!inspectionCase) {
    throw new Error("deficiency row missing inspection case");
  }
  const vessels = Array.isArray(inspectionCase.vessels)
    ? inspectionCase.vessels[0]
    : inspectionCase.vessels;
  if (!vessels) {
    throw new Error("deficiency row missing vessel");
  }
  return { ...inspectionCase, vessels };
}

function normalizeReviewOutput(
  value: RawReviewOutput | RawReviewOutput[],
): RawReviewOutput {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapDeficiencyRow(row: RawDeficiencyRow): DbDeficiencyDetail {
  const inspectionCase = normalizeInspectionCase(row.inspection_cases);
  const vessel = inspectionCase.vessels;
  const reviewOutput = normalizeReviewOutput(row.review_outputs);

  const mapped = {
    id: row.id,
    deficiency_no: row.deficiency_no,
    title: row.title,
    category: row.category,
    risk_level: row.risk_level,
    is_repeated: row.is_repeated,
    root_cause_status: row.root_cause_status,
    preventive_action_status: row.preventive_action_status,
    handover_required: row.handover_required,
    internal_audit_status: row.internal_audit_status,
    vessel_code: vessel.vessel_code,
    vessel_name: vessel.vessel_name,
    inspection_type: inspectionCase.inspection_type,
    inspection_date: inspectionCase.inspection_date,
    port: inspectionCase.port,
    country: inspectionCase.country,
    case_status: inspectionCase.status,
    case_id: inspectionCase.case_id,
    original_finding: row.original_finding,
    vessel_cause: row.vessel_cause,
    corrective_action: row.corrective_action,
    preventive_action: row.preventive_action,
    company_review_comment: reviewOutput?.company_review_comment ?? null,
    vessel_revision_request: reviewOutput?.vessel_revision_request ?? null,
    handover_note: reviewOutput?.handover_note ?? null,
    training_point: reviewOutput?.training_point ?? null,
    owner_summary: reviewOutput?.owner_summary ?? null,
    internal_audit_checklist_item:
      reviewOutput?.internal_audit_checklist_item ?? null,
    how_to_check: reviewOutput?.how_to_check ?? null,
    required_evidence: reviewOutput?.required_evidence ?? null,
  };

  const parsed = dbDeficiencyDetailSchema.safeParse(mapped);
  if (!parsed.success) {
    throw new Error(
      `deficiency row invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

function toListRow(detail: DbDeficiencyDetail): DbDeficiencyListRow {
  const parsed = dbDeficiencyListRowSchema.safeParse(detail);
  if (!parsed.success) {
    throw new Error(
      `deficiency list row invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

export async function fetchDeficiencyDatabase(): Promise<
  DbLoadResult<DbDeficiencyDetail[]>
> {
  const config = getSupabaseConfig();
  if (!config.ok) {
    return { ok: false, error: { kind: "not_configured", message: config.error.message } };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error: {
        kind: "not_configured",
        message: "Supabase client could not be created.",
      },
    };
  }

  const { data, error } = await client
    .from("deficiencies")
    .select(DEFICIENCY_SELECT);

  if (error) {
    return {
      ok: false,
      error: {
        kind: "query_failed",
        message: error.message,
      },
    };
  }

  try {
    const rows = (data as unknown as RawDeficiencyRow[])
      .map(mapDeficiencyRow)
      .sort((a, b) => {
        const dateCompare = b.inspection_date.localeCompare(a.inspection_date);
        if (dateCompare !== 0) return dateCompare;
        return a.deficiency_no - b.deficiency_no;
      });
    return { ok: true, data: rows };
  } catch (cause) {
    return {
      ok: false,
      error: {
        kind: "query_failed",
        message:
          cause instanceof Error ? cause.message : "Failed to parse deficiency rows.",
      },
    };
  }
}

export async function fetchActiveVessels(): Promise<DbLoadResult<DbVesselRow[]>> {
  const config = getSupabaseConfig();
  if (!config.ok) {
    return { ok: false, error: { kind: "not_configured", message: config.error.message } };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error: {
        kind: "not_configured",
        message: "Supabase client could not be created.",
      },
    };
  }

  const { data, error } = await client
    .from("vessels")
    .select("id, vessel_code, vessel_name, vessel_type, is_active")
    .eq("is_active", true)
    .order("vessel_code");

  if (error) {
    return {
      ok: false,
      error: { kind: "query_failed", message: error.message },
    };
  }

  const parsed = dbVesselRowSchema.array().safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "query_failed",
        message: parsed.error.issues[0]?.message ?? "Invalid vessel rows.",
      },
    };
  }

  return { ok: true, data: parsed.data };
}

export { toListRow };
