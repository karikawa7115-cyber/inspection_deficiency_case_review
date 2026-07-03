"use client";

import { useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";

import { useDeficiencyDatabase } from "@/hooks/use-deficiency-database";
import {
  applyDbDeficiencyFilters,
  collectFilterOptions,
  computeDbSummaryStats,
  DB_ALERT_LABELS,
  DB_CASE_STATUS_LABELS,
  DB_INTERNAL_AUDIT_STATUS_LABELS,
  DB_RISK_LEVEL_LABELS,
  deriveDbAlerts,
  getDbAlertBadgeVariant,
  getDbCaseStatusVariant,
  getDbRiskLevelVariant,
} from "@/lib/inspection/db-alerts";
import {
  EMPTY_DB_FILTERS,
  type DbDeficiencyDetail,
  type DbDeficiencyFilters,
} from "@/lib/inspection/db-types";
import { INSPECTION_PANE_CAPTIONS } from "@/lib/inspection/visual-semantics";
import { InspectionPaneChrome } from "@/components/inspection/InspectionPaneChrome";
import { SectionLabel } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

function getInternalAuditStatusVariant(
  status: DbDeficiencyDetail["internal_audit_status"],
): "neutral" | "success" | "warning" {
  if (status === "candidate") return "warning";
  if (status === "added") return "success";
  return "neutral";
}

function ReadOnlyBlock({ label, text }: { label: string; text?: string | null }) {
  return (
    <Card size="sm">
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

type SummaryCardProps = {
  label: string;
  value: number;
  accentClass: string;
};

function SummaryCard({ label, value, accentClass }: SummaryCardProps) {
  return (
    <Card size="sm" className="min-w-36 flex-1">
      <CardHeader className="flex flex-row items-center gap-2 pb-0">
        <span className={cn("h-8 w-1 shrink-0 rounded-full", accentClass)} />
        <div className="flex flex-col gap-0.5">
          <CardTitle emphasis="prominent">{label}</CardTitle>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardHeader>
      <CardContent className="sr-only">{value}</CardContent>
    </Card>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value === "" ? "all" : value}
        onValueChange={(next) => onChange(next === "all" ? "" : (next ?? ""))}
      >
        <SelectTrigger className="w-full bg-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type BooleanFilterToggleProps = {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

function BooleanFilterToggle({
  label,
  pressed,
  onPressedChange,
}: BooleanFilterToggleProps) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      className={cn(pressed && "border-inspection-info/40 bg-inspection-info-bg/50")}
    >
      {label}
    </Toggle>
  );
}

function DatabaseErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Database className="size-10 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Could not load Deficiency Database
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function DatabaseLoadingState() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Skeleton className="h-24 w-full" />
      <div className="flex min-h-0 flex-1 gap-4">
        <Skeleton className="h-full min-h-64 w-2/5" />
        <Skeleton className="h-full min-h-64 flex-1" />
      </div>
    </div>
  );
}

