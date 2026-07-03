-- Inspection Deficiency Case Review Assistant — read-only prototype schema
-- Run in Supabase SQL Editor. anon role: SELECT only (RLS).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- vessels
-- vessel_name  = public display name (anonymized in prototype)
-- actual_name  = optional real name for future authenticated views (not selected by client in prod)
-- ---------------------------------------------------------------------------
create table if not exists public.vessels (
  id uuid primary key default gen_random_uuid(),
  vessel_code text not null unique
    check (vessel_code ~ '^[A-Z]{3}$'),
  vessel_name text not null,
  actual_name text,
  vessel_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vessels_is_active_idx on public.vessels (is_active);

-- ---------------------------------------------------------------------------
-- inspection_cases
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_cases (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references public.vessels (id) on delete restrict,
  case_id text not null unique,
  inspection_type text not null,
  inspection_date date not null,
  port text not null,
  country text not null,
  status text not null
    check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists inspection_cases_vessel_id_idx
  on public.inspection_cases (vessel_id);
create index if not exists inspection_cases_inspection_date_idx
  on public.inspection_cases (inspection_date desc);
create index if not exists inspection_cases_inspection_type_idx
  on public.inspection_cases (inspection_type);

-- ---------------------------------------------------------------------------
-- deficiencies
-- ---------------------------------------------------------------------------
create table if not exists public.deficiencies (
  id uuid primary key default gen_random_uuid(),
  inspection_case_id uuid not null references public.inspection_cases (id) on delete restrict,
  deficiency_no integer not null check (deficiency_no > 0),
  title text not null,
  category text not null,
  risk_level text not null
    check (risk_level in ('low', 'medium', 'high')),
  original_finding text not null,
  vessel_cause text,
  corrective_action text,
  preventive_action text,
  is_repeated boolean not null default false,
  root_cause_status text not null default 'ok'
    check (root_cause_status in ('ok', 'shallow', 'too_general')),
  preventive_action_status text not null default 'ok'
    check (preventive_action_status in ('ok', 'weak')),
  handover_required boolean not null default false,
  internal_audit_status text not null default 'none'
    check (internal_audit_status in ('none', 'candidate', 'added')),
  created_at timestamptz not null default now(),
  unique (inspection_case_id, deficiency_no)
);

create index if not exists deficiencies_inspection_case_id_idx
  on public.deficiencies (inspection_case_id);
create index if not exists deficiencies_category_idx
  on public.deficiencies (category);
create index if not exists deficiencies_risk_level_idx
  on public.deficiencies (risk_level);
create index if not exists deficiencies_is_repeated_idx
  on public.deficiencies (is_repeated) where is_repeated = true;
create index if not exists deficiencies_root_cause_status_idx
  on public.deficiencies (root_cause_status);
create index if not exists deficiencies_preventive_action_status_idx
  on public.deficiencies (preventive_action_status);
create index if not exists deficiencies_handover_required_idx
  on public.deficiencies (handover_required) where handover_required = true;
create index if not exists deficiencies_internal_audit_status_idx
  on public.deficiencies (internal_audit_status);

-- ---------------------------------------------------------------------------
-- review_outputs (1:1 with deficiency)
-- ---------------------------------------------------------------------------
create table if not exists public.review_outputs (
  id uuid primary key default gen_random_uuid(),
  deficiency_id uuid not null unique references public.deficiencies (id) on delete restrict,
  company_review_comment text,
  vessel_revision_request text,
  handover_note text,
  training_point text,
  owner_summary text,
  internal_audit_checklist_item text,
  how_to_check text,
  required_evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  deficiency_id uuid not null references public.deficiencies (id) on delete restrict,
  approval_type text not null
    check (approval_type in ('supervisor', 'dp')),
  status text not null
    check (status in ('pending', 'approved', 'rejected')),
  decided_by text,
  decision_date date,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists approvals_deficiency_id_idx
  on public.approvals (deficiency_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — read-only for anon / authenticated
-- ---------------------------------------------------------------------------
alter table public.vessels enable row level security;
alter table public.inspection_cases enable row level security;
alter table public.deficiencies enable row level security;
alter table public.review_outputs enable row level security;
alter table public.approvals enable row level security;

create policy "anon_select_vessels"
  on public.vessels for select to anon, authenticated
  using (true);

create policy "anon_select_inspection_cases"
  on public.inspection_cases for select to anon, authenticated
  using (true);

create policy "anon_select_deficiencies"
  on public.deficiencies for select to anon, authenticated
  using (true);

create policy "anon_select_review_outputs"
  on public.review_outputs for select to anon, authenticated
  using (true);

create policy "anon_select_approvals"
  on public.approvals for select to anon, authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies for anon or authenticated.
-- service_role bypasses RLS; never expose service_role key in the client.
