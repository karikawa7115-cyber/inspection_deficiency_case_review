import { describe, expect, it } from "vitest";

import {
  applyDbDeficiencyFilters,
  deriveDbAlerts,
} from "@/lib/inspection/db-alerts";
import {
  EMPTY_DB_FILTERS,
  type DbDeficiencyListRow,
} from "@/lib/inspection/db-types";

function makeRow(
  overrides: Partial<DbDeficiencyListRow> = {},
): DbDeficiencyListRow {
  return {
    id: "33333333-3333-4333-8333-333333333301",
    deficiency_no: 1,
    title: "Sample deficiency",
    category: "07105",
    risk_level: "low",
    is_repeated: false,
    root_cause_status: "ok",
    preventive_action_status: "ok",
    handover_required: false,
    internal_audit_status: "none",
    vessel_code: "DVA",
    vessel_name: "DEMO VESSEL ALPHA",
    inspection_type: "PSC",
    inspection_date: "2026-01-20",
    port: "PORT BETA",
    country: "Country B",
    case_status: "reviewing",
    case_id: "DVA_PSC_2026-01-20_PORT-B",
    ...overrides,
  };
}

describe("deriveDbAlerts", () => {
  it("maps repeated and audit candidate flags", () => {
    const alerts = deriveDbAlerts(
      makeRow({
        is_repeated: true,
        internal_audit_status: "candidate",
      }),
    );
    expect(alerts).toContain("repeated");
    expect(alerts).toContain("internal_audit_candidate");
  });

  it("maps root cause too general and preventive weak", () => {
    const alerts = deriveDbAlerts(
      makeRow({
        root_cause_status: "too_general",
        preventive_action_status: "weak",
      }),
    );
    expect(alerts).toEqual(["root_cause_too_general", "preventive_weak"]);
  });
});

describe("applyDbDeficiencyFilters", () => {
  const rows = [
    makeRow({ id: "1", title: "Fire door", vessel_code: "DVA" }),
    makeRow({
      id: "2",
      title: "Deck line",
      vessel_code: "DVA",
      is_repeated: true,
      root_cause_status: "shallow",
      internal_audit_status: "candidate",
    }),
    makeRow({
      id: "3",
      title: "Garbage record",
      vessel_code: "DVB",
      root_cause_status: "too_general",
      preventive_action_status: "weak",
      handover_required: true,
    }),
  ];

  it("filters by keyword", () => {
    const result = applyDbDeficiencyFilters(rows, {
      ...EMPTY_DB_FILTERS,
      keyword: "garbage",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  it("filters repeated only", () => {
    const result = applyDbDeficiencyFilters(rows, {
      ...EMPTY_DB_FILTERS,
      repeatedOnly: true,
    });
    expect(result.map((r) => r.id)).toEqual(["2"]);
  });

  it("filters handover required and root cause too general together", () => {
    const result = applyDbDeficiencyFilters(rows, {
      ...EMPTY_DB_FILTERS,
      handoverRequiredOnly: true,
      rootCauseTooGeneralOnly: true,
    });
    expect(result.map((r) => r.id)).toEqual(["3"]);
  });
});
