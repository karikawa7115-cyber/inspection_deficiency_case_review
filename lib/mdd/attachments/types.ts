/** Intake Attachment Upload v0.1 — lightweight, schema-external provenance. */

export const EXTRACTION_STATUSES = [
  "READY",
  "EXTRACTING",
  "EXTRACTED",
  "PREVIEW_ONLY",
  "FAILED",
] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
  ".md",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export type SupportedAttachmentExtension =
  (typeof SUPPORTED_ATTACHMENT_EXTENSIONS)[number];

/**
 * Persisted on the Case (LocalStorage-safe): metadata + extracted text only.
 * Original binary is session-only and is not restored after refresh (v0.1).
 */
export type IntakeAttachmentRecord = {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractionStatus: ExtractionStatus;
  /** Readable extracted text when EXTRACTED; empty for PREVIEW_ONLY / FAILED. */
  extractedContent: string;
  /** Human-readable note (e.g. scanned PDF, image — no OCR). */
  extractionNote?: string;
  /** ISO timestamp of last extraction attempt. */
  extractedAt?: string;
};

/** Session-only UI state layered on top of persisted records. */
export type IntakeAttachmentSession = IntakeAttachmentRecord & {
  /** Object URL for image thumbnail; revoke on remove. Not persisted. */
  previewUrl?: string;
};
