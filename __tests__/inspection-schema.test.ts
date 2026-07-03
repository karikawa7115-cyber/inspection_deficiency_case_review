import { describe, it, expect } from "vitest";

import orbitInspectionData from "@/data/inspections/obt-psc-2026-02-17-port-alpha.json";
import plrInspectionData from "@/data/inspections/plr-psc-2026-01-26-port-bravo.json";
import fwdInspectionData from "@/data/inspections/fwd-psc-2026-03-10-port-charlie.json";
import {
  getDefaultDeficiencyId,
  getDemoInspectionById,
  getDemoInspections,
} from "@/lib/inspection/load";
import { inspectionsSchema } from "@/lib/inspection/schema";

describe("data/inspections/obt-psc-2026-02-17-port-alpha.json", () => {
  it("inspectionsSchema を満たす", () => {
    expect(inspectionsSchema.safeParse(orbitInspectionData).success).toBe(true);
  });

  it("DEMO VESSEL CHARLIE PSC PORT ALPHA は指摘2件", () => {
    const inspection = getDemoInspectionById("insp-obt-psc-2026-02-17-port-alpha");
    expect(inspection?.vesselCode).toBe("OBT");
    expect(inspection?.folderName).toBe("OBT_PSC_2026-02-17_PORTALPHA");
    expect(inspection?.deficiencies).toHaveLength(2);
  });

  it("デモ P3 主役は No.1 防火扉 (07105)", () => {
    const inspection = getDemoInspectionById("insp-obt-psc-2026-02-17-port-alpha");
    expect(inspection).toBeDefined();
    const focusId = getDefaultDeficiencyId(inspection!);
    const focus = inspection!.deficiencies.find((d) => d.id === focusId);
    expect(focus?.code).toBe("07105");
    expect(focus?.isDemoFocus).toBe(true);
    expect(focus?.reviewAlerts.length).toBeGreaterThan(0);
    expect(focus?.reviewQuestions).toHaveLength(5);
  });
});

describe("data/inspections/plr-psc-2026-01-26-port-bravo.json", () => {
  it("inspectionsSchema を満たす", () => {
    expect(inspectionsSchema.safeParse(plrInspectionData).success).toBe(true);
  });

  it("DEMO VESSEL ALPHA PSC PORT BRAVO は Critical Matter", () => {
    const inspection = getDemoInspectionById("insp-plr-psc-2026-01-26-port-bravo");
    expect(inspection?.criticalMatter).toBe(true);
    expect(inspection?.folderName).toBe(
      "PLR_PSC_2026-01-26_PORTBRAVO_CRITICAL_MATTER",
    );
    expect(inspection?.criticalMatterNote).toContain("Class society occasional survey");
  });

  it("指摘1件 Code 07123 Action 17ac", () => {
    const inspection = getDemoInspectionById("insp-plr-psc-2026-01-26-port-bravo");
    expect(inspection?.deficiencies).toHaveLength(1);
    expect(inspection?.deficiencies[0].code).toBe("07123");
    expect(inspection?.deficiencies[0].actionCode).toBe("17ac");
  });
});

describe("data/inspections/fwd-psc-2026-03-10-port-charlie.json", () => {
  it("inspectionsSchema を満たす", () => {
    expect(inspectionsSchema.safeParse(fwdInspectionData).success).toBe(true);
  });

  it("DEMO VESSEL BRAVO PSC PORT CHARLIE は通常 case（Critical なし）", () => {
    const inspection = getDemoInspectionById("insp-fwd-psc-2026-03-10-port-charlie");
    expect(inspection?.criticalMatter).toBe(false);
    expect(inspection?.folderName).toBe("FWD_PSC_2026-03-10_PORTCHARLIE");
    expect(inspection?.deficiencies).toHaveLength(5);
  });

  it("指摘 No.3 は pilot ladder (10101) で Review Alert あり", () => {
    const inspection = getDemoInspectionById("insp-fwd-psc-2026-03-10-port-charlie");
    const def3 = inspection?.deficiencies.find((d) => d.number === 3);
    expect(def3?.code).toBe("10101");
    expect(def3?.reviewAlerts.length).toBeGreaterThan(0);
  });
});

describe("getDemoInspections", () => {
  it("デモ case は3件（PLR + OBT + FWD）", () => {
    expect(getDemoInspections()).toHaveLength(3);
  });
});
