"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { localCaseRepository } from "@/lib/mdd/data/local-case-repository";
import {
  applyGateToBrief,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { CASE_TYPES, type CaseStatus, type DecisionBrief, type DecisionReadiness, type MddCase } from "@/lib/mdd/types";
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

export function MddCaseWorkspace({ caseId }: { caseId: string }) {
  const [caseData, setCaseData] = useState<MddCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editEssentials, setEditEssentials] = useState(false);

  const load = useCallback(async () => {
    const c = await localCaseRepository.get(caseId);
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
    await localCaseRepository.save(saved);
    setCaseData(saved);
  }

  async function runAnalyze() {
    if (!caseData) return;
    setBusy(true);
    setError(null);
    setEditEssentials(false);
    try {
      await persist({ ...caseData, status: "ANALYZING" });
      // Phase 1A: client-side heuristic engine (no production LLM; works with static export)
      const proposal = proposeFromHeuristics({
        title: caseData.title,
        vessel: caseData.vessel,
        pastedText: caseData.pastedText,
        goldenCaseId: caseData.goldenCaseId,
        financeSnapshot: caseData.financeSnapshot,
      });
      const data: AnalyzeResponse = {
        primaryCaseType: proposal.primaryCaseType,
        tags: proposal.tags,
        brief: applyGateToBrief(proposal),
      };
      const reviewFlag =
        caseData.goldenCaseId === "GC03"
          ? true
          : caseData.reviewCandidateFlag;
      const nextStatus = statusAfterAnalysis(data.brief.decisionReadiness);
      await persist({
        ...caseData,
        primaryCaseType: data.primaryCaseType,
        primaryCaseTypeConfirmed: false,
        tags: data.tags,
        tagsConfirmed: false,
        brief: data.brief,
        recommendationConfirmed: false,
        presidentDecisionConfirmed: false,
        reviewCandidateFlag: reviewFlag,
        reviewCandidateConfirmed: false,
        status: nextStatus,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
      if (caseData) await persist({ ...caseData, status: "NEW" });
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
    if (!caseData?.brief) return;
    const readiness = caseData.brief.decisionReadiness;
    const nextStatus =
      readiness === "NOT_READY" ? "WAITING_FOR_INFORMATION" : "ACTION_IN_PROGRESS";
    await persist({
      ...caseData,
      primaryCaseTypeConfirmed: true,
      tagsConfirmed: true,
      recommendationConfirmed: true,
      presidentDecisionConfirmed: true,
      reviewCandidateConfirmed: true,
      contextPack: { ...caseData.contextPack, humanConfirmed: true },
      status: nextStatus,
    });
    setEditEssentials(false);
  }

  async function closeCase() {
    if (!caseData) return;
    // Review Candidate flag is intentionally preserved on close.
    await persist({
      ...caseData,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      reviewCandidateFlag: caseData.reviewCandidateFlag,
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
            ← Cases
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
            {busy ? "Analyzing…" : brief ? "Re-analyze" : "Analyze"}
          </Button>
          <Button
            variant="secondary"
            disabled={!essentialsConfirmed || caseData.status === "CLOSED"}
            onClick={() => void closeCase()}
          >
            Close case
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
          onChange={setCaseData}
          onPersist={(next) => void persist(next)}
        />
      ) : null}

      {essentialsConfirmed && brief ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            Human-reviewed
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Case Type · Tags · Recommendation · President Decision · Review
            Candidate — confirmed without per-field clicks (edits only if
            changed).
          </p>
          {caseData.status === "CLOSED" && caseData.reviewCandidateFlag ? (
            <span className="mt-1 block text-xs">
              Status is CLOSED; Review Candidate flag remains on.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Case Intake</CardTitle>
            <CardDescription>
              Paste facts, then Analyze. Confirmation of decision essentials
              happens after the Brief appears.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={caseData.title}
                onChange={(e) =>
                  setCaseData({ ...caseData, title: e.target.value })
                }
                onBlur={(e) =>
                  void persist({ ...caseData, title: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vessel">Vessel</Label>
              <Input
                id="vessel"
                value={caseData.vessel ?? ""}
                onChange={(e) =>
                  setCaseData({ ...caseData, vessel: e.target.value })
                }
                onBlur={(e) =>
                  void persist({ ...caseData, vessel: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paste">Pasted facts</Label>
              <Textarea
                id="paste"
                rows={14}
                value={caseData.pastedText}
                onChange={(e) =>
                  setCaseData({ ...caseData, pastedText: e.target.value })
                }
                onBlur={(e) =>
                  void persist({ ...caseData, pastedText: e.target.value })
                }
              />
            </div>
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
                <CardTitle>Decision Brief</CardTitle>
                <CardDescription>
                  Run Analyze to prepare the Executive Decision for the
                  President.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex flex-col gap-1">
                    <CardTitle>Executive Decision</CardTitle>
                    <CardDescription>
                      Primary view for the President (~30 seconds). Order:
                      Recommendation → President Decision → Readiness →
                      Authorities → Why → Next Actions.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {brief.qualityGate.criticalFailures.length > 0 ? (
                    <div className="border-destructive bg-destructive/10 rounded-md border-2 p-3 text-sm">
                      <p className="text-destructive font-semibold">
                        Quality Gate — Critical failure
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        READY is blocked until these are resolved.
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
                        Quality Gate — Warning
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Does not by itself block READY.
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
                      Quality Gate — no critical failures
                    </div>
                  ) : null}

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      1. Recommendation
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {brief.recommendation}
                    </p>
                  </section>

                  <section className="border-primary/40 bg-primary/5 flex flex-col gap-2 rounded-lg border-2 p-4">
                    <h3 className="text-sm font-semibold">
                      2. President Decision
                    </h3>
                    <p className="text-base leading-relaxed font-medium whitespace-pre-wrap">
                      {brief.presidentDecision}
                    </p>
                  </section>

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      3. Decision Readiness
                    </h3>
                    <div>
                      <ReadinessBadge readiness={brief.decisionReadiness} />
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      4. Decision Authorities
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Role → Authority (separate from President Decision)
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
                      5. Why
                    </h3>
                    <p className="text-sm whitespace-pre-wrap">{brief.why}</p>
                  </section>

                  <section className="flex flex-col gap-1.5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      6. Next Actions
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {brief.nextActions.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm"
                        >
                          <span>{a.text}</span>
                          <span className="text-muted-foreground text-xs">
                            Owner: {a.owner}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </CardContent>
              </Card>

              <DetailSection title="Decision Detail (optional)">
                <FactGroup title="Confirmed Facts" items={brief.confirmedFacts} />
                <FactGroup
                  title="Reported but Unverified"
                  items={brief.unverifiedFacts}
                />
                <FactGroup title="Assumptions" items={brief.assumptions} />
                <FactGroup
                  title="Missing Information"
                  items={brief.missingInformation}
                  showWho
                />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Risks</p>
                  <ul className="list-disc pl-4 text-sm">
                    {brief.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Options</p>
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
                  <p className="text-sm font-medium">Delegation</p>
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

              <DetailSection title="Management Learning (secondary)">
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
        <CardTitle>Human review required</CardTitle>
        <CardDescription>
          One action marks all five essentials as human-reviewed. No per-field
          clicks unless you need to change something.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs">
          Essentials to human-review: Case Type · Tags · Recommendation ·
          President Decision · Review Candidate
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          <ConfirmRow
            n={1}
            label="Primary Case Type"
            value={caseData.primaryCaseType ?? "(unset)"}
          />
          <ConfirmRow
            n={2}
            label="Tags"
            value={caseData.tags.join(", ") || "(none)"}
          />
          <ConfirmRow
            n={3}
            label="Recommendation"
            value={brief.recommendation}
          />
          <ConfirmRow
            n={4}
            label="President Decision"
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
          <Button onClick={onConfirm}>
            Mark all five as human-reviewed
          </Button>
          <Button variant="outline" onClick={onToggleEdit}>
            {editEssentials ? "Hide edits" : "Edit essentials only"}
          </Button>
        </div>

        {editEssentials ? (
          <div className="bg-muted/30 flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-1.5">
              <Label>Primary Case Type</Label>
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
                <option value="">(unset)</option>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tags-edit">Tags</Label>
              <Input
                id="tags-edit"
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
              <Label htmlFor="rec-edit">Recommendation</Label>
              <Textarea
                id="rec-edit"
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
              <Label htmlFor="pd-edit">President Decision</Label>
              <Textarea
                id="pd-edit"
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

function FactGroup({
  title,
  items,
  showWho,
}: {
  title: string;
  items: DecisionBrief["confirmedFacts"];
  showWho?: boolean;
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
                Who: {f.who ?? "—"} · What: {f.what ?? "—"} · Evidence:{" "}
                {f.evidenceRequired ?? "—"}
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
