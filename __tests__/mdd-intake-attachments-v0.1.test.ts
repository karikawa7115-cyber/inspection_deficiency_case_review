import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  composeAnalyzeInput,
  extractUnverifiedFactCandidates,
  isSupportedAttachmentFileName,
  listSheetNamesFromExtracted,
} from "@/lib/mdd/attachments/compose-analyze-input";
import { extractAttachmentContent } from "@/lib/mdd/attachments/extract";
import {
  createEmptyCase,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import type { IntakeAttachmentRecord } from "@/lib/mdd/attachments/types";

function makeXlsxFile(): File {
  const wb = XLSX.utils.book_new();
  const openRows = [
    ["Trouble Report", "CR-8"],
    ["Equipment", "No. 1 Diesel Generator"],
    ["Defect", "3-Way FO Outlet Valve failure"],
    ["Consequence", "Contamination of diesel oil (DO) with VLSFO"],
    ["Tank", "No. 1 DO Service Tank"],
    ["Date", "24-Aug-2026"],
  ];
  const openSheet = XLSX.utils.aoa_to_sheet(openRows);
  XLSX.utils.book_append_sheet(wb, openSheet, "OPEN(CR-8)");
  const closeSheet = XLSX.utils.aoa_to_sheet([
    ["Status", "OPEN"],
    ["Follow-up", "Pending shore review"],
  ]);
  XLSX.utils.book_append_sheet(wb, closeSheet, "CLOSE(CR-9)");
  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as
    | ArrayBuffer
    | Uint8Array;
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new File(
    [ab],
    "CR-8,9 Trouble report form (open and close) 【No. 1 Diesel GE 3 way FO Outlet Valve Defective】24-Aug-2026.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
}

describe("Intake Attachment Upload v0.1", () => {
  it("accepts supported extensions only", () => {
    expect(isSupportedAttachmentFileName("a.xlsx")).toBe(true);
    expect(isSupportedAttachmentFileName("a.pdf")).toBe(true);
    expect(isSupportedAttachmentFileName("a.exe")).toBe(false);
  });

  it("composes Analyze input with explicit source boundaries", () => {
    const narrative =
      "Please find attached CR-8 Trouble Report regarding the No. 1 Diesel Generator 3-Way FO Outlet Valve failure, which resulted in the contamination of diesel oil (DO) with VLSFO in the No. 1 DO Service Tank.";
    const attachments: IntakeAttachmentRecord[] = [
      {
        attachmentId: "att_1",
        fileName: "CR-8 Trouble Report.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1234,
        extractionStatus: "EXTRACTED",
        extractedContent:
          "[Sheet: OPEN(CR-8)]\nEquipment,No. 1 Diesel Generator\nDefect,3-Way FO Outlet Valve failure",
      },
    ];
    const text = composeAnalyzeInput({ narrative, attachments });
    expect(text).toContain("[INTAKE NARRATIVE]");
    expect(text).toContain(narrative);
    expect(text).toContain("[ATTACHMENT 1]");
    expect(text).toContain("Filename: CR-8 Trouble Report.xlsx");
    expect(text).toContain("Extraction status: EXTRACTED");
    expect(text).toContain("[Sheet: OPEN(CR-8)]");
    expect(text).toContain("3-Way FO Outlet Valve failure");
    // Narrative and attachment are not silently merged into one unlabeled blob
    expect(text.indexOf("[INTAKE NARRATIVE]")).toBeLessThan(
      text.indexOf("[ATTACHMENT 1]"),
    );
  });

  it("does not invent content for FAILED / PREVIEW_ONLY", () => {
    const text = composeAnalyzeInput({
      narrative: "See photo.",
      attachments: [
        {
          attachmentId: "att_img",
          fileName: "valve.jpg",
          mimeType: "image/jpeg",
          size: 10,
          extractionStatus: "PREVIEW_ONLY",
          extractedContent: "",
          extractionNote: "No OCR",
        },
        {
          attachmentId: "att_bad",
          fileName: "broken.pdf",
          mimeType: "application/pdf",
          size: 10,
          extractionStatus: "FAILED",
          extractedContent: "",
          extractionNote: "parse error",
        },
      ],
    });
    expect(text).toContain("No semantic text extracted");
    expect(text).toContain("Extraction failed");
    expect(text).not.toContain("invented valve failure");
  });

  it("extracts spreadsheet sheets and cells without hard-coded CR-8 facts in extractor", async () => {
    const file = makeXlsxFile();
    expect(file.size).toBeGreaterThan(0);
    const result = await extractAttachmentContent(file);
    expect(result, result.note).toMatchObject({ status: "EXTRACTED" });
    expect(result.content).toContain("[Sheet: OPEN(CR-8)]");
    expect(result.content).toContain("[Sheet: CLOSE(CR-9)]");
    expect(result.content).toMatch(/Diesel Generator/i);
    expect(result.content).toMatch(/3-Way FO Outlet Valve/i);
    expect(result.content).toMatch(/VLSFO/i);
  });

  it("feeds attachment facts into generic Analyze as unverified, not confirmed", () => {
    const narrative =
      "Please find attached CR-8 Trouble Report regarding the No. 1 Diesel Generator 3-Way FO Outlet Valve failure.";
    const attachments: IntakeAttachmentRecord[] = [
      {
        attachmentId: "att_1",
        fileName: "CR-8 Trouble Report.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 2000,
        extractionStatus: "EXTRACTED",
        extractedContent: [
          "[Sheet: OPEN(CR-8)]",
          "Equipment,No. 1 Diesel Generator",
          "Defect,3-Way FO Outlet Valve failure",
          "Consequence,Contamination of diesel oil (DO) with VLSFO",
        ].join("\n"),
      },
    ];
    const proposal = proposeFromHeuristics({
      title: "DG FO Valve Trouble",
      pastedText: narrative,
      attachments,
    });
    expect(proposal.primaryCaseType).toBe("TECHNICAL");
    expect(proposal.brief.unverifiedFacts.length).toBeGreaterThan(0);
    const unverifiedBlob = proposal.brief.unverifiedFacts
      .map((f) => f.text)
      .join("\n");
    expect(unverifiedBlob).toMatch(/FO Outlet Valve/i);
    expect(
      proposal.brief.unverifiedFacts.some((f) =>
        (f.evidenceRequired ?? "").includes("CR-8 Trouble Report.xlsx"),
      ),
    ).toBe(true);
    // Attachment lines must not be auto-promoted to confirmed operational facts
    const confirmedBlob = proposal.brief.confirmedFacts
      .map((f) => f.text)
      .join("\n");
    expect(confirmedBlob).not.toMatch(/Contamination of diesel oil/);
    expect(["NOT_READY", "CONDITIONAL"]).toContain(
      proposal.brief.decisionReadiness,
    );
    expect(proposal.brief.learning.notes ?? "").toMatch(/Semantic Analysis v0\.2|source boundaries/i);
  });

  it("leaves Golden Case proposals unchanged when goldenCaseId is set", () => {
    const withAtt = proposeFromHeuristics({
      title: "anything",
      pastedText: "noise",
      goldenCaseId: "GC01",
      attachments: [
        {
          attachmentId: "att_x",
          fileName: "noise.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 1,
          extractionStatus: "EXTRACTED",
          extractedContent:
            "[Sheet: OPEN(CR-8)]\nFake,Should not appear in GC01 brief",
        },
      ],
    });
    const baseline = proposeFromHeuristics({
      title: "anything",
      pastedText: "noise",
      goldenCaseId: "GC01",
    });
    expect(withAtt.primaryCaseType).toBe(baseline.primaryCaseType);
    expect(withAtt.brief.recommendation).toBe(baseline.brief.recommendation);
    expect(withAtt.brief.presidentDecision).toBe(
      baseline.brief.presidentDecision,
    );
    const blob = withAtt.brief.unverifiedFacts.map((f) => f.text).join("\n");
    expect(blob).not.toContain("Should not appear");
  });

  it("keeps empty New Case without attachments working", () => {
    const c = createEmptyCase({ title: "New Case" });
    expect(c.attachments).toEqual([]);
    const proposal = proposeFromHeuristics({
      title: c.title,
      pastedText: c.pastedText,
      attachments: c.attachments,
    });
    expect(proposal.brief.decisionReadiness).toBe("NOT_READY");
    expect(proposal.brief.unverifiedFacts).toEqual([]);
  });

  it("builds unverified candidates with sheet source labels", () => {
    const facts = extractUnverifiedFactCandidates([
      {
        attachmentId: "a1",
        fileName: "report.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1,
        extractionStatus: "EXTRACTED",
        extractedContent:
          "[Sheet: OPEN(CR-8)]\nValve defective on FO outlet\n[Sheet: CLOSE]\nPending",
      },
    ]);
    expect(facts[0]?.sourceLabel).toContain("Sheet OPEN(CR-8)");
    expect(facts.some((f) => f.text.includes("Valve defective"))).toBe(true);
  });

  it("lists sheet names from extracted spreadsheet boundaries", () => {
    expect(
      listSheetNamesFromExtracted(
        "[Sheet: OPEN(CR-8)]\nA,B\n[Sheet: CLOSE(CR-9)]\nC,D",
      ),
    ).toEqual(["OPEN(CR-8)", "CLOSE(CR-9)"]);
  });

  it("shows generic why when Analyze receives no extracted attachments", () => {
    const proposal = proposeFromHeuristics({
      title: "DG FO Valve",
      pastedText: "Please find attached CR-8 trouble report.",
      attachments: [],
    });
    expect(proposal.brief.why).toMatch(/構造化分析が不足|Insufficient structured analysis/i);
  });

  it("does not show generic why when EXTRACTED spreadsheet reaches Analyze", () => {
    const proposal = proposeFromHeuristics({
      title: "DG FO Valve",
      pastedText: "Please find attached CR-8 trouble report.",
      attachments: [
        {
          attachmentId: "att_1",
          fileName: "CR-8,9 Trouble report.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 2000,
          extractionStatus: "EXTRACTED",
          extractedContent: [
            "[Sheet: OPEN(CR-8)]",
            "Equipment,No. 1 Diesel Generator",
            "Defect,3-Way FO Outlet Valve failure",
            "Consequence,Contamination of diesel oil (DO) with VLSFO",
            "Temporary measure,FO line isolated",
          ].join("\n"),
        },
      ],
    });
    expect(proposal.brief.why).not.toMatch(
      /Insufficient structured analysis|構造化分析が不足/i,
    );
    expect(proposal.brief.recommendation).toMatch(/Superintendent|確認/);
    expect(proposal.brief.proposedCurrentDecisionQuestion?.decisionRequiredNow).toBeTruthy();
    expect(proposal.brief.presidentDecision).toMatch(/社長判断|Escalate/);
    expect(
      proposal.brief.decisionAuthorities.every((a) => a.authority !== "Other"),
    ).toBe(true);
  });

  it("preserves attachments when merging intake field updates onto latest case", () => {
    // Mirrors the fixed Case Intake patch pattern (functional merge onto latest).
    type MiniCase = {
      title: string;
      pastedText: string;
      attachments: IntakeAttachmentRecord[];
    };
    let caseData: MiniCase = {
      title: "New",
      pastedText: "narrative",
      attachments: [],
    };
    const att: IntakeAttachmentRecord = {
      attachmentId: "att_live",
      fileName: "CR-8.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 10,
      extractionStatus: "EXTRACTED",
      extractedContent: "[Sheet: OPEN(CR-8)]\nValve,defective",
    };
    // Attachment lands first (as onChange functional update does).
    caseData = { ...caseData, attachments: [att] };
    // Stale-style update (bug): spread a snapshot taken before attach → wipes.
    const staleSnapshot: MiniCase = {
      title: "New",
      pastedText: "narrative",
      attachments: [],
    };
    const wiped = { ...staleSnapshot, pastedText: "narrative updated" };
    expect(wiped.attachments).toHaveLength(0);
    // Fixed pattern: merge onto latest.
    const patch = (updater: (prev: MiniCase) => MiniCase) => {
      caseData = updater(caseData);
    };
    caseData = { ...caseData, attachments: [att] };
    patch((prev) => ({ ...prev, pastedText: "narrative updated" }));
    expect(caseData.attachments).toHaveLength(1);
    expect(caseData.attachments[0]?.fileName).toBe("CR-8.xlsx");
    expect(caseData.pastedText).toBe("narrative updated");
  });
});
