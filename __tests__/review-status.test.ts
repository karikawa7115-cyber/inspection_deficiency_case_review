import { describe, it, expect } from "vitest";

import {
  clearPersistedTabOutput,
  createEmptyPersistStore,
  upsertPersistedTabOutput,
} from "@/lib/inspection/persist-store";
import { deriveDeficiencyReviewStatus } from "@/lib/inspection/review-status";
import { getDemoInspectionById } from "@/lib/inspection/load";

describe("deriveDeficiencyReviewStatus", () => {
  const inspection = getDemoInspectionById("insp-obt-psc-2026-02-17-port-alpha");
  const focus = inspection!.deficiencies.find((d) => d.isDemoFocus)!;

  it("永続化なしは JSON 初期値", () => {
    const store = createEmptyPersistStore();
    expect(deriveDeficiencyReviewStatus(store, focus)).toBe("reviewing");
  });

  it("P4 編集開始で reviewing", () => {
    let store = createEmptyPersistStore();
    const draft = { ...focus, reviewStatus: "draft" as const };
    store = upsertPersistedTabOutput(store, draft.id, "review_comment", {
      content: "Edited note",
    });
    expect(deriveDeficiencyReviewStatus(store, draft)).toBe("reviewing");
  });

  it("主要3タブ Approved で approved", () => {
    let store = createEmptyPersistStore();
    for (const tab of [
      "vessel_revision_en",
      "handover_note",
      "internal_audit_checklist",
    ] as const) {
      store = upsertPersistedTabOutput(store, focus.id, tab, {
        status: "dp_approved",
        approvals: [],
      });
    }
    expect(deriveDeficiencyReviewStatus(store, focus)).toBe("approved");
  });
});

describe("persist store", () => {
  it("タブ reset でエントリを削除する", () => {
    let store = upsertPersistedTabOutput(
      createEmptyPersistStore(),
      "def-1",
      "review_comment",
      { content: "note" },
    );
    store = clearPersistedTabOutput(store, "def-1", "review_comment");
    expect(store.deficiencies["def-1"]).toBeUndefined();
  });
});
