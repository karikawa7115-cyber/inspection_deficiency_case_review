import { describe, it, expect } from "vitest";

import vesselsData from "@/data/vessels.json";
import {
  MAX_MANAGED_VESSELS,
  inspectionFolderNameSchema,
  vesselsSchema,
} from "@/lib/inspection/schema";
import {
  formatInspectionFolderName,
  getActiveVessels,
  getManagedVessels,
} from "@/lib/inspection/vessels";
import {
  deriveCriticalMatterFromFolder,
  formatInspectionPane1Label,
} from "@/lib/inspection/format";

describe("data/vessels.json", () => {
  it("vesselsSchema を満たす", () => {
    expect(vesselsSchema.safeParse(vesselsData).success).toBe(true);
  });

  it("管理船は5隻（現行3 + 追加枠2）", () => {
    expect(vesselsData).toHaveLength(MAX_MANAGED_VESSELS);
  });

  it("現行管理船は PLR / FWD / OBT", () => {
    const active = getActiveVessels(getManagedVessels());
    expect(active.map((v) => v.code)).toEqual(["PLR", "FWD", "OBT"]);
    expect(active.map((v) => v.name)).toEqual([
      "DEMO VESSEL ALPHA",
      "DEMO VESSEL BRAVO",
      "DEMO VESSEL CHARLIE",
    ]);
  });

  it("追加枠は VSA / VSB", () => {
    const reserved = getManagedVessels().filter((v) => v.status === "reserved");
    expect(reserved.map((v) => v.code)).toEqual(["VSA", "VSB"]);
  });

  it("6隻目は vesselsSchema で拒否される", () => {
    const tooMany = [
      ...vesselsData,
      { id: "v-extra", name: "EXTRA", code: "EXT", status: "active" },
    ];
    expect(vesselsSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe("formatInspectionFolderName", () => {
  it("OBT_PSC_2026-02-17_PORTALPHA を生成する", () => {
    expect(
      formatInspectionFolderName({
        code: "OBT",
        date: "2026-02-17",
        inspectionType: "PSC",
        port: "PORT ALPHA",
      }),
    ).toBe("OBT_PSC_2026-02-17_PORTALPHA");
  });

  it("重大案件サフィックス _CRITICAL_MATTER を付与できる", () => {
    expect(
      formatInspectionFolderName({
        code: "FWD",
        date: "2026-03-10",
        inspectionType: "PSC",
        port: "PORT CHARLIE",
        criticalMatter: true,
      }),
    ).toBe("FWD_PSC_2026-03-10_PORTCHARLIE_CRITICAL_MATTER");
  });

  it("小文字入力は全大文字に正規化する", () => {
    expect(
      formatInspectionFolderName({
        code: "plr",
        date: "2026-01-26",
        inspectionType: "psc",
        port: "port bravo",
      }),
    ).toBe("PLR_PSC_2026-01-26_PORTBRAVO");
  });

  it("実運用の3 case フォルダ名を検証する", () => {
    const folders = [
      "OBT_PSC_2026-02-17_PORTALPHA",
      "FWD_PSC_2026-03-10_PORTCHARLIE",
      "PLR_PSC_2026-01-26_PORTBRAVO",
    ];
    for (const folder of folders) {
      expect(inspectionFolderNameSchema.safeParse(folder).success).toBe(true);
    }
  });
});

describe("formatInspectionPane1Label", () => {
  it("PSC · PORT ALPHA · 2026-02-17 を表示する", () => {
    expect(
      formatInspectionPane1Label({
        inspectionType: "PSC",
        port: "PORT ALPHA",
        inspectionDate: "2026-02-17",
      }),
    ).toBe("PSC · PORT ALPHA · 2026-02-17");
  });
});

describe("deriveCriticalMatterFromFolder", () => {
  it("_CRITICAL / _CRITICAL_MATTER を判定する", () => {
    expect(
      deriveCriticalMatterFromFolder("FWD_PSC_2026-03-10_PORTCHARLIE_CRITICAL"),
    ).toBe(true);
    expect(
      deriveCriticalMatterFromFolder(
        "FWD_PSC_2026-03-10_PORTCHARLIE_CRITICAL_MATTER",
      ),
    ).toBe(true);
    expect(
      deriveCriticalMatterFromFolder("OBT_PSC_2026-02-17_PORTALPHA"),
    ).toBe(false);
  });
});
