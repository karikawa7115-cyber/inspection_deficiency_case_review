import obtInspectionsData from "@/data/inspections/obt-psc-2026-02-17-port-alpha.json";
import plrInspectionsData from "@/data/inspections/plr-psc-2026-01-26-port-bravo.json";
import fwdInspectionsData from "@/data/inspections/fwd-psc-2026-03-10-port-charlie.json";
import { deriveCriticalMatterFromFolder } from "@/lib/inspection/format";
import {
  inspectionsSchema,
  type Inspection,
  type Deficiency,
} from "@/lib/inspection/schema";

const demoInspectionsRaw = [
  ...plrInspectionsData,
  ...obtInspectionsData,
  ...fwdInspectionsData,
];

function normalizeInspection(inspection: Inspection): Inspection {
  const fromFolder = deriveCriticalMatterFromFolder(inspection.folderName);
  return {
    ...inspection,
    criticalMatter: inspection.criticalMatter || fromFolder,
  };
}

/** デモ用 inspection 一覧（将来 Supabase 読み込みに差し替え）。 */
export function getDemoInspections(): Inspection[] {
  const result = inspectionsSchema.safeParse(demoInspectionsRaw);
  if (!result.success) {
    throw new Error(
      `inspections data: ${result.error.issues[0]?.message ?? "invalid format"}`,
    );
  }
  return result.data.map(normalizeInspection);
}

export function getDemoInspectionById(id: string): Inspection | undefined {
  return getDemoInspections().find((i) => i.id === id);
}

export function getDeficiencyById(
  inspection: Inspection,
  deficiencyId: string,
): Deficiency | undefined {
  return inspection.deficiencies.find((d) => d.id === deficiencyId);
}

/** デモ P3 主役指摘（isDemoFocus）または先頭指摘。 */
export function getDefaultDeficiencyId(inspection: Inspection): string {
  const focus = inspection.deficiencies.find((d) => d.isDemoFocus);
  return focus?.id ?? inspection.deficiencies[0].id;
}
