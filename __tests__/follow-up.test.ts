import { describe, it, expect } from "vitest";

import {
  buildFollowUpDraft,
  resolveFollowUpContent,
  resolveFollowUpStatus,
} from "@/lib/inspection/draft-outputs";
import { FOLLOW_UP_TAB_IDS } from "@/lib/inspection/follow-up";
import { getDemoInspectionById } from "@/lib/inspection/load";
import {
  followUpTabSchema,
  reviewOutputSchema,
} from "@/lib/inspection/schema";

describe("followUpTabSchema", () => {
  it("6 タブすべてを受け付ける", () => {
    for (const tab of FOLLOW_UP_TAB_IDS) {
      expect(followUpTabSchema.safeParse(tab).success).toBe(true);
    }
  });
});

describe("reviewOutputSchema", () => {
  it("tab + content + status を検証する", () => {
    const result = reviewOutputSchema.safeParse({
      tab: "handover_note",
      content: "Handover draft",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });
});

describe("buildFollowUpDraft", () => {
  const inspection = getDemoInspectionById("insp-obt-psc-2026-02-17-port-alpha");
  const focus = inspection?.deficiencies.find((d) => d.isDemoFocus);

  it("OBT 07105 で全タブのドラフトを生成できる", () => {
    expect(focus).toBeDefined();
    const context = {
      vesselName: inspection!.vesselName,
      inspectionLabel: "PSC PORT ALPHA · 2026-02-17",
    };
    for (const tab of FOLLOW_UP_TAB_IDS) {
      const draft = buildFollowUpDraft(tab, focus!, context);
      expect(draft.trim().length).toBeGreaterThan(20);
    }
  });

  it("Vessel Revision EN に reviewQuestions を含む", () => {
    const context = {
      vesselName: inspection!.vesselName,
      inspectionLabel: "PSC PORT ALPHA · 2026-02-17",
    };
    const draft = buildFollowUpDraft("vessel_revision_en", focus!, context);
    expect(draft).toContain("door closer pressure");
    expect(focus!.reviewQuestions.every((q) => draft.includes(q))).toBe(true);
  });

  it("reviewOutputs 保存値を resolveFollowUpContent が優先する", () => {
    const withOutput = {
      ...focus!,
      reviewOutputs: [
        {
          tab: "review_comment" as const,
          content: "Saved supervisor note",
          status: "supervisor_review" as const,
          approvals: [
            {
              role: "supervisor" as const,
              approvedAt: "2026-06-30T09:00:00.000Z",
              approvedBy: "Technical Superintendent",
            },
          ],
        },
      ],
    };
    const context = {
      vesselName: inspection!.vesselName,
      inspectionLabel: "PSC PORT ALPHA · 2026-02-17",
    };
    expect(
      resolveFollowUpContent("review_comment", withOutput, context),
    ).toBe("Saved supervisor note");
    expect(resolveFollowUpStatus("review_comment", withOutput)).toBe(
      "supervisor_review",
    );
  });
});
