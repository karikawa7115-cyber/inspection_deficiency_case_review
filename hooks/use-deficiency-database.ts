"use client";

import { useEffect, useState } from "react";

import { toListRow, fetchDeficiencyDatabase } from "@/lib/inspection/db-load";
import type { DbDeficiencyDetail } from "@/lib/inspection/db-types";

export type DeficiencyDatabaseState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: DbDeficiencyDetail[] };

export function useDeficiencyDatabase() {
  const [state, setState] = useState<DeficiencyDatabaseState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });
      const result = await fetchDeficiencyDatabase();
      if (cancelled) return;

      if (!result.ok) {
        setState({ status: "error", message: result.error.message });
        return;
      }

      setState({ status: "ready", rows: result.data });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const listRows =
    state.status === "ready" ? state.rows.map(toListRow) : [];

  return { state, listRows };
}
