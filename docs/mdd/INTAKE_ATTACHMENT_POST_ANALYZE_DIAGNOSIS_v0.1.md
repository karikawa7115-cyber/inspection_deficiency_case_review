# Intake Attachment — Post-Analyze Visibility Diagnosis & Fix (v0.1)

**Date:** 2026-08-28  
**Scope:** Attachment Intake visibility + Analyze feed for real CR-8/CR-9 XLSX  
**Not modified:** Decision Control, Decision Policy, Quality Gate, System Prompt, Structured Output Schema, Semantic Refill, Golden Eval

## Verdict

**Failure point:** Case Intake **stale React state** on Title / Vessel / Narrative  
(`setCaseData({ ...caseData, … })` / `persist({ ...caseData, … })`) **wiped `attachments`** from in-memory state and LocalStorage before or during Analyze.

XLSX extraction itself is OK. When attachments survive into `proposeFromHeuristics`, Analyze **does** receive sheet-bounded text. The generic Brief line *“Insufficient structured analysis for a management decision”* is exactly what the generic path emits when **`extractedAttachments.length === 0`** (empty or non-EXTRACTED attachments).

## Trace (CR-8/CR-9 XLSX path)

| Step | Expected | Actual (before fix) |
|------|----------|---------------------|
| 1. File selected/dropped | Accepted if `.xlsx` | OK — `processFiles` → `EXTRACTING` row |
| 2. XLSX parsing | `xlsx` workbook read | OK — `extractSpreadsheet` |
| 3. Sheet names + text | `[Sheet: Name]` + CSV-like rows | OK in extractor / unit tests |
| 4. Stored on case | `MddCase.attachments[]` (metadata + `extractedContent`) | **Often lost** — overwritten by stale intake field update/persist |
| 5. Analyze payload | `composeAnalyzeInput` + `proposeFromHeuristics({ attachments })` | **Empty `attachments`** when wipe won the race |
| 6. Semantic / heuristic input | Unverified facts from sheet lines; `why` mentions attachment ingest | **Generic why**; no attachment-sourced facts |
| 7. After Analyze UI | File name, status, sheets, expand content | **Only drop zone** (`attachments: []`) |

## Root cause (precise)

`MddCaseWorkspace` mixed two update styles:

1. **Attachments / follow-ups:** functional merge onto latest (`setCaseData(prev => …)`).
2. **Title / Vessel / Narrative:** non-functional `{ ...caseData, field }` from a **render closure**.

Typical real-test sequence:

1. User pastes narrative (closure snapshot has `attachments: []`).
2. User drops CR-8/CR-9 Excel → attachments appear (EXTRACTED).
3. User edits narrative again, blurs a field, or races Analyze with a blur/persist using the **pre-attach snapshot**.
4. Persist writes a case **without attachments**.
5. Analyze runs with `attachments: []` → Brief `why` = *Insufficient structured analysis…*.
6. Case screen re-renders from that saved case → Attachments drop zone only.

Secondary risk (same class): `runAnalyze` closed over `caseData` instead of a live ref, so a late extract completion could also be missed.

**Not the failure point:** XLSX library, sheet boundary format, Quality Gate / Control / Prompt / Schema, Golden path (unchanged and unused for this New Case).

## Minimum fixes applied

1. **`caseDataRef` + `patchCase`** — Intake fields and attachment/follow-up updates always merge onto the latest case; persist syncs the ref before await.
2. **`runAnalyze`** — Reads attachments/follow-ups from `caseDataRef` (re-reads after ANALYZING / before final persist); richer `console.debug` of attachment feed in development.
3. **Human essentials persist** — Merges onto latest and refuses to drop `attachments` / `followUps`.
4. **`MddIntakeAttachments` UI** — After Analyze (and before): file name, status badge, extracted char count, **sheet name badges**, per-file expandable inspect of extracted content (incl. `[Sheet: …]` boundaries).
5. **`listSheetNamesFromExtracted`** helper + regression tests (wipe pattern + generic vs attachment `why`).

## How to confirm Analyze received Excel text

After fix, on a New Case with CR-8/CR-9 XLSX:

1. Card stays listed after Analyze with `EXTRACTED` + sheet badges.
2. Expand **Inspect extracted content** → see `[Sheet: …]` blocks.
3. Decision Brief:
   - `why` mentions attachment ingest (not the generic insufficient line).
   - Unverified facts include sheet-sourced lines / `Source: <file> / Sheet …`.
   - Learning notes mention source boundaries.
4. DevTools console (local): `[MDD Analyze attachments]` shows file + sheet markers.

## No-attachment flow

Unchanged: empty `attachments: []` → same generic NOT_READY Brief as before.

## Commit status

**Not committed / not pushed** (per request).
