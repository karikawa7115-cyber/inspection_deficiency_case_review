"use client";

import { useCallback, useEffect, useState } from "react";

import {
  applyDpApproval,
  applySupervisorApproval,
} from "@/lib/inspection/approval";
import {
  resolveFollowUpContent,
  type FollowUpDraftContext,
} from "@/lib/inspection/draft-outputs";
import {
  clearPersistedTabOutput,
  createEmptyPersistStore,
  loadPersistStore,
  savePersistStore,
  upsertPersistedTabOutput,
  type PersistStore,
} from "@/lib/inspection/persist-store";
import {
  deriveDeficiencyReviewStatus,
  getEffectiveTabApprovals,
  getEffectiveTabStatus,
  mergeDeficiencyReviewStatus,
} from "@/lib/inspection/review-status";
import {
  type Deficiency,
  type FollowUpTab,
  type ReviewOutputApproval,
  type ReviewOutputStatus,
} from "@/lib/inspection/schema";

export function useInspectionPersist() {
  const [store, setStore] = useState<PersistStore>(createEmptyPersistStore);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(loadPersistStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePersistStore(store);
  }, [store, hydrated]);

  const mergeDeficiency = useCallback(
    (deficiency: Deficiency) => mergeDeficiencyReviewStatus(store, deficiency),
    [store],
  );

  const getReviewStatus = useCallback(
    (deficiency: Deficiency) =>
      deriveDeficiencyReviewStatus(store, deficiency),
    [store],
  );

  const resolveTabContent = useCallback(
    (
      deficiency: Deficiency,
      tab: FollowUpTab,
      draftContext: FollowUpDraftContext,
    ) => {
      const persisted = store.deficiencies[deficiency.id]?.tabs[tab]?.content;
      if (persisted !== undefined) return persisted;
      return resolveFollowUpContent(tab, deficiency, draftContext);
    },
    [store],
  );

  const getTabState = useCallback(
    (
      deficiency: Deficiency,
      tab: FollowUpTab,
    ): {
      status: ReviewOutputStatus;
      approvals: ReviewOutputApproval[];
    } => ({
      status: getEffectiveTabStatus(store, deficiency, tab),
      approvals: getEffectiveTabApprovals(store, deficiency, tab),
    }),
    [store],
  );

  const saveTabContent = useCallback(
    (deficiencyId: string, tab: FollowUpTab, content: string) => {
      setStore((prev) =>
        upsertPersistedTabOutput(prev, deficiencyId, tab, { content }),
      );
    },
    [],
  );

  const approveSupervisor = useCallback(
    (deficiencyId: string, tab: FollowUpTab) => {
      setStore((prev) => {
        const current = prev.deficiencies[deficiencyId]?.tabs[tab];
        const approvals = current?.approvals ?? [];
        const { status, approval } = applySupervisorApproval(tab);
        return upsertPersistedTabOutput(prev, deficiencyId, tab, {
          status,
          approvals: [...approvals, approval],
        });
      });
    },
    [],
  );

  const approveDp = useCallback((deficiencyId: string, tab: FollowUpTab) => {
    setStore((prev) => {
      const current = prev.deficiencies[deficiencyId]?.tabs[tab];
      const approvals = current?.approvals ?? [];
      const { status, approval } = applyDpApproval();
      return upsertPersistedTabOutput(prev, deficiencyId, tab, {
        status,
        approvals: [...approvals, approval],
      });
    });
  }, []);

  const resetTab = useCallback((deficiencyId: string, tab: FollowUpTab) => {
    setStore((prev) => clearPersistedTabOutput(prev, deficiencyId, tab));
  }, []);

  const resetAll = useCallback(() => {
    setStore(createEmptyPersistStore());
  }, []);

  return {
    hydrated,
    store,
    mergeDeficiency,
    getReviewStatus,
    resolveTabContent,
    getTabState,
    saveTabContent,
    approveSupervisor,
    approveDp,
    resetTab,
    resetAll,
  };
}

export type InspectionPersistApi = ReturnType<typeof useInspectionPersist>;
