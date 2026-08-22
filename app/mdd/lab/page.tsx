"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  applyGateToBrief,
  createEmptyCase,
  proposeFromHeuristics,
} from "@/lib/mdd/decision-engine/propose";
import { evaluateGoldenCase } from "@/lib/mdd/golden/accept";
import { GOLDEN_CASE_SPECS, type GoldenCaseSpec } from "@/lib/mdd/golden/specs";
import type { AcceptanceReport } from "@/lib/mdd/golden/accept";
import type { MddCase } from "@/lib/mdd/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function buildCaseFromSpec(spec: GoldenCaseSpec): MddCase {
  const proposal = proposeFromHeuristics({
    title: spec.title,
    vessel: spec.vessel,
    pastedText: spec.inputFactsText,
    goldenCaseId: spec.id,
    financeSnapshot: spec.financeSnapshot,
  });
  const brief = applyGateToBrief(proposal);
  return createEmptyCase({
    title: spec.title,
    vessel: spec.vessel,
    goldenCaseId: spec.id,
    pastedText: spec.inputFactsText,
    financeSnapshot: spec.financeSnapshot,
    primaryCaseType: proposal.primaryCaseType,
    primaryCaseTypeConfirmed: true,
    tags: proposal.tags,
    tagsConfirmed: true,
    brief,
    recommendationConfirmed: true,
    presidentDecisionConfirmed: true,
    reviewCandidateFlag: spec.reviewCandidateExpected === "yes",
    reviewCandidateConfirmed: true,
    status: "DECISION_REQUIRED",
  });
}

export default function MddLabPage() {
  const [reports, setReports] = useState<AcceptanceReport[] | null>(null);

  function runAll() {
    const next = GOLDEN_CASE_SPECS.map((spec) => {
      const c = buildCaseFromSpec(spec);
      return evaluateGoldenCase(spec, c);
    });
    setReports(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/mdd"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit px-0",
            )}
          >
            ← MDD
          </Link>
          <h1 className="text-2xl font-semibold">Golden Case Lab</h1>
          <p className="text-muted-foreground text-sm">
            Compares engine output structure against Human-approved Golden Case
            Specification v1.0. AI does not redefine expected results.
          </p>
        </div>
        <Button onClick={runAll}>Run acceptance (heuristic engine)</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spec source</CardTitle>
          <CardDescription>
            docs/mdd/GOLDEN_CASE_SPECIFICATION_v1.0.md
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {GOLDEN_CASE_SPECS.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{s.id}</Badge>
              <span>{s.title}</span>
              <Badge variant="secondary">{s.expectedPrimaryCaseType}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {reports ? (
        <section className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.goldenId}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">{r.goldenId}</CardTitle>
                <Badge variant={r.passed ? "default" : "destructive"}>
                  {r.passed ? "PASS" : "FAIL"}
                </Badge>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {r.checks.map((c) => (
                    <li key={c.id} className="flex flex-wrap gap-2">
                      <Badge variant={c.passed ? "secondary" : "destructive"}>
                        {c.passed ? "ok" : "ng"}
                      </Badge>
                      <span>{c.label}</span>
                      {c.detail ? (
                        <span className="text-muted-foreground">{c.detail}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
