import type { Inspection } from "@/lib/inspection/schema";

/** P3 ヘッダーに表示する検査ケース文脈。 */
export type InspectionCaseContext = {
  vesselName: string;
  inspectionLabel: string;
  imo?: string;
  flag?: string;
  masterName?: string;
  pscoName?: string;
  detained?: boolean;
  criticalMatter?: boolean;
  criticalMatterNote?: string;
};

export function buildInspectionCaseContext(
  inspection: Inspection,
  inspectionLabel: string,
): InspectionCaseContext {
  return {
    vesselName: inspection.vesselName,
    inspectionLabel,
    imo: inspection.imo,
    flag: inspection.flag,
    masterName: inspection.masterName,
    pscoName: inspection.pscoName,
    detained: inspection.detained,
    criticalMatter: inspection.criticalMatter,
    criticalMatterNote: inspection.criticalMatterNote,
  };
}

type CaseMetaItem = {
  label: string;
  value: string;
};

/** IMO / Flag / Master / PSCO をコンパクト1行に整形。 */
export function formatCaseMetaLine(context: InspectionCaseContext): string {
  const items: CaseMetaItem[] = [];

  if (context.imo?.trim()) {
    items.push({ label: "IMO", value: context.imo.trim() });
  }
  if (context.flag?.trim()) {
    items.push({ label: "Flag", value: context.flag.trim() });
  }
  if (context.masterName?.trim()) {
    items.push({ label: "Master", value: context.masterName.trim() });
  }
  if (context.pscoName?.trim()) {
    items.push({ label: "PSCO", value: context.pscoName.trim() });
  }

  return items.map((item) => `${item.label} ${item.value}`).join(" · ");
}
