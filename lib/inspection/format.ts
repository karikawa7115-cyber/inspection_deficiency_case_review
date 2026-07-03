import type { Inspection } from "@/lib/inspection/schema";

/** フォルダ名末尾の重大案件サフィックス（AI・人手の両方で判定しやすい固定語）。 */
export const INSPECTION_FOLDER_CRITICAL_SUFFIXES = [
  "CRITICAL_MATTER",
  "CRITICAL",
] as const;

/**
 * Pane 1 検査ケース行ラベル。
 * 例: PSC · PORT ALPHA · 2026-02-17
 */
export function formatInspectionPane1Label(
  inspection: Pick<
    Inspection,
    "inspectionType" | "port" | "inspectionDate"
  >,
): string {
  return `${inspection.inspectionType} · ${inspection.port} · ${inspection.inspectionDate}`;
}

/** フォルダ名末尾から重大案件フラグを判定。 */
export function deriveCriticalMatterFromFolder(folderName: string): boolean {
  const upper = folderName.toUpperCase();
  return INSPECTION_FOLDER_CRITICAL_SUFFIXES.some((suffix) =>
    upper.endsWith(`_${suffix}`),
  );
}

/** 表示・ストレージ用にサフィックスを除いたフォルダ名。 */
export function stripCriticalSuffixFromFolder(folderName: string): string {
  const upper = folderName.toUpperCase();
  for (const suffix of INSPECTION_FOLDER_CRITICAL_SUFFIXES) {
    const token = `_${suffix}`;
    if (upper.endsWith(token)) {
      return folderName.slice(0, folderName.length - token.length);
    }
  }
  return folderName;
}