function DeficiencyDatabaseDetail({ row }: { row: DbDeficiencyDetail | null }) {
  if (!row) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Select a deficiency to view details
      </div>
    );
  }

  const alerts = deriveDbAlerts(row);
  const rootCauseWarning =
    row.root_cause_status === "too_general" ||
    row.root_cause_status === "shallow";
  const preventiveWarning = row.preventive_action_status === "weak";

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-foreground">
            No.{String(row.deficiency_no).padStart(2, "0")} · {row.category} ·{" "}
            {row.title}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={getDbRiskLevelVariant(row.risk_level)} size="xs">
              {DB_RISK_LEVEL_LABELS[row.risk_level]}
            </Badge>
            <Badge variant={getDbCaseStatusVariant(row.case_status)} size="xs">
              {DB_CASE_STATUS_LABELS[row.case_status]}
            </Badge>
            {alerts.map((kind) => (
              <Badge
                key={kind}
                variant={getDbAlertBadgeVariant(kind)}
                size="xs"
              >
                {DB_ALERT_LABELS[kind]}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <SectionLabel>Finding &amp; Actions</SectionLabel>
          <ReadOnlyBlock label="Original Finding" text={row.original_finding} />
          <ReadOnlyBlock
            label="Vessel Cause"
            text={row.vessel_cause}
          />
          <ReadOnlyBlock
            label="Corrective Action"
            text={row.corrective_action}
          />
          <ReadOnlyBlock
            label="Preventive Action"
            text={row.preventive_action}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card
            size="sm"
            className={cn(
              rootCauseWarning &&
                "border-inspection-warning/35 bg-inspection-warning-bg/40",
            )}
          >
            <CardHeader className="pb-0">
              <CardTitle emphasis="prominent">Root Cause Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{row.root_cause_status}</p>
            </CardContent>
          </Card>
          <Card
            size="sm"
            className={cn(
              preventiveWarning &&
                "border-inspection-warning/35 bg-inspection-warning-bg/40",
            )}
          >
            <CardHeader className="pb-0">
              <CardTitle emphasis="prominent">Preventive Action Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">
                {row.preventive_action_status}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <SectionLabel>Follow-up &amp; Handover</SectionLabel>
          <ReadOnlyBlock
            label="Company Review Comment"
            text={row.company_review_comment}
          />
          <ReadOnlyBlock
            label="Vessel Revision Request"
            text={row.vessel_revision_request}
          />
          <ReadOnlyBlock label="Handover Note" text={row.handover_note} />
          <ReadOnlyBlock label="Training Point" text={row.training_point} />
          <ReadOnlyBlock label="Owner Summary" text={row.owner_summary} />
        </div>

        <div className="flex flex-col gap-3">
          <SectionLabel>Internal Audit</SectionLabel>
          <ReadOnlyBlock
            label="Internal Audit Checklist Item"
            text={row.internal_audit_checklist_item}
          />
          <ReadOnlyBlock label="How to Check" text={row.how_to_check} />
          <ReadOnlyBlock label="Required Evidence" text={row.required_evidence} />
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={getInternalAuditStatusVariant(row.internal_audit_status)}
              size="xs"
            >
              {DB_INTERNAL_AUDIT_STATUS_LABELS[row.internal_audit_status]}
            </Badge>
            {row.handover_required && (
              <Badge variant="handover" size="xs">
                Handover Required
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        <ReadOnlyBlock
          label="Source Inspection Case"
          text={`${row.case_id} · ${row.inspection_type} · ${row.inspection_date} · ${row.port}, ${row.country}`}
        />
      </div>
    </ScrollArea>
  );
}

export function DeficiencyDatabaseView() {
  const { state, listRows } = useDeficiencyDatabase();
  const [filters, setFilters] = useState<DbDeficiencyFilters>(EMPTY_DB_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterOptions = useMemo(
    () => collectFilterOptions(listRows),
    [listRows],
  );

  const filteredRows = useMemo(
    () => applyDbDeficiencyFilters(listRows, filters),
    [listRows, filters],
  );

  const summaryStats = useMemo(
    () => computeDbSummaryStats(listRows),
    [listRows],
  );

  const selectedDetail = useMemo(() => {
    if (state.status !== "ready" || !selectedId) return null;
    return state.rows.find((row) => row.id === selectedId) ?? null;
  }, [state, selectedId]);

  const updateFilter = <K extends keyof DbDeficiencyFilters>(
    key: K,
    value: DbDeficiencyFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (state.status === "loading") {
    return <DatabaseLoadingState />;
  }

  if (state.status === "error") {
    return <DatabaseErrorState message={state.message} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
        <InspectionPaneChrome
          title="Deficiency Database"
          paneCaption={INSPECTION_PANE_CAPTIONS.p1}
          className="border-none bg-transparent px-0 py-0 shadow-none"
        />
        <p className="text-sm text-muted-foreground">
          Read-only search across anonymized historical deficiencies (Supabase).
        </p>

        <div className="flex flex-wrap gap-3">
          <SummaryCard
            label="Total Deficiencies"
            value={summaryStats.total}
            accentClass="bg-inspection-info"
          />
          <SummaryCard
            label="Repeated"
            value={summaryStats.repeated}
            accentClass="bg-destructive"
          />
          <SummaryCard
            label="Root Cause Too General"
            value={summaryStats.rootCauseTooGeneral}
            accentClass="bg-inspection-warning"
          />
          <SummaryCard
            label="Preventive Action Too Weak"
            value={summaryStats.preventiveTooWeak}
            accentClass="bg-inspection-warning"
          />
          <SummaryCard
            label="Internal Audit Candidates"
            value={summaryStats.internalAuditCandidates}
            accentClass="bg-inspection-success"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-inspection-neutral-bg/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionLabel>Filter Panel</SectionLabel>
          <p className="text-sm text-muted-foreground">
            {filteredRows.length} of {listRows.length} deficiencies
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-md">
            <Label htmlFor="db-keyword">Keyword Search</Label>
            <Input
              id="db-keyword"
              value={filters.keyword}
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="Vessel, title, category, port..."
              className="bg-card"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Vessel"
              value={filters.vesselCode}
              placeholder="All vessels"
              options={filterOptions.vessels.map((v) => ({
                value: v.code,
                label: `${v.name} (${v.code})`,
              }))}
              onChange={(value) => updateFilter("vesselCode", value)}
            />
            <FilterSelect
              label="Inspection Type"
              value={filters.inspectionType}
              placeholder="All types"
              options={filterOptions.inspectionTypes.map((type) => ({
                value: type,
                label: type,
              }))}
              onChange={(value) => updateFilter("inspectionType", value)}
            />
            <FilterSelect
              label="Category"
              value={filters.category}
              placeholder="All categories"
              options={filterOptions.categories.map((category) => ({
                value: category,
                label: category,
              }))}
              onChange={(value) => updateFilter("category", value)}
            />
            <FilterSelect
              label="Risk Level"
              value={filters.riskLevel}
              placeholder="All levels"
              options={filterOptions.riskLevels.map((level) => ({
                value: level,
                label:
                  DB_RISK_LEVEL_LABELS[
                    level as keyof typeof DB_RISK_LEVEL_LABELS
                  ] ?? level,
              }))}
              onChange={(value) => updateFilter("riskLevel", value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <BooleanFilterToggle
              label="Repeated Only"
              pressed={filters.repeatedOnly}
              onPressedChange={(pressed) =>
                updateFilter("repeatedOnly", pressed)
              }
            />
            <BooleanFilterToggle
              label="Root Cause Too General Only"
              pressed={filters.rootCauseTooGeneralOnly}
              onPressedChange={(pressed) =>
                updateFilter("rootCauseTooGeneralOnly", pressed)
              }
            />
            <BooleanFilterToggle
              label="Preventive Action Too Weak Only"
              pressed={filters.preventiveActionTooWeakOnly}
              onPressedChange={(pressed) =>
                updateFilter("preventiveActionTooWeakOnly", pressed)
              }
            />
            <BooleanFilterToggle
              label="Handover Required Only"
              pressed={filters.handoverRequiredOnly}
              onPressedChange={(pressed) =>
                updateFilter("handoverRequiredOnly", pressed)
              }
            />
            <BooleanFilterToggle
              label="Internal Audit Checklist Candidate Only"
              pressed={filters.internalAuditCandidateOnly}
              onPressedChange={(pressed) =>
                updateFilter("internalAuditCandidateOnly", pressed)
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_DB_FILTERS)}
            >
              <RefreshCw />
              Reset filters
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        <div className="flex w-[min(100%,42rem)] shrink-0 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
          <div className="flex h-10 items-center border-b border-border px-3">
            <SectionLabel>Results</SectionLabel>
          </div>
          <ScrollArea className="flex-1">
            {filteredRows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No deficiencies match the current filters.
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto p-2">
                <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="px-2 py-2.5 font-medium">Vessel</th>
                      <th className="px-2 py-2.5 font-medium">Inspection Date</th>
                      <th className="px-2 py-2.5 font-medium">Inspection Type</th>
                      <th className="px-2 py-2.5 font-medium">Port</th>
                      <th className="px-2 py-2.5 font-medium">Category</th>
                      <th className="px-2 py-2.5 font-medium">Deficiency Title</th>
                      <th className="px-2 py-2.5 font-medium">Risk Level</th>
                      <th className="px-2 py-2.5 font-medium">Alerts</th>
                      <th className="px-2 py-2.5 font-medium">Case Status</th>
                      <th className="px-2 py-2.5 font-medium">Internal Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const selected = row.id === selectedId;
                      const alerts = deriveDbAlerts(row);

                      return (
                        <tr
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(row.id);
                            }
                          }}
                          className={cn(
                            "cursor-pointer border-b border-border/60 transition-colors",
                            selected
                              ? "border-l-4 border-l-inspection-info bg-inspection-info-bg/40"
                              : "border-l-4 border-l-transparent hover:bg-muted/50",
                          )}
                        >
                          <td className="px-2 py-2.5 font-medium text-foreground">
                            {row.vessel_name}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {row.inspection_date}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {row.inspection_type}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {row.port}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {row.category}
                          </td>
                          <td className="max-w-48 px-2 py-2.5 text-foreground">
                            <span className="line-clamp-2">{row.title}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <Badge
                              variant={getDbRiskLevelVariant(row.risk_level)}
                              size="xs"
                            >
                              {DB_RISK_LEVEL_LABELS[row.risk_level]}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {alerts.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                alerts.map((kind) => (
                                  <Badge
                                    key={kind}
                                    variant={getDbAlertBadgeVariant(kind)}
                                    size="xs"
                                  >
                                    {DB_ALERT_LABELS[kind]}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <Badge
                              variant={getDbCaseStatusVariant(row.case_status)}
                              size="xs"
                            >
                              {DB_CASE_STATUS_LABELS[row.case_status]}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5">
                            <Badge
                              variant={getInternalAuditStatusVariant(
                                row.internal_audit_status,
                              )}
                              size="xs"
                            >
                              {
                                DB_INTERNAL_AUDIT_STATUS_LABELS[
                                  row.internal_audit_status
                                ]
                              }
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
          <div className="flex h-10 items-center border-b border-border px-4">
            <SectionLabel>Detail</SectionLabel>
          </div>
          <DeficiencyDatabaseDetail row={selectedDetail} />
        </div>
      </div>
    </div>
  );
}
