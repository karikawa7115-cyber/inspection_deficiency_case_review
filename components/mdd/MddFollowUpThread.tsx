"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MddIntakeAttachments } from "@/components/mdd/MddIntakeAttachments";
import { newFollowUpId } from "@/lib/mdd/attachments";
import type { CaseFollowUp, IntakeAttachmentRecord } from "@/lib/mdd/types";
import { cn } from "@/lib/utils";

/** Match Title / Vessel / Intake focus ring. */
function fieldClass(extra?: string) {
  return cn(
    "border-input bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-2.5 text-sm outline-none transition-colors",
    "focus:border-ring focus:ring-3 focus:ring-ring/50",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    extra,
  );
}

type Props = {
  followUps: CaseFollowUp[];
  /** All case attachments (case-level + follow-up-linked). */
  allAttachments: IntakeAttachmentRecord[];
  disabled?: boolean;
  onAdd: (followUp: CaseFollowUp, newAttachments: IntakeAttachmentRecord[]) => void;
  onRemove: (followUpId: string) => void;
};

export function MddFollowUpThread({
  followUps,
  allAttachments,
  disabled,
  onAdd,
  onRemove,
}: Props) {
  const [text, setText] = useState("");
  const [authorLabel, setAuthorLabel] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<
    IntakeAttachmentRecord[]
  >([]);

  const byId = new Map(
    allAttachments.map((a) => [a.attachmentId, a] as const),
  );

  function handleAdd() {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed && draftAttachments.length === 0) return;
    if (draftAttachments.some((a) => a.extractionStatus === "EXTRACTING")) {
      return;
    }
    const followUp: CaseFollowUp = {
      followUpId: newFollowUpId(),
      createdAt: new Date().toISOString(),
      authorLabel: authorLabel.trim() || undefined,
      text: trimmed,
      attachmentIds: draftAttachments.map((a) => a.attachmentId),
    };
    onAdd(followUp, draftAttachments);
    setText("");
    setAuthorLabel("");
    setDraftAttachments([]);
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Follow-up thread</p>
        <p className="text-muted-foreground text-xs">
          Add vessel / shore replies on this same case, then Re-analyze. Optional
          author label; attachments allowed per follow-up.
        </p>
      </div>

      {followUps.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {followUps.map((fu, index) => {
            const linked = (fu.attachmentIds ?? [])
              .map((id) => byId.get(id))
              .filter(Boolean) as IntakeAttachmentRecord[];
            return (
              <li
                key={fu.followUpId}
                className="bg-muted/20 flex flex-col gap-1.5 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="xs">
                      Follow-up {index + 1}
                    </Badge>
                    {fu.authorLabel ? (
                      <Badge variant="secondary" size="xs">
                        {fu.authorLabel}
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {new Date(fu.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onRemove(fu.followUpId)}
                  >
                    Remove
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  {fu.text || "(no text — attachment only)"}
                </p>
                {linked.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {linked.map((a) => (
                      <li
                        key={a.attachmentId}
                        className="text-muted-foreground text-xs"
                      >
                        {a.fileName} · {a.extractionStatus}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          No follow-ups yet. After Analyze, paste the next reply here to continue
          on this case.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
        <p className="text-sm font-medium">Add follow-up</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fu-author">Author (optional)</Label>
          <input
            id="fu-author"
            type="text"
            className={fieldClass("h-9 py-1")}
            placeholder="Master / Superintendent / Phone note…"
            value={authorLabel}
            disabled={disabled}
            onChange={(e) => setAuthorLabel(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fu-text">Reply / note</Label>
          <textarea
            id="fu-text"
            rows={4}
            className={fieldClass("min-h-24 resize-y py-2")}
            placeholder="Paste vessel or shore reply…"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <MddIntakeAttachments
          title="Follow-up attachments"
          compact
          attachments={draftAttachments}
          disabled={disabled}
          onChange={setDraftAttachments}
        />
        <Button
          type="button"
          size="sm"
          className="w-fit"
          disabled={
            disabled ||
            (!text.trim() && draftAttachments.length === 0) ||
            draftAttachments.some((a) => a.extractionStatus === "EXTRACTING")
          }
          onClick={handleAdd}
        >
          Add follow-up
        </Button>
      </div>
    </div>
  );
}
