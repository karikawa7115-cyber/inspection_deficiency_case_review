/**
 * Attachment Evidence Normalization v0.2
 * Intermediate units with explicit source boundaries — no silent merge.
 */

import type { CaseFollowUp } from "../types";
import type { ExtractionStatus, IntakeAttachmentRecord } from "./types";
import { listSheetNamesFromExtracted } from "./compose-analyze-input";

export type EvidenceSourceType =
  | "intake_narrative"
  | "attachment_sheet"
  | "attachment_text"
  | "follow_up"
  | "embedded_image_ref";

export type EvidenceVerificationStatus =
  | "reported_unverified"
  | "metadata_only"
  | "failed";

export type AttachmentEvidenceUnit = {
  sourceType: EvidenceSourceType;
  sourceFileName?: string;
  sheetName?: string;
  section?: string;
  extractedText: string;
  embeddedImageRefs?: string[];
  extractionStatus: ExtractionStatus | "NARRATIVE" | "FOLLOW_UP";
  verificationStatus: EvidenceVerificationStatus;
  /** Heuristic confidence of extraction fidelity — not operational truth. */
  sourceConfidence: "high" | "medium" | "low";
};

function sheetBlocks(
  content: string,
): { sheetName?: string; text: string }[] {
  const lines = content.split(/\r?\n/);
  const blocks: { sheetName?: string; text: string }[] = [];
  let currentName: string | undefined;
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text || currentName) {
      blocks.push({ sheetName: currentName, text });
    }
    buf = [];
  };

  for (const raw of lines) {
    const m = /^\[Sheet:\s*(.+)\]$/i.exec(raw.trim());
    if (m) {
      flush();
      currentName = m[1]?.trim();
      continue;
    }
    buf.push(raw);
  }
  flush();

  if (blocks.length === 0 && content.trim()) {
    return [{ text: content.trim() }];
  }
  return blocks;
}

/**
 * Build normalized evidence units. Narrative, sheets, follow-ups stay separate.
 * Embedded image semantics are not invented here (vision deferred).
 */
export function normalizeAnalyzeEvidence(input: {
  narrative: string;
  attachments: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
}): AttachmentEvidenceUnit[] {
  const units: AttachmentEvidenceUnit[] = [];
  const narrative = input.narrative.trim();
  if (narrative) {
    units.push({
      sourceType: "intake_narrative",
      extractedText: narrative,
      extractionStatus: "NARRATIVE",
      verificationStatus: "reported_unverified",
      sourceConfidence: "high",
    });
  }

  const followUps = input.followUps ?? [];
  const linkedIds = new Set(followUps.flatMap((f) => f.attachmentIds ?? []));

  for (const att of input.attachments) {
    if (att.extractionStatus === "EXTRACTED" && att.extractedContent.trim()) {
      const sheets = listSheetNamesFromExtracted(att.extractedContent);
      const blocks = sheetBlocks(att.extractedContent);
      if (sheets.length > 0) {
        for (const block of blocks) {
          if (!block.text.trim() && !block.sheetName) continue;
          units.push({
            sourceType: "attachment_sheet",
            sourceFileName: att.fileName,
            sheetName: block.sheetName,
            extractedText: block.text,
            extractionStatus: att.extractionStatus,
            verificationStatus: "reported_unverified",
            sourceConfidence: "high",
          });
        }
      } else {
        units.push({
          sourceType: "attachment_text",
          sourceFileName: att.fileName,
          extractedText: att.extractedContent.trim(),
          extractionStatus: att.extractionStatus,
          verificationStatus: "reported_unverified",
          sourceConfidence: "high",
        });
      }
    } else if (att.extractionStatus === "PREVIEW_ONLY") {
      units.push({
        sourceType: "attachment_text",
        sourceFileName: att.fileName,
        extractedText: att.extractionNote ?? "(preview only — no text)",
        extractionStatus: att.extractionStatus,
        verificationStatus: "metadata_only",
        sourceConfidence: "low",
      });
    } else if (att.extractionStatus === "FAILED") {
      units.push({
        sourceType: "attachment_text",
        sourceFileName: att.fileName,
        extractedText: att.extractionNote ?? "(extraction failed)",
        extractionStatus: att.extractionStatus,
        verificationStatus: "failed",
        sourceConfidence: "low",
      });
    }

    // Detect deferred vision hint from extraction notes (no invented visuals).
    if (
      att.extractionNote?.toLowerCase().includes("embedded image") ||
      att.extractionNote?.toLowerCase().includes("xl/media")
    ) {
      units.push({
        sourceType: "embedded_image_ref",
        sourceFileName: att.fileName,
        extractedText:
          "Embedded workbook images detected; visual semantic analysis is deferred in v0.2.",
        embeddedImageRefs: ["deferred"],
        extractionStatus: att.extractionStatus,
        verificationStatus: "metadata_only",
        sourceConfidence: "low",
      });
    }
  }

  followUps.forEach((fu, i) => {
    const label = fu.authorLabel?.trim()
      ? `Follow-up ${i + 1} (${fu.authorLabel.trim()})`
      : `Follow-up ${i + 1}`;
    if (fu.text.trim()) {
      units.push({
        sourceType: "follow_up",
        section: label,
        extractedText: fu.text.trim(),
        extractionStatus: "FOLLOW_UP",
        verificationStatus: "reported_unverified",
        sourceConfidence: "medium",
      });
    }
    for (const id of fu.attachmentIds ?? []) {
      if (!linkedIds.has(id)) continue;
      // Attachment units already added above; no duplicate merge.
    }
  });

  return units;
}

export function evidenceSourceLabel(unit: AttachmentEvidenceUnit): string {
  if (unit.sourceType === "intake_narrative") return "Source: Intake narrative";
  if (unit.sourceType === "follow_up") {
    return `Source: ${unit.section ?? "Follow-up"}`;
  }
  if (unit.sourceType === "embedded_image_ref") {
    return `Source: ${unit.sourceFileName ?? "attachment"} (embedded image — deferred)`;
  }
  if (unit.sheetName && unit.sourceFileName) {
    return `Source: ${unit.sourceFileName} / Sheet ${unit.sheetName}`;
  }
  if (unit.sourceFileName) return `Source: ${unit.sourceFileName}`;
  return "Source: attachment";
}

/** Flat searchable corpus with boundaries preserved in labels only. */
export function evidenceSearchBlob(units: AttachmentEvidenceUnit[]): string {
  return units
    .map((u) => `${evidenceSourceLabel(u)}\n${u.extractedText}`)
    .join("\n\n")
    .toLowerCase();
}
