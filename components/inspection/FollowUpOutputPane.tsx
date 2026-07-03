"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  canDpApprove,
  canSupervisorApprove,
  formatApprovalTimestamp,
  isFollowUpOutputLocked,
  requiresDpApproval,
} from "@/lib/inspection/approval";
import { type FollowUpDraftContext } from "@/lib/inspection/draft-outputs";
import {
  FOLLOW_UP_TABS,
  FOLLOW_UP_TAB_ACCENT,
  getFollowUpTabMeta,
  getReviewOutputStatusVariant,
  REVIEW_OUTPUT_STATUS_LABELS,
} from "@/lib/inspection/follow-up";
import {
  type Deficiency,
  type FollowUpTab,
  type ReviewOutputApproval,
} from "@/lib/inspection/schema";
import { INSPECTION_PANE_CAPTIONS } from "@/lib/inspection/visual-semantics";
import { type InspectionPersistApi } from "@/hooks/use-inspection-persist";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { InlineTextareaField, SectionLabel } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type FollowUpOutputPaneProps = {
  deficiency: Deficiency | null;
  draftContext: FollowUpDraftContext;
  pane4Open: boolean;
  onTogglePane4: () => void;
  persist: InspectionPersistApi;
};

function ApprovalLog({ approvals }: { approvals: ReviewOutputApproval[] }) {
  if (!Array.isArray(approvals) || approvals.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <SectionLabel>Approval log</SectionLabel>
      <ul className="flex flex-col gap-2 text-xs text-foreground">
        {approvals.map((entry) => (
          <li key={`${entry.role}-${entry.approvedAt}`}>
            <span className="font-medium capitalize">{entry.role}</span>
            {" · "}
            {entry.approvedBy}
            {" · "}
            <span className="text-muted-foreground">
              {formatApprovalTimestamp(entry.approvedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FollowUpOutputPane({
  deficiency,
  draftContext,
  pane4Open,
  onTogglePane4,
  persist,
}: FollowUpOutputPaneProps) {
  const [activeTab, setActiveTab] = useState<FollowUpTab>("review_comment");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab("review_comment");
  }, [deficiency?.id]);

  const tabMeta = getFollowUpTabMeta(activeTab);
  const content =
    deficiency != null
      ? persist.resolveTabContent(deficiency, activeTab, draftContext)
      : "";
  const { status, approvals } =
    deficiency != null
      ? persist.getTabState(deficiency, activeTab)
      : { status: "draft" as const, approvals: [] };
  const locked = isFollowUpOutputLocked(status);
  const supervisorCanApprove = canSupervisorApprove(status);
  const dpCanApprove = deficiency
    ? canDpApprove(status, activeTab)
    : false;

  const handleSave = (value: string) => {
    if (!deficiency || locked) return;
    persist.saveTabContent(deficiency.id, activeTab, value);
  };

  const handleSupervisorApprove = () => {
    if (!deficiency || !supervisorCanApprove) return;
    persist.approveSupervisor(deficiency.id, activeTab);
  };

  const handleDpApprove = () => {
    if (!deficiency || !dpCanApprove) return;
    persist.approveDp(deficiency.id, activeTab);
  };

  const handleResetToDraft = () => {
    if (!deficiency) return;
    persist.resetTab(deficiency.id, activeTab);
  };

  const handleCopy = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10 transition-[width] duration-200 ease-linear",
        pane4Open ? "w-[440px]" : "w-12",
      )}
    >
      {pane4Open ? (
        <>
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-card/90 px-4 py-2.5 shadow-xs">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SectionLabel>Follow-up Output</SectionLabel>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {INSPECTION_PANE_CAPTIONS.p4}
              </p>
            </div>
            <Pane4Toggle open={pane4Open} onToggle={onTogglePane4} />
          </header>

          {deficiency ? (
            <div key={deficiency.id} className="flex min-h-0 flex-1">
              <nav
                aria-label="Follow-up output tabs"
                className="flex w-36 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-2"
              >
                {FOLLOW_UP_TABS.map((tab) => {
                  const tabState = persist.getTabState(deficiency, tab.id);
                  const accent = FOLLOW_UP_TAB_ACCENT[tab.id];
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-md border-l-[3px] px-2 py-2 text-left text-xs leading-snug transition-colors",
                        isActive ? accent.activeClass : accent.idleClass,
                        !isActive && "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <span className="flex-1">{tab.shortLabel}</span>
                      {tabState.status === "dp_approved" && (
                        <Check className="size-3 shrink-0 text-inspection-success" />
                      )}
                    </button>
                  );
                })}
              </nav>

              <ScrollArea className="min-h-0 flex-1">
                <div
                  key={`${deficiency.id}-${activeTab}`}
                  className="flex flex-col gap-5 p-4"
                >
                  <div className="flex flex-col gap-2">
                    <SectionLabel>{tabMeta.label}</SectionLabel>
                    <p className="text-xs text-muted-foreground">
                      {tabMeta.audience}
                    </p>
                    <Badge variant={getReviewOutputStatusVariant(status)}>
                      {REVIEW_OUTPUT_STATUS_LABELS[status]}
                    </Badge>
                    {requiresDpApproval(activeTab) && status === "draft" && (
                      <p className="text-xs text-muted-foreground">
                        Requires supervisor approve, then DP approve.
                      </p>
                    )}
                  </div>

                  {locked ? (
                    <div className="rounded-lg border border-input bg-muted/20 px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                        {content.trim() || "—"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-input bg-muted/20 px-1 py-1">
                      <InlineTextareaField
                        value={content}
                        onSave={handleSave}
                        ariaLabel={`${tabMeta.label} draft`}
                        placeholder="Draft not generated"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSupervisorApprove}
                      disabled={!supervisorCanApprove}
                    >
                      Approve (Supervisor)
                    </Button>
                    {requiresDpApproval(activeTab) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleDpApprove}
                        disabled={!dpCanApprove}
                      >
                        Approve (DP)
                      </Button>
                    )}
                    {status !== "draft" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleResetToDraft}
                      >
                        Reset to draft
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!content.trim()}
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>

                  <ApprovalLog approvals={approvals} />

                  <p className="text-xs text-muted-foreground">
                    Saved locally — edits and approvals persist across
                    deficiency switches and reloads.
                  </p>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
              Select a deficiency to generate follow-up outputs
            </div>
          )}
        </>
      ) : (
        <div className="flex h-12 shrink-0 items-center justify-center border-b border-border">
          <Pane4Toggle open={pane4Open} onToggle={onTogglePane4} />
        </div>
      )}
    </aside>
  );
}
