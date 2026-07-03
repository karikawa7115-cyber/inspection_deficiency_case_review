import vesselsData from "@/data/vessels.json";
import {
  deriveCriticalMatterFromFolder,
  INSPECTION_FOLDER_CRITICAL_SUFFIXES,
} from "@/lib/inspection/format";
import {
  inspectionFolderNameSchema,
  vesselsSchema,
  type Vessel,
} from "@/lib/inspection/schema";

/** `data/vessels.json` を検証して返す。デモ・UI シード用。 */
export function getManagedVessels(): Vessel[] {
  const result = vesselsSchema.safeParse(vesselsData);
  if (!result.success) {
    throw new Error(
      `vessels.json: ${result.error.issues[0]?.message ?? "invalid format"}`,
    );
  }
  return result.data;
}

/** 現在管理中の船（status === active）のみ。 */
export function getActiveVessels(vessels: Vessel[]): Vessel[] {
  return vessels.filter((v) => v.status === "active");
}

/** 船コードから管理船を取得。 */
export function getVesselByCode(
  vessels: Vessel[],
  code: string,
): Vessel | undefined {
  return vessels.find((v) => v.code === code);
}

type InspectionFolderParams = {
  code: string;
  date: string;
  inspectionType: string;
  port: string;
  criticalMatter?: boolean;
};

/**
 * inspection 資料フォルダ名を生成する（全大文字）。
 * 例: OBT_PSC_2026-02-17_PORTALPHA / OBT_PSC_2026-02-17_PORTALPHA_CRITICAL
 */
export function formatInspectionFolderName({
  code,
  date,
  inspectionType,
  port,
  criticalMatter = false,
}: InspectionFolderParams): string {
  const normalizedCode = code.toUpperCase();
  const normalizedType = inspectionType.toUpperCase().replace(/\s+/g, "_");
  const normalizedPort = port.toUpperCase().replace(/[\s_]+/g, "");
  const suffix = criticalMatter
    ? `_${INSPECTION_FOLDER_CRITICAL_SUFFIXES[0]}`
    : "";
  const folderName = `${normalizedCode}_${normalizedType}_${date}_${normalizedPort}${suffix}`;
  const result = inspectionFolderNameSchema.safeParse(folderName);
  if (!result.success) {
    throw new Error(
      `inspection folder name: ${result.error.issues[0]?.message ?? "invalid format"}`,
    );
  }
  return result.data;
}

export { deriveCriticalMatterFromFolder };