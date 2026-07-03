import { describe, it, expect } from "vitest";

import {
  buildInspectionCaseContext,
  formatCaseMetaLine,
} from "@/lib/inspection/case-context";
import { getDemoInspectionById } from "@/lib/inspection/load";

describe("formatCaseMetaLine", () => {
  it("IMO / Flag / Master / PSCO を1行に連結する", () => {
    const line = formatCaseMetaLine({
      vesselName: "DEMO VESSEL CHARLIE",
      inspectionLabel: "PSC PORT ALPHA · 2026-02-17",
      imo: "9000003",
      flag: "Panama",
      masterName: "Capt. C. Demo",
      pscoName: "PSCO Inspector Charlie",
    });
    expect(line).toContain("IMO 9000003");
    expect(line).toContain("Flag Panama");
    expect(line).toContain("Master Capt. C. Demo");
    expect(line).toContain("PSCO PSCO Inspector Charlie");
  });

  it("未設定フィールドは省略する", () => {
    expect(
      formatCaseMetaLine({
        vesselName: "VESSEL",
        inspectionLabel: "PSC · PORT · 2026-01-01",
      }),
    ).toBe("");
  });
});

describe("buildInspectionCaseContext", () => {
  it("PLR Critical Matter ケースの文脈を構築する", () => {
    const inspection = getDemoInspectionById("insp-plr-psc-2026-01-26-port-bravo");
    expect(inspection).toBeDefined();
    const context = buildInspectionCaseContext(
      inspection!,
      "PSC PORT BRAVO · 2026-01-26",
    );
    expect(context.criticalMatter).toBe(true);
    expect(context.imo).toBe("9000001");
    expect(context.masterName).toContain("Capt. A. Demo");
  });
});
