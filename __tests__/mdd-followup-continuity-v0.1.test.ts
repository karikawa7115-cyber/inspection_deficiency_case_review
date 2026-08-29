import { describe, expect, it } from "vitest";
import { composeAnalyzeInput } from "@/lib/mdd/attachments/compose-analyze-input";
import { proposeFromHeuristics } from "@/lib/mdd/decision-engine/propose";
import type { CaseFollowUp, IntakeAttachmentRecord } from "@/lib/mdd/types";

describe("Case Follow-up Continuity v0.1", () => {
  it("composes follow-ups and per-follow-up attachments with boundaries", () => {
    const attachments: IntakeAttachmentRecord[] = [
      {
        attachmentId: "att_case",
        fileName: "cover.txt",
        mimeType: "text/plain",
        size: 10,
        extractionStatus: "EXTRACTED",
        extractedContent: "case level note",
      },
      {
        attachmentId: "att_fu",
        fileName: "reply.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 20,
        extractionStatus: "EXTRACTED",
        extractedContent: "[Sheet: OPEN]\nValve,defective",
      },
    ];
    const followUps: CaseFollowUp[] = [
      {
        followUpId: "fu_1",
        createdAt: "2026-08-28T05:00:00.000Z",
        authorLabel: "Master",
        text: "DG still usable on other bank.",
        attachmentIds: ["att_fu"],
      },
    ];
    const text = composeAnalyzeInput({
      narrative: "Please find attached CR-8.",
      attachments,
      followUps,
    });
    expect(text).toContain("[INTAKE NARRATIVE]");
    expect(text).toContain("[ATTACHMENT 1]");
    expect(text).toContain("cover.txt");
    expect(text).toContain("[FOLLOW-UP 1]");
    expect(text).toContain("Author: Master");
    expect(text).toContain("DG still usable");
    expect(text).toContain("[FOLLOW-UP 1 ATTACHMENT 1]");
    expect(text).toContain("reply.xlsx");
    // Case-level attachment must not be nested under follow-up
    expect(text.indexOf("[ATTACHMENT 1]")).toBeLessThan(
      text.indexOf("[FOLLOW-UP 1]"),
    );
  });

  it("feeds follow-ups into generic Analyze and emits suggested question chips", () => {
    const proposal = proposeFromHeuristics({
      title: "No.1 DG 3-way FO Outlet Valve",
      pastedText:
        "Please find attached CR-8 Trouble Report regarding valve failure.",
      attachments: [
        {
          attachmentId: "att_1",
          fileName: "CR-8.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 1,
          extractionStatus: "EXTRACTED",
          extractedContent:
            "[Sheet: OPEN(CR-8)]\nDefect,3-Way FO Outlet Valve failure",
        },
      ],
      followUps: [
        {
          followUpId: "fu_1",
          createdAt: "2026-08-28T06:00:00.000Z",
          text: "Temporary bypass in place; awaiting parts ETA.",
        },
      ],
    });
    expect(proposal.primaryCaseType).toBe("TECHNICAL");
    expect(proposal.brief.unverifiedFacts.some((f) =>
      f.text.includes("Temporary bypass"),
    )).toBe(true);
    expect(proposal.brief.suggestedQuestionsToVessel?.length).toBeGreaterThan(0);
    expect(
      proposal.brief.suggestedQuestionsToVessel?.some((q) =>
        /usable|temporary|parts|使用可否|修理|部品|通知|担当/i.test(q),
      ),
    ).toBe(true);
  });

  it("leaves Golden proposals unchanged when follow-ups are present", () => {
    const withFu = proposeFromHeuristics({
      title: "x",
      pastedText: "y",
      goldenCaseId: "GC01",
      followUps: [
        {
          followUpId: "fu_x",
          createdAt: "2026-08-28T00:00:00.000Z",
          text: "Should not appear in GC01",
        },
      ],
    });
    const base = proposeFromHeuristics({
      title: "x",
      pastedText: "y",
      goldenCaseId: "GC01",
    });
    expect(withFu.brief.recommendation).toBe(base.brief.recommendation);
    expect(withFu.brief.suggestedQuestionsToVessel).toBeUndefined();
  });
});
