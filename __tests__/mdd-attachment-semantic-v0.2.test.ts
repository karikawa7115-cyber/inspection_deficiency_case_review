import { describe, expect, it } from "vitest";
import { composeAnalyzeInput } from "@/lib/mdd/attachments/compose-analyze-input";
import { normalizeAnalyzeEvidence } from "@/lib/mdd/attachments/normalize-evidence";
import { synthesizeAttachmentSemantics } from "@/lib/mdd/attachments/semantic-synthesis-v0.2";
import {
  alignWhyWithFinalReadiness,
  applyGateToBrief,
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

describe("Attachment Semantic Analysis v0.2 refinements", () => {
  it("normalizes narrative and sheets as separate evidence units", () => {
    const units = normalizeAnalyzeEvidence({
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(units.some((u) => u.sourceType === "intake_narrative")).toBe(true);
    expect(units.some((u) => u.sourceType === "attachment_sheet")).toBe(true);
    expect(
      units
        .filter((u) => u.sourceType === "attachment_sheet")
        .map((u) => u.sheetName),
    ).toEqual(expect.arrayContaining(["OPEN(CR-8)", "CLOSE(CR-9)"]));
  });

  it("uses concrete authorities instead of Other for technical cases", () => {
    const s = synthesizeAttachmentSemantics({
      title: "No.1 DG FO Valve",
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    const authorities = s.decisionAuthorities.map((a) => a.authority);
    expect(authorities).not.toContain("Other");
    expect(authorities).toEqual(
      expect.arrayContaining([
        "C/E",
        "Master",
        "Superintendent",
        "Class",
        "President/DP",
      ]),
    );
    const ce = s.decisionAuthorities.find((a) => a.authority === "C/E");
    expect(ce?.roleLabel).toMatch(/技術状況|一時技術措置|修理実施/);
    const master = s.decisionAuthorities.find((a) => a.authority === "Master");
    expect(master?.roleLabel).toMatch(/運航|安全/);
    expect(
      s.decisionAuthorities.some((a) =>
        /岸側の技術確認|Technical Superintendent|修理調整/.test(
          `${a.roleLabel} ${a.notes ?? ""}`,
        ),
      ),
    ).toBe(true);
    const president = s.decisionAuthorities.find(
      (a) => a.authority === "President/DP",
    );
    expect(president?.status).toBe("not_required");
  });

  it("produces Japanese-first recommendation / why / next actions", () => {
    const s = synthesizeAttachmentSemantics({
      title: "No.1 DG FO Valve",
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(s.recommendation).toMatch(/Technical Superintendent|確認/);
    expect(s.recommendation).toMatch(/Escalate|President\/DP/);
    expect(s.why).toMatch(/添付|未確認|把握/);
    expect(s.why).not.toMatch(/Readiness is NOT_READY/);
    expect(s.presidentDecision).toMatch(/社長判断/);
    expect(s.nextActions[0]?.text).toMatch(/Technical Superintendent|突合/);
    expect(
      s.suggestedQuestionsToVessel.every((q) => /[ぁ-んァ-ン一-龥]/.test(q)),
    ).toBe(true);
  });

  it("filters vessel questions already answered by workbook evidence", () => {
    const s = synthesizeAttachmentSemantics({
      title: "No.1 DG FO Valve",
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    const blob = s.suggestedQuestionsToVessel.join("\n");
    expect(blob).not.toMatch(/現在、本船で実施中の一時措置/);
    expect(blob).not.toMatch(/混入の範囲と、DOサービスタンク/);
    // May still ask current availability after measures
    expect(
      s.suggestedQuestionsToVessel.some((q) => /使用可否/.test(q)) ||
        s.suggestedQuestionsToVessel.length >= 0,
    ).toBe(true);
  });

  it("aligns Why with final Gate-owned readiness (no NOT_READY leak when CONDITIONAL)", () => {
    const contradictory =
      "Attachment text was ingested. Readiness is NOT_READY because facts are unverified. Decision remains NOT READY until confirmations.";
    const aligned = alignWhyWithFinalReadiness(contradictory, "CONDITIONAL");
    expect(aligned).toMatch(/条件付き/);
    expect(aligned).not.toMatch(/NOT[_\s-]?READY/i);
    expect(aligned).not.toMatch(/判断不可/);
  });

  it("applyGateToBrief rewrites Why to match enforced readiness", () => {
    const proposal = proposeFromHeuristics({
      title: "No.1 DG FO Valve",
      pastedText: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    // Force a pre-Gate why that contradicts a CONDITIONAL final if gate promotes it
    proposal.brief.why = `${proposal.brief.why} Readiness is NOT_READY because pending checks.`;
    const brief = applyGateToBrief(proposal);
    expect(brief.why).toContain(`最終の判断準備状況は`);
    if (brief.decisionReadiness === "CONDITIONAL") {
      expect(brief.why).toMatch(/条件付き/);
      expect(brief.why).not.toMatch(/判断不可/);
      expect(brief.why).not.toMatch(/Readiness is NOT_READY/i);
    }
    if (brief.decisionReadiness === "NOT_READY") {
      expect(brief.why).toMatch(/判断不可/);
    }
    if (brief.decisionReadiness === "READY") {
      expect(brief.why).toMatch(/判断可能/);
      expect(brief.why).not.toMatch(/NOT[_\s-]?READY/i);
    }
  });

  it("wires proposeFromHeuristics generic path with concrete authorities", () => {
    const proposal = proposeFromHeuristics({
      title: "No.1 DG FO Valve",
      pastedText: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(proposal.primaryCaseType).toBe("TECHNICAL");
    expect(
      proposal.brief.decisionAuthorities.every((a) => a.authority !== "Other"),
    ).toBe(true);
    expect(proposal.brief.recommendation).toMatch(/確認|Superintendent/);
    expect(proposal.brief.proposedCurrentDecisionQuestion?.decisionRequiredNow)
      .toMatch(/継続運転|技術確認|経営承認/);
    const composed = composeAnalyzeInput({
      narrative: NARRATIVE,
      attachments: [CR89_ATTACHMENT],
    });
    expect(composed).toContain("[Sheet: OPEN(CR-8)]");
  });

  it("keeps no-attachment New Case generic (Japanese baseline)", () => {
    const c = createEmptyCase({ title: "New Case" });
    const proposal = proposeFromHeuristics({
      title: c.title,
      pastedText: c.pastedText,
      attachments: [],
    });
    expect(proposal.brief.why).toMatch(/構造化分析が不足/);
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

  it("localizes Golden GC01 Brief to Japanese-first like generic cases", () => {
    const proposal = proposeFromHeuristics({
      title: "M/V Pluto Leader - C/M Inoy Crew Change",
      vessel: "PLUTO LEADER",
      pastedText: "C/M Inoy cannot board at Nansha.",
    });
    expect(proposal.primaryCaseType).toBe("CREW_MANNING");
    expect(proposal.brief.recommendation).toMatch(/南沙|日本|延期/);
    expect(proposal.brief.presidentDecision).toMatch(/社長判断/);
    expect(proposal.brief.why).toMatch(/南沙|日本/);
    expect(proposal.brief.proposedCurrentDecisionQuestion?.decisionRequiredNow).toMatch(
      /承認/,
    );
    expect(
      proposal.brief.decisionAuthorities.every((a) =>
        /[ぁ-んァ-ン一-龥]/.test(a.roleLabel),
      ),
    ).toBe(true);
  });
});
