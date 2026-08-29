"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CaseStatusBadge,
  ReadinessBadge,
  ReviewCandidateBadge,
} from "@/components/mdd/MddStatusBadges";
import { MddIntakeAttachments } from "@/components/mdd/MddIntakeAttachments";
import { MddFollowUpThread } from "@/components/mdd/MddFollowUpThread";
import { localCaseRepository } from "@/lib/mdd/data/local-case-repository";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { composeAnalyzeInput } from "@/lib/mdd/attachments";
import { CASE_TYPES, type CaseStatus, type DecisionBrief, type DecisionReadiness, type IntakeAttachmentRecord, type MddCase } from "@/lib/mdd/types";
import { CASE_TYPE_LABEL_JA, MDD_UI } from "@/lib/mdd/ui-labels-ja";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type AnalyzeResponse = {
  primaryCaseType: MddCase["primaryCaseType"];
  tags: string[];
  brief: DecisionBrief;
};

/** After Analyze: President review only when READY or CONDITIONAL. */
export function statusAfterAnalysis(
  readiness: DecisionReadiness,
): CaseStatus {
  if (readiness === "NOT_READY") return "WAITING_FOR_INFORMATION";
  return "DECISION_REQUIRED";
}

/** Match shadcn Input focus ring (blue border + ring) for native intake fields. */
function intakeFieldClassName(extra?: string) {
  return cn(
    "border-input bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-2.5 text-sm outline-none transition-colors",
    // Use both focus and focus-visible so mouse click into the field also shows the ring
    "focus:border-ring focus:ring-3 focus:ring-ring/50",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    extra,
  );
}

