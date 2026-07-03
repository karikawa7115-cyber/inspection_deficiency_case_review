"use client";

import { REVIEW_ALERT_LABELS } from "@/lib/inspection/alert-labels";
import { type InspectionCaseContext } from "@/lib/inspection/case-context";
import { type Deficiency } from "@/lib/inspection/schema";
import {
  deficiencyHasPreventiveIssue,
  deficiencyHasRootCauseIssue,
  getReviewAlertBadgeVariant,
} from "@/lib/inspection/visual-semantics";
import { DeficiencyReviewPaneHeader } from "@/components/inspection/DeficiencyReviewPaneHeader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SectionLabel } from "@/components/primitives";
import { cn } from "@/lib/utils";

type DeficiencyReviewPaneProps = {
  deficiency: Deficiency | null;
  caseContext: InspectionCaseContext | null;
};

type ReviewFieldCardProps = {
  label: string;
  text?: string;
  tone?: "default" | "warning";
};

function ReviewFieldCard({
  label,
  text,
  tone = "default",
}: ReviewFieldCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        tone === "warning" &&
          "border-inspection-warning/35 bg-inspection-warning-bg/50",
      )}
    >
      <CardHeader className="pb-0">
        <CardTitle emphasis="prominent">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground">
          {text?.trim() || "—"}
        </p>
      </CardContent>
    </Card>
  );
}

export function DeficiencyReviewPane({
  deficiency,
  caseContext,
}: DeficiencyReviewPaneProps) {
  if (!deficiency || !caseContext) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
        {caseContext && <DeficiencyReviewPaneHeader caseContext={caseContext} />}
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a deficiency to review
        </div>
      </div>
    );
  }

  const titleNo = String(deficiency.number).padStart(2, "0");
  const rootCauseIssue = deficiencyHasRootCauseIssue(deficiency);
  const preventiveIssue = deficiencyHasPreventiveIssue(deficiency);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
      <DeficiencyReviewPaneHeader caseContext={caseContext} />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 p-4">
          {deficiency.reviewAlerts.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-inspection-warning/30 bg-inspection-warning-bg/30 p-3">
              <SectionLabel>AI Review Alerts</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {deficiency.reviewAlerts.map((alert) => (
                  <Badge
                    key={`${alert.type}-${alert.message}`}
                    variant={getReviewAlertBadgeVariant(alert.type)}
                    size="xs"
                  >
                    {REVIEW_ALERT_LABELS[alert.type]}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {deficiency.reviewAlerts.map((alert) => (
                  <p
                    key={`msg-${alert.type}-${alert.message}`}
                    className="text-sm leading-relaxed text-foreground"
                  >
                    {alert.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {caseContext.criticalMatter && caseContext.criticalMatterNote && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">
                  Critical Matter Note
                </CardTitle>
                <CardDescription>{caseContext.criticalMatterNote}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle>
                No.{titleNo} · Code {deficiency.code}
              </CardTitle>
              <CardDescription>{deficiency.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {deficiency.regulatoryCite && (
                <p className="text-sm text-muted-foreground">
                  Regulatory cite: {deficiency.regulatoryCite}
                </p>
              )}
              {deficiency.actionCode && (
                <p className="text-sm text-muted-foreground">
                  Action code: {deficiency.actionCode}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <SectionLabel>Root Cause &amp; Preventive Review</SectionLabel>
            <ReviewFieldCard
              label="Original Finding"
              text={deficiency.description}
            />
            <ReviewFieldCard
              label="Vessel Cause"
              text={deficiency.cr5RootCause}
              tone={rootCauseIssue ? "warning" : "default"}
            />
            <ReviewFieldCard
              label="Corrective Action"
              text={deficiency.cr6Correction}
            />
            <ReviewFieldCard
              label="Preventive Action"
              text={deficiency.cr5Contingency}
              tone={preventiveIssue ? "warning" : "default"}
            />
          </div>

          {deficiency.reviewQuestions.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Questions for Master (5)</CardTitle>
                <CardDescription>
                  Draft in Follow-up Output → Vessel Revision EN tab
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-foreground">
                  {deficiency.reviewQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {deficiency.isDemoFocus && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Demo focus: fire door deficiency (07105). Review emphasizes why
                quarterly inspection did not prevent PSC finding.
              </p>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
