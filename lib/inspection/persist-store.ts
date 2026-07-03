import { z } from "zod";

import {
  reviewOutputApprovalSchema,
  reviewOutputStatusSchema,
  type FollowUpTab,
  type ReviewOutputApproval,
  type ReviewOutputStatus,
} from "@/lib/inspection/schema";
import { INSPECTION_DEMO_WORKSPACE } from "@/lib/inspection/labels";

export const PERSIST_STORE_KEY = `${INSPECTION_DEMO_WORKSPACE.storageKey}:v1`;

export const persistedTabOutputSchema = z.object({
  content: z.string().optional(),
  status: reviewOutputStatusSchema.default("draft"),
  approvals: z.array(reviewOutputApprovalSchema).default([]),
});
export type PersistedTabOutput = z.infer<typeof persistedTabOutputSchema>;

export const persistedDeficiencySchema = z.object({
  tabs: z.record(z.string(), persistedTabOutputSchema).default({}),
});
export type PersistedDeficiency = z.infer<typeof persistedDeficiencySchema>;

export const persistStoreSchema = z.object({
  version: z.literal(1),
  deficiencies: z.record(z.string(), persistedDeficiencySchema).default({}),
});
export type PersistStore = z.infer<typeof persistStoreSchema>;

export function createEmptyPersistStore(): PersistStore {
  return { version: 1, deficiencies: {} };
}

export function loadPersistStore(): PersistStore {
  if (typeof window === "undefined") {
    return createEmptyPersistStore();
  }
  try {
    const raw = localStorage.getItem(PERSIST_STORE_KEY);
    if (!raw) return createEmptyPersistStore();
    const result = persistStoreSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : createEmptyPersistStore();
  } catch {
    return createEmptyPersistStore();
  }
}

export function savePersistStore(store: PersistStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSIST_STORE_KEY, JSON.stringify(store));
}

export function getPersistedDeficiency(
  store: PersistStore,
  deficiencyId: string,
): PersistedDeficiency | undefined {
  return store.deficiencies[deficiencyId];
}

export function getPersistedTabOutput(
  store: PersistStore,
  deficiencyId: string,
  tab: FollowUpTab,
): PersistedTabOutput | undefined {
  return store.deficiencies[deficiencyId]?.tabs[tab];
}

export function upsertPersistedTabOutput(
  store: PersistStore,
  deficiencyId: string,
  tab: FollowUpTab,
  patch: Partial<PersistedTabOutput>,
): PersistStore {
  const current = store.deficiencies[deficiencyId] ?? { tabs: {} };
  const currentTab = current.tabs[tab] ?? {
    status: "draft" as ReviewOutputStatus,
    approvals: [] as ReviewOutputApproval[],
  };

  return {
    ...store,
    deficiencies: {
      ...store.deficiencies,
      [deficiencyId]: {
        tabs: {
          ...current.tabs,
          [tab]: {
            ...currentTab,
            ...patch,
            approvals: patch.approvals ?? currentTab.approvals,
          },
        },
      },
    },
  };
}

export function clearPersistedTabOutput(
  store: PersistStore,
  deficiencyId: string,
  tab: FollowUpTab,
): PersistStore {
  const current = store.deficiencies[deficiencyId];
  if (!current) return store;

  const { [tab]: _removed, ...restTabs } = current.tabs;
  const nextTabs = restTabs;

  if (Object.keys(nextTabs).length === 0) {
    const { [deficiencyId]: _def, ...restDefs } = store.deficiencies;
    return { ...store, deficiencies: restDefs };
  }

  return {
    ...store,
    deficiencies: {
      ...store.deficiencies,
      [deficiencyId]: {
        tabs: nextTabs,
      },
    },
  };
}
