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

/** Phase 1 prototype validation only — not production persistence. */
export const localCaseRepository: CaseRepository = {
  async list() {
    return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    return readAll().find((c) => c.id === id) ?? null;
  },
  async save(caseData) {
    const all = readAll();
    const idx = all.findIndex((c) => c.id === caseData.id);
    if (idx >= 0) all[idx] = caseData;
    else all.push(caseData);
    writeAll(all);
    return caseData;
  },
  async remove(id) {
    writeAll(readAll().filter((c) => c.id !== id));
  },
  async clear() {
    writeAll([]);
  },
};
