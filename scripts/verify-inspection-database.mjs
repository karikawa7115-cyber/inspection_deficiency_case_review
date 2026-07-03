/**
 * Inspection Deficiency Database — Supabase setup verification.
 * Usage: node scripts/verify-inspection-database.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");

function loadEnvLocal() {
  if (!existsSync(envPath)) {
    return null;
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function deriveAlerts(row) {
  const alerts = [];
  if (row.is_repeated) alerts.push("repeated");
  if (row.root_cause_status === "too_general") alerts.push("root_cause_too_general");
  if (row.root_cause_status === "shallow") alerts.push("root_cause_shallow");
  if (row.preventive_action_status === "weak") alerts.push("preventive_weak");
  if (row.handover_required) alerts.push("handover_required");
  if (row.internal_audit_status === "candidate") alerts.push("internal_audit_candidate");
  return alerts;
}

async function main() {
  const env = loadEnvLocal();
  if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("FAIL: .env.local missing or incomplete.");
    console.error("  Copy .env.example to .env.local and set Supabase URL + anon key.");
    process.exit(1);
  }

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log("Checking Supabase connection...");

  const tables = ["vessels", "inspection_cases", "deficiencies", "review_outputs", "approvals"];
  for (const table of tables) {
    const { error } = await client.from(table).select("id").limit(1);
    if (error) {
      console.error(`FAIL: cannot read "${table}": ${error.message}`);
      console.error("  Run supabase/schema.sql in SQL Editor first.");
      process.exit(1);
    }
  }
  console.log("OK: all 5 tables readable (RLS SELECT).");

  const { count: vesselCount, error: vesselErr } = await client
    .from("vessels")
    .select("id", { count: "exact", head: true });
  if (vesselErr) {
    console.error(`FAIL: vessels count: ${vesselErr.message}`);
    process.exit(1);
  }

  const { count: deficiencyCount, error: defErr } = await client
    .from("deficiencies")
    .select("id", { count: "exact", head: true });
  if (defErr) {
    console.error(`FAIL: deficiencies count: ${defErr.message}`);
    process.exit(1);
  }

  console.log(`OK: vessels=${vesselCount ?? 0}, deficiencies=${deficiencyCount ?? 0}`);

  if ((deficiencyCount ?? 0) !== 16) {
    console.warn(
      `WARN: expected 16 deficiencies from seed.sql, got ${deficiencyCount ?? 0}.`,
    );
    console.warn("  Run supabase/seed.sql if not applied yet.");
  }

  const { data: deficiencies, error: fetchErr } = await client
    .from("deficiencies")
    .select(
      "is_repeated, root_cause_status, preventive_action_status, handover_required, internal_audit_status",
    );
  if (fetchErr) {
    console.error(`FAIL: deficiencies fetch: ${fetchErr.message}`);
    process.exit(1);
  }

  const patterns = {
    repeated: false,
    root_cause_too_general: false,
    preventive_weak: false,
    handover_required: false,
    internal_audit_candidate: false,
  };

  for (const row of deficiencies ?? []) {
    for (const alert of deriveAlerts(row)) {
      if (alert in patterns) patterns[alert] = true;
    }
  }

  console.log("Seed pattern coverage:");
  let patternOk = true;
  for (const [key, found] of Object.entries(patterns)) {
    const status = found ? "OK" : "MISSING";
    console.log(`  ${status}: ${key}`);
    if (!found) patternOk = false;
  }

  if (!patternOk) {
    console.warn("WARN: some required alert patterns missing in seed data.");
  }

  console.log("\nSupabase connection verification complete.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
