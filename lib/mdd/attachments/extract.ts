import type { ExtractionStatus } from "./types";
import {
  extensionOf,
  truncateExtracted,
} from "./compose-analyze-input";

export type ExtractionResult = {
  status: ExtractionStatus;
  content: string;
  note?: string;
};

function emptyPreview(note: string): ExtractionResult {
  return { status: "PREVIEW_ONLY", content: "", note };
}

function failed(note: string): ExtractionResult {
  return { status: "FAILED", content: "", note };
}

function extracted(content: string, note?: string): ExtractionResult {
  const trimmed = truncateExtracted(content.trim());
  if (!trimmed) {
    return emptyPreview(note ?? "No readable text found in file.");
  }
  return { status: "EXTRACTED", content: trimmed, note };
}

/** Browser + jsdom-safe binary read. */
async function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("FileReader did not return ArrayBuffer"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsArrayBuffer(file);
  });
}

/** Browser + jsdom-safe text read. */
async function readAsText(file: Blob): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsText(file);
  });
}

async function extractPlainText(file: File): Promise<ExtractionResult> {
  try {
    const text = await readAsText(file);
    return extracted(text);
  } catch (e) {
    return failed(e instanceof Error ? e.message : "Failed to read text file");
  }
}

async function extractSpreadsheet(file: File): Promise<ExtractionResult> {
  try {
    const XLSX = await import("xlsx");
    const buf = await readAsArrayBuffer(file);
    if (!buf || buf.byteLength === 0) {
      return failed("Spreadsheet file is empty or unreadable.");
    }
    const workbook = XLSX.read(buf, { type: "array", cellDates: true });
    const parts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      parts.push(`[Sheet: ${sheetName}]`);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        parts.push("(empty sheet)");
        parts.push("");
        continue;
      }
      // Readable grid — preserves visible cell content without interpreting.
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      const lines = csv
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.replace(/,/g, "").trim().length > 0);
      if (lines.length === 0) {
        parts.push("(no visible cell content)");
      } else {
        parts.push(...lines);
      }
      parts.push("");
    }

    return extracted(parts.join("\n").trim());
  } catch (e) {
    return failed(
      e instanceof Error ? e.message : "Failed to extract spreadsheet",
    );
  }
}

async function extractDocx(file: File): Promise<ExtractionResult> {
  try {
    const mammothMod = await import("mammoth");
    const mammoth =
      "default" in mammothMod && mammothMod.default
        ? mammothMod.default
        : mammothMod;
    const buf = await readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return extracted(result.value ?? "");
  } catch (e) {
    return failed(e instanceof Error ? e.message : "Failed to extract DOCX");
  }
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Prefer packaged worker; fall back if bundler blocks it.
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    } catch {
      // workerSrc optional in some test environments
    }

    const data = new Uint8Array(await readAsArrayBuffer(file));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => {
          if (typeof item === "object" && item && "str" in item) {
            return String((item as { str: string }).str);
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) {
        pages.push(`[Page ${pageNum}]`);
        pages.push(pageText);
        pages.push("");
      }
    }

    const joined = pages.join("\n").trim();
    if (!joined) {
      return emptyPreview(
        "PDF has little or no extractable text layer (likely scanned). Marked PREVIEW_ONLY — no OCR in v0.1.",
      );
    }
    if (joined.length < 40 && pdf.numPages >= 1) {
      return emptyPreview(
        "PDF text layer is too sparse to trust. Marked PREVIEW_ONLY — no OCR in v0.1.",
      );
    }
    return extracted(joined);
  } catch (e) {
    return failed(e instanceof Error ? e.message : "Failed to extract PDF");
  }
}

function extractImagePreviewOnly(): ExtractionResult {
  return emptyPreview(
    "Image attached for reference. No OCR/vision extraction in v0.1 (PREVIEW_ONLY).",
  );
}

/**
 * Client-side extraction. Does not invent content; fails closed to FAILED / PREVIEW_ONLY.
 */
export async function extractAttachmentContent(
  file: File,
): Promise<ExtractionResult> {
  const ext = extensionOf(file.name);

  switch (ext) {
    case ".csv":
    case ".txt":
    case ".md":
      return extractPlainText(file);
    case ".xlsx":
    case ".xls":
      return extractSpreadsheet(file);
    case ".docx":
      return extractDocx(file);
    case ".pdf":
      return extractPdf(file);
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".webp":
      return extractImagePreviewOnly();
    default:
      return failed(`Unsupported file type: ${ext || "(none)"}`);
  }
}
