import type { IntakeAttachmentRecord } from "./types";
import { SUPPORTED_ATTACHMENT_EXTENSIONS } from "./types";

const MAX_EXTRACTED_CHARS = 80_000;

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i).toLowerCase();
}

export function isSupportedAttachmentFileName(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return (SUPPORTED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext);
}

export function guessMimeType(fileName: string, fileType?: string): string {
  if (fileType && fileType.length > 0) return fileType;
  switch (extensionOf(fileName)) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".csv":
      return "text/csv";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateExtracted(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Truncated: extracted content exceeded ${MAX_EXTRACTED_CHARS} characters]`;
}

export function newAttachmentId(): string {
  return `att_${Math.random().toString(36).slice(2, 10)}`;
}

/** Strip session-only fields before LocalStorage write. */
export function toPersistedAttachment(
  a: IntakeAttachmentRecord & { previewUrl?: string },
): IntakeAttachmentRecord {
  return {
    attachmentId: a.attachmentId,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    extractionStatus: a.extractionStatus,
    extractedContent: a.extractedContent,
    extractionNote: a.extractionNote,
    extractedAt: a.extractedAt,
  };
}

/**
 * Build Analyze input with explicit source boundaries.
 * Does not invent content for FAILED / PREVIEW_ONLY beyond status notes.
 */
export function composeAnalyzeInput(input: {
  narrative: string;
  attachments: IntakeAttachmentRecord[];
}): string {
  const parts: string[] = [];
  parts.push("[INTAKE NARRATIVE]");
  parts.push(input.narrative.trim() || "(empty)");

  input.attachments.forEach((att, index) => {
    parts.push("");
    parts.push(`[ATTACHMENT ${index + 1}]`);
    parts.push(`Filename: ${att.fileName}`);
    parts.push(`Type: ${att.mimeType}`);
    parts.push(`Size: ${att.size}`);
    parts.push(`Extraction status: ${att.extractionStatus}`);
    if (att.extractionNote) {
      parts.push(`Note: ${att.extractionNote}`);
    }

    if (
      att.extractionStatus === "EXTRACTED" &&
      att.extractedContent.trim().length > 0
    ) {
      parts.push("");
      parts.push(att.extractedContent.trim());
    } else if (att.extractionStatus === "PREVIEW_ONLY") {
      parts.push("");
      parts.push(
        `(No semantic text extracted from this attachment. Preview/metadata only.)`,
      );
    } else if (att.extractionStatus === "FAILED") {
      parts.push("");
      parts.push(`(Extraction failed. Do not invent content for this file.)`);
    }
  });

  return parts.join("\n");
}

/** Lines suitable as unverified, attachment-sourced fact candidates. */
export function extractUnverifiedFactCandidates(
  attachments: IntakeAttachmentRecord[],
  opts?: { maxFacts?: number; maxLineLen?: number },
): { text: string; sourceLabel: string }[] {
  const maxFacts = opts?.maxFacts ?? 24;
  const maxLineLen = opts?.maxLineLen ?? 280;
  const out: { text: string; sourceLabel: string }[] = [];

  for (const att of attachments) {
    if (att.extractionStatus !== "EXTRACTED") continue;
    const content = att.extractedContent.trim();
    if (!content) continue;

    let currentSheet: string | undefined;
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const sheetMatch = /^\[Sheet:\s*(.+)\]$/i.exec(line);
      if (sheetMatch) {
        currentSheet = sheetMatch[1]?.trim();
        continue;
      }

      if (line.startsWith("[") && line.endsWith("]")) continue;
      if (line.length < 3) continue;

      const sourceLabel = currentSheet
        ? `Source: ${att.fileName} / Sheet ${currentSheet}`
        : `Source: ${att.fileName}`;

      const clipped =
        line.length > maxLineLen ? `${line.slice(0, maxLineLen)}…` : line;
      out.push({ text: `${clipped} (${sourceLabel})`, sourceLabel });
      if (out.length >= maxFacts) return out;
    }
  }

  return out;
}
