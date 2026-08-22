"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import {
  CaseStatusBadge,
  ReadinessBadge,
  ReviewCandidateBadge,
  caseAttentionRank,
} from "@/components/mdd/MddStatusBadges";
import { localCaseRepository } from "@/lib/mdd/data/local-case-repository";
import { createEmptyCase } from "@/lib/mdd/decision-engine/propose";
import { GOLDEN_CASE_SPECS } from "@/lib/mdd/golden/specs";
import { cn } from "@/lib/utils";
import type { MddCase } from "@/lib/mdd/types";
import { ChevronDown } from "lucide-react";

/** Deterministic id so reloading a Golden Case replaces instead of duplicating. */
function goldenCaseStorageId(id: (typeof GOLDEN_CASE_SPECS)[number]["id"]) {
  return `golden-${id}`;
}

export function MddCaseList() {
  const router = useRouter();
  const [cases, setCases] = useState<MddCase[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setCases(await localCaseRepository.list());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const sorted = useMemo(
    () =>
      [...cases].sort((a, b) => {
        const rank = caseAttentionRank(b.status) - caseAttentionRank(a.status);
        if (rank !== 0) return rank;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [cases],
  );

  const decisionRequired = sorted.filter(
    (c) => c.status === "DECISION_REQUIRED",
  );
  const otherCases = sorted.filter((c) => c.status !== "DECISION_REQUIRED");

  async function createBlank() {
    const c = createEmptyCase({ title: "New Case", status: "NEW" });
    await localCaseRepository.save(c);
    router.push(`/mdd/workspace?id=${c.id}`);
  }

  /** Replace-or-create by goldenCaseId — no uncontrolled duplicates. */
  async function loadGoldenCase(
    id: (typeof GOLDEN_CASE_SPECS)[number]["id"],
  ) {
    const spec = GOLDEN_CASE_SPECS.find((s) => s.id === id)!;
    const storageId = goldenCaseStorageId(id);
    const now = new Date().toISOString();
    const c = createEmptyCase({
      id: storageId,
      title: spec.title,
      vessel: spec.vessel,
      goldenCaseId: spec.id,
      pastedText: spec.inputFactsText,
      financeSnapshot: spec.financeSnapshot,
      contextPack: {
        companyCore: true,
        vessel: spec.vessel,
        businessPartners: [],
        people: [],
        relatedCaseIds: [],
        aiSuggested: true,
        humanConfirmed: false,
      },
      status: "NEW",
      brief: undefined,
      primaryCaseType: undefined,
      primaryCaseTypeConfirmed: false,
      tags: [],
      tagsConfirmed: false,
      recommendationConfirmed: false,
      presidentDecisionConfirmed: false,
      reviewCandidateFlag: false,
      reviewCandidateConfirmed: false,
      createdAt: now,
      updatedAt: now,
    });
    await localCaseRepository.save(c);
    await refresh();
    router.push(`/mdd/workspace?id=${c.id}`);
  }

  async function clearAllDevCases() {
    await localCaseRepository.clear();
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            My Decision Desk
          </h1>
          <p className="text-muted-foreground text-sm">
            President view — cases needing your decision first
          </p>
        </div>
        <Button variant="outline" onClick={() => void createBlank()}>
          New Case
        </Button>
      </header>

      {!loading && decisionRequired.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-lg border-2 p-4">
          <p className="text-destructive text-xs font-semibold tracking-wide">
            DECISION_REQUIRED · {decisionRequired.length}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Counts only cases with READY or CONDITIONAL briefs awaiting
            President review
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No cases yet. Use New Case, or Development tools below to load Golden
            Case input.
          </p>
        ) : (
          <>
            {decisionRequired.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-destructive">
                  Needs President Decision
                </h2>
                <ul className="flex flex-col gap-2">
                  {decisionRequired.map((c) => (
                    <CaseListItem key={c.id} caseData={c} emphasizeDecision />
                  ))}
                </ul>
              </div>
            ) : null}

            {otherCases.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-muted-foreground text-sm font-medium">
                  Other cases
                </h2>
                <ul className="flex flex-col gap-2">
                  {otherCases.map((c) => (
                    <CaseListItem key={c.id} caseData={c} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Collapsible defaultOpen={false}>
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-base">Development tools</CardTitle>
                <CardDescription>
                  Not part of the operational President view. Golden Case
                  reload replaces the same case id (no duplicates).
                </CardDescription>
              </div>
              <ChevronDown className="size-4 shrink-0" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/mdd/lab"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Golden Case Lab
                </Link>
                <Button
                  variant="destructive"
                  onClick={() => void clearAllDevCases()}
                >
                  Clear all local cases
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs">
                  Load / replace Golden Case Input Facts (acceptance truth stays
                  in Spec)
                </p>
                {GOLDEN_CASE_SPECS.map((g) => (
                  <Button
                    key={g.id}
                    variant="secondary"
                    className="justify-start"
                    onClick={() => void loadGoldenCase(g.id)}
                  >
                    {g.id}: {g.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function CaseListItem({
  caseData: c,
  emphasizeDecision,
}: {
  caseData: MddCase;
  emphasizeDecision?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/mdd/workspace?id=${c.id}`}
        className={cn(
          "bg-card hover:bg-muted/40 flex flex-col gap-3 rounded-lg border p-4 transition-colors",
          emphasizeDecision && "border-destructive/50",
          c.status === "WAITING_FOR_INFORMATION" && "border-amber-500/40",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{c.title}</span>
            <p className="text-muted-foreground text-xs">
              {c.vessel ?? "No vessel"}
              {c.goldenCaseId ? ` · ${c.goldenCaseId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <CaseStatusBadge status={c.status} />
            {c.brief ? (
              <ReadinessBadge readiness={c.brief.decisionReadiness} />
            ) : null}
            <ReviewCandidateBadge on={c.reviewCandidateFlag} />
          </div>
        </div>
        {emphasizeDecision && c.brief?.presidentDecision ? (
          <div className="bg-destructive/5 rounded-md border border-destructive/20 px-3 py-2">
            <p className="text-destructive text-xs font-semibold tracking-wide">
              Pending President Decision
            </p>
            <p className="mt-1 line-clamp-3 text-sm font-medium">
              {c.brief.presidentDecision}
            </p>
          </div>
        ) : null}
      </Link>
    </li>
  );
}