export function MddCaseWorkspace({ caseId }: { caseId: string }) {
  const [caseData, setCaseData] = useState<MddCase | null>(null);
  const caseDataRef = useRef<MddCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editEssentials, setEditEssentials] = useState(false);

  const load = useCallback(async () => {
    const c = await localCaseRepository.get(caseId);
    caseDataRef.current = c;
    setCaseData(c);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: MddCase) {
    const saved = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    // Keep ref in sync before await so Analyze / blur cannot race on stale state.
    caseDataRef.current = saved;
    await localCaseRepository.save(saved);
    setCaseData(saved);
  }

  /** Functional update that always merges onto the latest case (incl. attachments). */
  function patchCase(
    updater: (prev: MddCase) => MddCase,
    shouldPersist = true,
  ) {
    const prev = caseDataRef.current;
    if (!prev) return;
    const updated = updater(prev);
    if (shouldPersist) {
      void persist(updated);
    } else {
      caseDataRef.current = updated;
      setCaseData(updated);
    }
  }

  async function runAnalyze() {
    const latest = caseDataRef.current;
    if (!latest) return;
    setBusy(true);
    setError(null);
    setEditEssentials(false);
    try {
      await persist({ ...latest, status: "ANALYZING" });
      // Re-read after persist — attachment extract may have finished during ANALYZING.
      const current = caseDataRef.current ?? latest;
      const attachments = current.attachments ?? [];
      const followUps = current.followUps ?? [];
      const analyzeInput = composeAnalyzeInput({
        narrative: current.pastedText,
        attachments,
        followUps,
      });
      if (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined"
      ) {
        console.debug("[MDD Analyze input]", analyzeInput.slice(0, 2000));
        console.debug("[MDD Analyze attachments]", {
          count: attachments.length,
          files: attachments.map((a) => ({
            fileName: a.fileName,
            status: a.extractionStatus,
            chars: a.extractedContent.length,
            sheets: a.extractedContent.match(/\[Sheet:[^\]]+\]/gi) ?? [],
          })),
        });
      }
      const proposal = proposeFromHeuristics({
        title: current.title,
        vessel: current.vessel,
        pastedText: current.pastedText,
        goldenCaseId: current.goldenCaseId,
        financeSnapshot: current.financeSnapshot,
        attachments,
        followUps,
      });
      const data: AnalyzeResponse = {
        primaryCaseType: proposal.primaryCaseType,
        tags: proposal.tags,
        brief: applyGateToBrief(proposal, {
          reviewCandidateFlag:
            current.goldenCaseId === "GC03"
              ? true
              : current.reviewCandidateFlag,
          financeSnapshot: current.financeSnapshot,
        }),
      };
      // Preserve UI-only Continuity / Semantic v0.2 fields across gate apply
      data.brief.suggestedQuestionsToVessel =
        proposal.brief.suggestedQuestionsToVessel;
      data.brief.proposedCurrentDecisionQuestion =
        proposal.brief.proposedCurrentDecisionQuestion;
      const reviewFlag =
        current.goldenCaseId === "GC03"
          ? true
          : current.reviewCandidateFlag;
      const nextStatus = statusAfterAnalysis(data.brief.decisionReadiness);
      // Prefer latest attachments again so a late extract is not dropped.
      const finalAttachments =
        caseDataRef.current?.attachments ?? attachments;
      const finalFollowUps = caseDataRef.current?.followUps ?? followUps;
      // Human confirmation flags reset on every Analyze / Re-analyze (Continuity §9.3)
      await persist({
        ...(caseDataRef.current ?? current),
        primaryCaseType: data.primaryCaseType,
        primaryCaseTypeConfirmed: false,
        tags: data.tags,
        tagsConfirmed: false,
        brief: data.brief,
        recommendationConfirmed: false,
        presidentDecisionConfirmed: false,
        reviewCandidateFlag: reviewFlag,
        reviewCandidateConfirmed: false,
        attachments: finalAttachments,
        followUps: finalFollowUps,
        status: nextStatus,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
      const fallback = caseDataRef.current ?? latest;
      await persist({ ...fallback, status: "NEW" });
    } finally {
      setBusy(false);
    }
  }

  const essentialsConfirmed =
    Boolean(caseData?.primaryCaseTypeConfirmed) &&
    Boolean(caseData?.tagsConfirmed) &&
    Boolean(caseData?.recommendationConfirmed) &&
    Boolean(caseData?.presidentDecisionConfirmed) &&
    Boolean(caseData?.reviewCandidateConfirmed);

  async function confirmAsProposed() {
    const current = caseDataRef.current;
    if (!current?.brief) return;
    const readiness = current.brief.decisionReadiness;
    const nextStatus =
      readiness === "NOT_READY" ? "WAITING_FOR_INFORMATION" : "ACTION_IN_PROGRESS";
    await persist({
      ...current,
      primaryCaseTypeConfirmed: true,
      tagsConfirmed: true,
      recommendationConfirmed: true,
      presidentDecisionConfirmed: true,
      reviewCandidateConfirmed: true,
      contextPack: { ...current.contextPack, humanConfirmed: true },
      status: nextStatus,
    });
    setEditEssentials(false);
  }

  async function closeCase() {
    const current = caseDataRef.current;
    if (!current) return;
    // Review Candidate flag is intentionally preserved on close.
    await persist({
      ...current,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      reviewCandidateFlag: current.reviewCandidateFlag,
    });
  }

  if (!caseData) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Case not found.</p>
        <Link href="/mdd" className={cn(buttonVariants(), "mt-3")}>
          Back
        </Link>
      </div>
    );
  }

  const brief = caseData.brief;
  const pendingConfirm = Boolean(brief) && !essentialsConfirmed;
  const allAttachments = caseData.attachments ?? [];
  const followUps = caseData.followUps ?? [];
  const followUpAttachmentIds = new Set(
    followUps.flatMap((f) => f.attachmentIds ?? []),
  );
  const caseLevelAttachments = allAttachments.filter(
    (a) => !followUpAttachmentIds.has(a.attachmentId),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link
            href="/mdd"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit px-0",
            )}
          >
            ← 案件一覧
          </Link>
          <h1 className="text-xl font-semibold">{caseData.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            <CaseStatusBadge status={caseData.status} />
            {brief ? (
              <ReadinessBadge readiness={brief.decisionReadiness} />
            ) : null}
            <ReviewCandidateBadge on={caseData.reviewCandidateFlag} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void runAnalyze()}>
            {busy
              ? MDD_UI.analyzing
              : brief
                ? MDD_UI.reanalyze
                : MDD_UI.analyze}
          </Button>
          <Button
            variant="secondary"
            disabled={!essentialsConfirmed || caseData.status === "CLOSED"}
            onClick={() => void closeCase()}
          >
            {MDD_UI.closeCase}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {pendingConfirm ? (
        <HumanConfirmationPanel
          caseData={caseData}
          editEssentials={editEssentials}
          onToggleEdit={() => setEditEssentials((v) => !v)}
          onConfirm={() => void confirmAsProposed()}
          onChange={(next) => {
            caseDataRef.current = next;
            setCaseData(next);
          }}
          onPersist={(next) => {
            const base = caseDataRef.current ?? next;
            void persist({
              ...base,
              ...next,
              // Never drop attachments / follow-ups via essentials edits.
              attachments: next.attachments ?? base.attachments,
              followUps: next.followUps ?? base.followUps,
            });
          }}
        />
      ) : null}

      {essentialsConfirmed && brief ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            {MDD_UI.humanReviewed}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            案件種別 · タグ · 推奨対応 · 社長判断 · Review Candidate —
            変更時のみ編集（個別クリック不要）。
          </p>
          {caseData.status === "CLOSED" && caseData.reviewCandidateFlag ? (
            <span className="mt-1 block text-xs">
              Status is CLOSED; Review Candidate flag remains on.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>
              {MDD_UI.caseIntake}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                / {MDD_UI.caseIntakeEn}
              </span>
            </CardTitle>
            <CardDescription>{MDD_UI.caseIntakeHelp}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mdd-intake-title">{MDD_UI.title}</Label>
              <input
                id="mdd-intake-title"
                type="text"
                className={intakeFieldClassName("h-9 py-1")}
                value={caseData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  patchCase((prev) => ({ ...prev, title }), false);
                }}
                onBlur={(e) => {
                  const title = e.target.value;
                  patchCase((prev) => ({ ...prev, title }), true);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mdd-intake-vessel">{MDD_UI.vessel}</Label>
              <input
                id="mdd-intake-vessel"
                type="text"
                className={intakeFieldClassName("h-9 py-1")}
                value={caseData.vessel ?? ""}
                onChange={(e) => {
                  const vessel = e.target.value;
                  patchCase((prev) => ({ ...prev, vessel }), false);
                }}
                onBlur={(e) => {
                  const vessel = e.target.value;
                  patchCase((prev) => ({ ...prev, vessel }), true);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mdd-intake-narrative">{MDD_UI.narrative}</Label>
              {/*
                Native textarea (not shadcn Textarea): avoid `display:flex` +
                `field-sizing-content`, which collapse height to ~64px.
                Focus ring matches Title / Vessel (border-ring + ring).
              */}
              <textarea
                id="mdd-intake-narrative"
                rows={12}
                spellCheck
                className={intakeFieldClassName(
                  "min-h-48 resize-y py-2 leading-relaxed",
                )}
                value={caseData.pastedText ?? ""}
                placeholder={MDD_UI.narrativePlaceholder}
                onChange={(e) => {
                  const pastedText = e.target.value;
                  patchCase((prev) => ({ ...prev, pastedText }), false);
                }}
                onBlur={(e) => {
                  const pastedText = e.target.value;
                  patchCase((prev) => ({ ...prev, pastedText }), true);
                }}
              />
            </div>
            <MddIntakeAttachments
              attachments={caseLevelAttachments}
              disabled={busy || caseData.status === "CLOSED"}
              onChange={(next: IntakeAttachmentRecord[]) => {
                patchCase((prev) => {
                  const linked = (prev.attachments ?? []).filter((a) =>
                    (prev.followUps ?? []).some((f) =>
                      (f.attachmentIds ?? []).includes(a.attachmentId),
                    ),
                  );
                  return {
                    ...prev,
                    attachments: [...next, ...linked],
                  };
                }, true);
              }}
            />
            <MddFollowUpThread
              followUps={followUps}
              allAttachments={allAttachments}
              disabled={busy || caseData.status === "CLOSED"}
              onAdd={(followUp, newAttachments) => {
                patchCase((prev) => ({
                  ...prev,
                  followUps: [...(prev.followUps ?? []), followUp],
                  attachments: [
                    ...(prev.attachments ?? []),
                    ...newAttachments,
                  ],
                }), true);
              }}
              onRemove={(followUpId) => {
                patchCase((prev) => {
                  const target = (prev.followUps ?? []).find(
                    (f) => f.followUpId === followUpId,
                  );
                  const removeIds = new Set(target?.attachmentIds ?? []);
                  return {
                    ...prev,
                    followUps: (prev.followUps ?? []).filter(
                      (f) => f.followUpId !== followUpId,
                    ),
                    attachments: (prev.attachments ?? []).filter(
                      (a) => !removeIds.has(a.attachmentId),
                    ),
                  };
                }, true);
              }}
            />
            {caseData.financeSnapshot ? (
              <div className="bg-muted/40 flex flex-col gap-1 rounded-md border p-3 text-xs">
                <p className="font-medium">FinanceSnapshot (manual)</p>
                <p>
                  Reported {caseData.financeSnapshot.reportedShipFund} · Pending{" "}
                  {caseData.financeSnapshot.pendingExpenses} · Adjusted{" "}
                  {caseData.financeSnapshot.adjustedBalance}
                </p>
                <p>
                  Target {caseData.financeSnapshot.targetClosing} · Required ≈{" "}
                  {caseData.financeSnapshot.vesselRequiredApprox} · Rec{" "}
                  {caseData.financeSnapshot.recommendedCtm}
                </p>
                <p>
                  Liquidity confirmed:{" "}
                  {caseData.financeSnapshot.companyLiquidityConfirmed
                    ? "yes"
                    : "no"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {!brief ? (
            <Card>
              <CardHeader>
                <CardTitle>{MDD_UI.decisionBrief}</CardTitle>
                <CardDescription>{MDD_UI.decisionBriefEmpty}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex flex-col gap-1">
                    <CardTitle>
                      {MDD_UI.executiveDecision}
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        / {MDD_UI.executiveDecisionEn}
                      </span>
                    </CardTitle>
                    <CardDescription>{MDD_UI.executiveHelp}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {brief.qualityGate.criticalFailures.length > 0 ? (
                    <div className="border-destructive bg-destructive/10 rounded-md border-2 p-3 text-sm">
                      <p className="text-destructive font-semibold">
                        {MDD_UI.qualityGateCritical}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {MDD_UI.qualityGateBlocksReady}
                      </p>
                      <ul className="mt-2 list-disc pl-4">
                        {brief.qualityGate.criticalFailures.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {brief.qualityGate.warnings.length > 0 ? (
                    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        {MDD_UI.qualityGateWarning}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {MDD_UI.qualityGateDoesNotBlock}
                      </p>
                      <ul className="mt-2 list-disc pl-4">
                        {brief.qualityGate.warnings.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {brief.qualityGate.criticalFailures.length === 0 &&
                  brief.qualityGate.warnings.length === 0 ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                      {MDD_UI.qualityGateOk}
                    </div>
                  ) : null}

                  {brief.proposedCurrentDecisionQuestion ? (
                    <section className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
                      <h3 className="text-sm font-semibold">
                        {MDD_UI.currentDecisionQuestion}
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          / {MDD_UI.currentDecisionQuestionEn}
                        </span>
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {
                          brief.proposedCurrentDecisionQuestion
                            .decisionRequiredNow
                        }
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {MDD_UI.expectedDecider}:{" "}
                        {brief.proposedCurrentDecisionQuestion.expectedDecider}
                      </p>
                      {(brief.proposedCurrentDecisionQuestion
                        .deferredToExecutionOrClosure?.length ?? 0) > 0 ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            {MDD_UI.deferredItems}
                          </p>
                          <ul className="text-muted-foreground list-disc pl-4 text-xs">
                            {brief.proposedCurrentDecisionQuestion.deferredToExecutionOrClosure!.map(
                              (d) => (
                                <li key={d}>{d}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      1. {MDD_UI.recommendation}
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {brief.recommendation}
                    </p>
                  </section>

                  <section className="border-primary/40 bg-primary/5 flex flex-col gap-2 rounded-lg border-2 p-4">
                    <h3 className="text-sm font-semibold">
                      2. {MDD_UI.presidentDecision}
                    </h3>
                    <p className="text-base leading-relaxed font-medium whitespace-pre-wrap">
                      {brief.presidentDecision}
                    </p>
                  </section>

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      3. {MDD_UI.decisionReadiness}
                    </h3>
                    <div>
                      <ReadinessBadge readiness={brief.decisionReadiness} />
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      4. {MDD_UI.decisionAuthorities}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {MDD_UI.decisionAuthoritiesHelp}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {brief.decisionAuthorities.map((a) => (
                        <li
                          key={a.id}
                          className="bg-muted/30 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{a.roleLabel}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{a.authority}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      5. {MDD_UI.why}
                    </h3>
                    <p className="text-sm whitespace-pre-wrap">{brief.why}</p>
                  </section>

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      6. {MDD_UI.nextActions}
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {brief.nextActions.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm"
                        >
                          <span>{a.text}</span>
                          <span className="text-muted-foreground text-xs">
                            担当: {a.owner}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {(brief.suggestedQuestionsToVessel?.length ?? 0) > 0 ? (
                    <SuggestedQuestionsChips
                      questions={brief.suggestedQuestionsToVessel!}
                    />
                  ) : null}
                </CardContent>
              </Card>

              <DetailSection title={MDD_UI.decisionDetail}>
                <FactGroup
                  title={MDD_UI.confirmedFacts}
                  items={brief.confirmedFacts}
                />
                <FactGroup
                  title={MDD_UI.reportedUnverified}
                  items={brief.unverifiedFacts}
                  showSource
                />
                <FactGroup title={MDD_UI.assumptions} items={brief.assumptions} />
                <FactGroup
                  title={MDD_UI.missingInformation}
                  items={brief.missingInformation}
                  showWho
                />
                {(brief.suggestedQuestionsToVessel?.length ?? 0) > 0 ? (
                  <SuggestedQuestionsChips
                    questions={brief.suggestedQuestionsToVessel!}
                  />
                ) : null}
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{MDD_UI.risks}</p>
                  <ul className="list-disc pl-4 text-sm">
                    {brief.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{MDD_UI.options}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {brief.options.map((o) => (
                      <li key={o.id} className="rounded-md border px-2 py-1">
                        <span className="font-medium">{o.title}</span> —{" "}
                        {o.summary}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{MDD_UI.delegation}</p>
                  <ul className="list-disc pl-4 text-sm">
                    {brief.delegation.map((d) => (
                      <li key={d.id}>
                        <span className="font-medium">{d.assignee}</span>:{" "}
                        {d.task}
                      </li>
                    ))}
                  </ul>
                </div>
              </DetailSection>

              <DetailSection title={MDD_UI.managementLearning}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Flag label="CA" on={brief.learning.correctiveAction} />
                  <Flag label="PA" on={brief.learning.preventiveAction} />
                  <Flag
                    label="Effectiveness"
                    on={brief.learning.effectivenessVerification}
                  />
                  <Flag label="Horizontal" on={brief.learning.horizontalCheck} />
                  <Flag
                    label="IA Candidate"
                    on={brief.learning.internalAuditCandidate}
                  />
                  <Flag
                    label="MR Candidate"
                    on={brief.learning.managementReviewCandidate}
                  />
                  <Flag
                    label="Knowledge Update"
                    on={brief.learning.knowledgeUpdateCandidate}
                  />
                  <p>Fleet-wide: {brief.learning.fleetWideRelevance}</p>
                </div>
                {brief.learning.notes ? (
                  <p className="text-muted-foreground text-sm">
                    {brief.learning.notes}
                  </p>
                ) : null}
              </DetailSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HumanConfirmationPanel({
  caseData,
  editEssentials,
  onToggleEdit,
  onConfirm,
  onChange,
  onPersist,
}: {
  caseData: MddCase;
  editEssentials: boolean;
  onToggleEdit: () => void;
  onConfirm: () => void;
  onChange: (next: MddCase) => void;
  onPersist: (next: MddCase) => void;
}) {
  const brief = caseData.brief!;
  return (
    <Card className="border-destructive/30 bg-card">
      <CardHeader>
        <CardTitle>{MDD_UI.humanReviewRequired}</CardTitle>
        <CardDescription>{MDD_UI.humanReviewHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs">
          人確認の必須項目：案件種別 · タグ · 推奨対応 · 社長判断 · Review
          Candidate
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          <ConfirmRow
            n={1}
            label="案件種別"
            value={
              caseData.primaryCaseType
                ? CASE_TYPE_LABEL_JA[caseData.primaryCaseType]
                : "(未設定)"
            }
          />
          <ConfirmRow
            n={2}
            label="タグ"
            value={caseData.tags.join(", ") || "(なし)"}
          />
          <ConfirmRow
            n={3}
            label={MDD_UI.recommendation}
            value={brief.recommendation}
          />
          <ConfirmRow
            n={4}
            label={MDD_UI.presidentDecision}
            value={brief.presidentDecision}
            emphasize
          />
          <ConfirmRow
            n={5}
            label="Review Candidate"
            value={caseData.reviewCandidateFlag ? "YES" : "NO"}
          />
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onConfirm}>{MDD_UI.markAllReviewed}</Button>
          <Button variant="outline" onClick={onToggleEdit}>
            {editEssentials ? MDD_UI.hideEdits : MDD_UI.editEssentials}
          </Button>
        </div>

        {editEssentials ? (
          <div className="bg-muted/30 flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-1.5">
              <Label>案件種別</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={caseData.primaryCaseType ?? ""}
                onChange={(e) =>
                  onPersist({
                    ...caseData,
                    primaryCaseType: e.target.value
                      ? (e.target.value as MddCase["primaryCaseType"])
                      : undefined,
                  })
                }
              >
                <option value="">(未設定)</option>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CASE_TYPE_LABEL_JA[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tags-edit">タグ</Label>
              <Input
                id="tags-edit"
                className="bg-card"
                value={caseData.tags.join(", ")}
                onChange={(e) =>
                  onChange({
                    ...caseData,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                onBlur={(e) =>
                  onPersist({
                    ...caseData,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-edit">{MDD_UI.recommendation}</Label>
              <Textarea
                id="rec-edit"
                className="bg-card"
                rows={3}
                value={brief.recommendation}
                onChange={(e) =>
                  onChange({
                    ...caseData,
                    brief: { ...brief, recommendation: e.target.value },
                  })
                }
                onBlur={(e) =>
                  onPersist({
                    ...caseData,
                    brief: { ...brief, recommendation: e.target.value },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pd-edit">{MDD_UI.presidentDecision}</Label>
              <Textarea
                id="pd-edit"
                className="bg-card"
                rows={3}
                value={brief.presidentDecision}
                onChange={(e) =>
                  onChange({
                    ...caseData,
                    brief: { ...brief, presidentDecision: e.target.value },
                  })
                }
                onBlur={(e) =>
                  onPersist({
                    ...caseData,
                    brief: { ...brief, presidentDecision: e.target.value },
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={caseData.reviewCandidateFlag}
                onChange={(e) =>
                  onPersist({
                    ...caseData,
                    reviewCandidateFlag: e.target.checked,
                  })
                }
              />
              Review Candidate (flag; survives Close)
            </label>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConfirmRow({
  n,
  label,
  value,
  emphasize,
}: {
  n: number;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <li
      className={[
        "rounded-md border px-3 py-2",
        emphasize ? "border-primary/40 bg-primary/5" : "bg-background",
      ].join(" ")}
    >
      <p className="text-muted-foreground text-xs font-medium">
        {n}. {label}
      </p>
      <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-wrap">{value}</p>
    </li>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="py-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <CardTitle className="text-base">{title}</CardTitle>
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SuggestedQuestionsChips({ questions }: { questions: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyQuestion(q: string) {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore clipboard failures in restricted contexts
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {MDD_UI.suggestedQuestions}
      </h3>
      <p className="text-muted-foreground text-xs">
        {MDD_UI.suggestedQuestionsHelp}
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <Button
            key={q}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full whitespace-normal px-2.5 py-1.5 text-left text-xs"
            onClick={() => void copyQuestion(q)}
          >
            {copied === q ? "コピー済み" : q}
          </Button>
        ))}
      </div>
    </section>
  );
}

function FactGroup({
  title,
  items,
  showWho,
  showSource,
}: {
  title: string;
  items: DecisionBrief["confirmedFacts"];
  showWho?: boolean;
  showSource?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{title}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((f) => (
          <li key={f.id} className="rounded-md border px-2 py-1">
            {f.text}
            {showWho && (f.who || f.what || f.evidenceRequired) ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {MDD_UI.who}: {f.who ?? "—"} · {MDD_UI.what}: {f.what ?? "—"} ·{" "}
                {MDD_UI.evidence}: {f.evidenceRequired ?? "—"}
              </p>
            ) : null}
            {showSource && f.evidenceRequired && !showWho ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {f.evidenceRequired}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <p>
      {label}: {on ? "YES" : "NO"}
    </p>
  );
}
