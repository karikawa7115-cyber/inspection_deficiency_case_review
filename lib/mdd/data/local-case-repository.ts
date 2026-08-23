"use client";

import type { CaseRepository } from "./case-repository";
import { MDD_STORAGE_KEY } from "./case-repository";
import type { MddCase } from "../types";

function readAll(): MddCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MDD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MddCase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(cases: MddCase[]) {
  window.localStorage.setItem(MDD_STORAGE_KEY, JSON.stringify(cases));
}

/**
 * Prefer deterministic `golden-${id}` rows over legacy random-id copies
 * created before replace-or-create loading existed.
 */
function preferCase(a: MddCase, b: MddCase): MddCase {
  const aGolden = a.goldenCaseId && a.id === `golden-${a.goldenCaseId}`;
  const bGolden = b.goldenCaseId && b.id === `golden-${b.goldenCaseId}`;
  if (aGolden !== bGolden) return aGolden ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

/** Collapse legacy duplicates that share the same goldenCaseId. */
export function dedupeGoldenCases(cases: MddCase[]): {
  cases: MddCase[];
  removed: number;
} {
  const byGolden = new Map<string, MddCase>();
  const withoutGolden: MddCase[] = [];

  for (const c of cases) {
    if (!c.goldenCaseId) {
      withoutGolden.push(c);
      continue;
    }
    const prev = byGolden.get(c.goldenCaseId);
    byGolden.set(c.goldenCaseId, prev ? preferCase(prev, c) : c);
  }

  const next = [...byGolden.values(), ...withoutGolden];
  return { cases: next, removed: cases.length - next.length };
}

function readDeduped(): MddCase[] {
  const raw = readAll();
  const { cases, removed } = dedupeGoldenCases(raw);
  if (removed > 0) writeAll(cases);
  return cases;
}

/** Phase 1 prototype validation only — not production persistence. */
export const localCaseRepository: CaseRepository = {
  async list() {
    return readDeduped().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    return readDeduped().find((c) => c.id === id) ?? null;
  },
  async save(caseData) {
    let all = readAll();
    if (caseData.goldenCaseId) {
      all = all.filter(
        (c) =>
          c.id === caseData.id || c.goldenCaseId !== caseData.goldenCaseId,
      );
    }
    const idx = all.findIndex((c) => c.id === caseData.id);
    if (idx >= 0) all[idx] = caseData;
    else all.push(caseData);
    const { cases } = dedupeGoldenCases(all);
    writeAll(cases);
    return caseData;
  },
  async remove(id) {
    writeAll(readAll().filter((c) => c.id !== id));
  },
  async clear() {
    writeAll([]);
  },
};
