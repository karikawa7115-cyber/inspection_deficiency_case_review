import type { MddCase } from "../types";

export interface CaseRepository {
  list(): Promise<MddCase[]>;
  get(id: string): Promise<MddCase | null>;
  save(caseData: MddCase): Promise<MddCase>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const MDD_STORAGE_KEY = "mdd-phase1-cases-v1";
