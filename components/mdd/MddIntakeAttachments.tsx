"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  extractAttachmentContent,
  formatFileSize,
  guessMimeType,
  isSupportedAttachmentFileName,
  newAttachmentId,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
  toPersistedAttachment,
  type ExtractionStatus,
  type IntakeAttachmentRecord,
  type IntakeAttachmentSession,
} from "@/lib/mdd/attachments";
import { cn } from "@/lib/utils";
import { ChevronDown, FileText, Trash2, Upload } from "lucide-react";

const ACCEPT = SUPPORTED_ATTACHMENT_EXTENSIONS.join(",");

function statusVariant(
  status: ExtractionStatus,
): "secondary" | "success" | "warning" | "destructive" | "neutral" {
  switch (status) {
    case "EXTRACTED":
      return "success";
    case "EXTRACTING":
    case "READY":
      return "secondary";
    case "PREVIEW_ONLY":
      return "warning";
    case "FAILED":
      return "destructive";
    default:
      return "neutral";
  }
}

type Props = {
  attachments: IntakeAttachmentRecord[];
  onChange: (next: IntakeAttachmentRecord[]) => void;
  disabled?: boolean;
  /** Section heading — default "Attachments" */
  title?: string;
  /** Hide long persistence note (follow-up draft) */
  compact?: boolean;
};

export function MddIntakeAttachments({
  attachments,
  onChange,
  disabled,
  title = "Attachments",
  compact = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);
  const [dragging, setDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const replaceAll = useCallback(
    (next: IntakeAttachmentRecord[]) => {
      attachmentsRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const patchOne = useCallback(
    (row: IntakeAttachmentRecord) => {
      const next = attachmentsRef.current.map((a) =>
        a.attachmentId === row.attachmentId ? row : a,
      );
      if (!next.some((a) => a.attachmentId === row.attachmentId)) {
        next.push(row);
      }
      replaceAll(next);
    },
    [replaceAll],
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      setError(null);
      const list = Array.from(files);
      const unsupported = list.filter(
        (f) => !isSupportedAttachmentFileName(f.name),
      );
      if (unsupported.length > 0) {
        setError(
          `Unsupported: ${unsupported.map((f) => f.name).join(", ")}. Supported: ${SUPPORTED_ATTACHMENT_EXTENSIONS.join(", ")}`,
        );
      }
      const supported = list.filter((f) =>
        isSupportedAttachmentFileName(f.name),
      );
      if (supported.length === 0) return;

      for (const file of supported) {
        const attachmentId = newAttachmentId();
        const mimeType = guessMimeType(file.name, file.type);
        const isImage = mimeType.startsWith("image/");
        if (isImage) {
          const url = URL.createObjectURL(file);
          setPreviewUrls((prev) => ({ ...prev, [attachmentId]: url }));
        }

        const pending: IntakeAttachmentSession = {
          attachmentId,
          fileName: file.name,
          mimeType,
          size: file.size,
          extractionStatus: "EXTRACTING",
          extractedContent: "",
        };
        replaceAll([
          ...attachmentsRef.current,
          toPersistedAttachment(pending),
        ]);

        const result = await extractAttachmentContent(file);
        patchOne({
          attachmentId,
          fileName: file.name,
          mimeType,
          size: file.size,
          extractionStatus: result.status,
          extractedContent: result.content,
          extractionNote: result.note,
          extractedAt: new Date().toISOString(),
        });
      }
    },
    [disabled, patchOne, replaceAll],
  );

  function removeAttachment(id: string) {
    const url = previewUrls[id];
    if (url) URL.revokeObjectURL(url);
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    replaceAll(attachmentsRef.current.filter((a) => a.attachmentId !== id));
  }

  const previewable = attachments.filter(
    (a) =>
      a.extractedContent.trim().length > 0 ||
      a.extractionStatus === "PREVIEW_ONLY" ||
      a.extractionStatus === "FAILED",
  );

  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      {!compact ? (
        <p className="text-muted-foreground text-xs">
          Drag & drop or browse. Original files stay in this browser session only;
          after refresh, re-attach binaries if needed (extracted text is kept when
          saved).
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20",
          disabled && "pointer-events-none opacity-50",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) {
            void processFiles(e.dataTransfer.files);
          }
        }}
      >
        <Upload className="text-muted-foreground size-5" />
        <p className="text-sm">Drag files here or click to browse</p>
        <p className="text-muted-foreground text-xs">
          PDF, DOCX, XLSX/XLS, CSV, TXT/MD, JPG/PNG/WEBP
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) void processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => {
            const previewUrl = previewUrls[a.attachmentId];
            return (
              <li
                key={a.attachmentId}
                className="flex items-start gap-3 rounded-md border px-3 py-2"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- session blob thumbnail
                  <img
                    src={previewUrl}
                    alt=""
                    className="size-10 rounded object-cover"
                  />
                ) : (
                  <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-medium">{a.fileName}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="xs">
                      {extensionLabel(a.fileName)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatFileSize(a.size)}
                    </span>
                    <Badge
                      variant={statusVariant(a.extractionStatus)}
                      size="xs"
                    >
                      {a.extractionStatus}
                    </Badge>
                  </div>
                  {a.extractionNote ? (
                    <p className="text-muted-foreground text-xs">
                      {a.extractionNote}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || a.extractionStatus === "EXTRACTING"}
                  aria-label={`Remove ${a.fileName}`}
                  onClick={() => removeAttachment(a.attachmentId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {previewable.length > 0 ? (
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 py-1 text-left text-sm">
            <span>Extracted Attachment Content</span>
            <ChevronDown className="size-4 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 flex flex-col gap-3">
              {previewable.map((a) => (
                <div
                  key={`preview-${a.attachmentId}`}
                  className="bg-muted/30 flex flex-col gap-1 rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{a.fileName}</p>
                    <Badge
                      variant={statusVariant(a.extractionStatus)}
                      size="xs"
                    >
                      {a.extractionStatus}
                    </Badge>
                  </div>
                  {a.extractionStatus === "EXTRACTED" ? (
                    <pre className="text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">
                      {a.extractedContent}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {a.extractionNote ??
                        "No extractable text for this attachment."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function extensionLabel(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "file";
  return fileName.slice(i + 1).toUpperCase();
}
