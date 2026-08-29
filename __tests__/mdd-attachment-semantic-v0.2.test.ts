import { describe, expect, it } from "vitest";
import { composeAnalyzeInput } from "@/lib/mdd/attachments/compose-analyze-input";
import { normalizeAnalyzeEvidence } from "@/lib/mdd/attachments/normalize-evidence";
import { synthesizeAttachmentSemantics } from "@/lib/mdd/attachments/semantic-synthesis-v0.2";
import {
  createEmptyCase,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import type { IntakeAttachmentRecord } from "@/lib/mdd/attachments/types";

const CR89_ATTACHMENT: IntakeAttachmentRecord = {
  attachmentId: "att_cr89",
  fileName:
    "CR-8,9 Trouble report form (open and close) 【No. 1 Diesel GE 3 way FO Outlet Valve Defective】24-Aug-2026.xlsx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  size: 50000,
  extractionStatus: "EXTRACTED",
  extractedContent: [
    "[Sheet: OPEN(CR-8)]",
    "Trouble Report,CR-8",
    "Equipment,No. 1 Diesel Generator",
    "Defect,3-Way FO Outlet Valve failure",
    "Consequence,Contamination of diesel oil (DO) with VLSFO in No. 1 DO Service Tank",
    "Temporary measure,FO line isolated / contingency in place",
    "Status,OPEN",
    "[Sheet: CLOSE(CR-9)]",
    "Status,OPEN",
    "Follow-up,Pending shore review",
  ].join("\n"),
};

const NARRATIVE =
  "Please find attached CR-8 Trouble Report regarding the No. 1 Diesel Generator 3-Way FO Outlet Valve failure, which resulted in the contamination of diesel oil (DO) with VLSFO in the No. 1 DO Service Tank.";

describe("Attachment Semantic Analysis v0.2", () => {
  it("normalizes narrative and sheets as separate evidence units", () => {
    const units = normalizeAnalyzeEvidence({
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(units.some((u) => u.sourceType === "intake_narrative")).toBe(true);
    expect(units.some((u) => u.sourceType === "attachment_sheet")).toBe(true);
    expect(
      units.filter((u) => u.sourceType === "attachment_sheet").map((u) => u.sheetName),
    ).toEqual(expect.arrayContaining(["OPEN(CR-8)", "CLOSE(CR-9)"]));
  });

  it("proposes a Current Decision Question and technical recommendation", () => {
    const s = synthesizeAttachmentSemantics({
      title: "No.1 DG FO Valve",
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(s.caseTypeHint).toBe("TECHNICAL");
    expect(s.hasMaterialAttachmentText).toBe(true);
    expect(s.proposedDecisionQuestion.decisionRequiredNow).toMatch(
      /continued operation|temporary measures|repair/i,
    );
    expect(s.recommendation).toMatch(/Superintendent/i);
    expect(s.recommendation).not.toMatch(/^Organize facts/i);
    expect(s.presidentDecision).toMatch(/Not required at this stage|Escalate only/i);
    expect(s.materialReportedFacts.length).toBeGreaterThan(0);
    expect(
      s.materialReportedFacts.some((f) =>
        /Source: .*Sheet OPEN\(CR-8\)/i.test(f.sourceLabel),
      ),
    ).toBe(true);
  });

  it("filters suggested questions already covered by workbook evidence", () => {
    const s = synthesizeAttachmentSemantics({
      title: "No.1 DG FO Valve",
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    // temporary measures language present → should not ask the stock temporary question
    expect(
      s.suggestedQuestionsToVessel.some((q) =>
        /temporary \/ contingency measures are in place/i.test(q),
      ),
    ).toBe(false);
  });

  it("wires proposeFromHeuristics generic path to semantic v0.2", () => {
    const proposal = proposeFromHeuristics({
      title: "No.1 DG FO Valve",
      pastedText: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(proposal.primaryCaseType).toBe("TECHNICAL");
    expect(proposal.tags).toContain("semantic_v0_2");
    expect(proposal.brief.why).not.toMatch(/Insufficient structured analysis/i);
    expect(proposal.brief.proposedCurrentDecisionQuestion?.decisionRequiredNow)
      .toBeTruthy();
    expect(
      proposal.brief.unverifiedFacts.some((f) =>
        (f.evidenceRequired ?? "").includes("Sheet OPEN(CR-8)"),
      ),
    ).toBe(true);
    expect(
      proposal.brief.missingInformation.every(
        (m) => m.who || m.what || m.evidenceRequired,
      ),
    ).toBe(true);
    const composed = composeAnalyzeInput({
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(composed).toContain("[ATTACHMENT 1]");
    expect(composed).toContain("[Sheet: OPEN(CR-8)]");
  });

  it("keeps no-attachment New Case generic", () => {
    const c = createEmptyCase({ title: "New Case" });
    const proposal = proposeFromHeuristics({
      title: c.title,
      pastedText: c.pastedText,
      attachments: [],
    });
    expect(proposal.brief.why).toMatch(/Insufficient structured analysis/i);
    expect(proposal.brief.proposedCurrentDecisionQuestion).toBeUndefined();
    expect(proposal.tags).not.toContain("semantic_v0_2");
  });

  it("does not alter Golden Case proposals", () => {
    const withAtt = proposeFromHeuristics({
      title: "anything",
      pastedText: "noise",
      goldenCaseId: "GC01",
      attachments: [CR89_ATTACHMENT],
    });
    const baseline = proposeFromHeuristics({
      title: "anything",
      pastedText: "noise",
      goldenCaseId: "GC01",
    });
    expect(withAtt.brief.recommendation).toBe(baseline.brief.recommendation);
    expect(withAtt.tags).not.toContain("semantic_v0_2");
  });
});
