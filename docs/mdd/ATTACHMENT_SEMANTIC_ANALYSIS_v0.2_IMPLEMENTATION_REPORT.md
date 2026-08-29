# Attachment Semantic Analysis v0.2 — Implementation Report

**Date:** 2026-08-28  
**Scope:** Generic (non-Golden) Analyze path + Japanese-first UI labels  
**Not modified:** Decision Control, Decision Policy, Quality Gate rules, Structured Output Schema v1.0, Semantic Refill, Golden Eval, Golden Case expected briefs

## Architecture change (minimum)

```
Intake narrative + attachments + follow-ups
        │
        ├─ composeAnalyzeInput()          (unchanged — source boundaries for debug/LLM)
        │
        ├─ normalizeAnalyzeEvidence()     NEW — separate units (narrative / sheet / follow-up)
        │
        └─ synthesizeAttachmentSemantics() NEW — bounded heuristic synthesis
                │
                └─ proposeGeneric() only
                     (Golden paths untouched)
```

UI-only Brief fields (not Schema v1.0):

- `suggestedQuestionsToVessel` (existing)
- `proposedCurrentDecisionQuestion` (new)

## Files changed

| Path | Role |
|------|------|
| `lib/mdd/attachments/normalize-evidence.ts` | Evidence units + source labels |
| `lib/mdd/attachments/semantic-synthesis-v0.2.ts` | CDQ / recommendation / why / missing / filtered questions |
| `lib/mdd/attachments/index.ts` | Exports |
| `lib/mdd/decision-engine/propose.ts` | Generic path wires v0.2; no-attachment baseline preserved |
| `lib/mdd/types.ts` | Optional UI-only `proposedCurrentDecisionQuestion` |
| `lib/mdd/ui-labels-ja.ts` | Japanese-first display strings |
| `components/mdd/MddCaseWorkspace.tsx` | CDQ block, JA labels, source on unverified facts |
| `components/mdd/MddIntakeAttachments.tsx` | JA labels + extraction status JA |
| `components/mdd/MddFollowUpThread.tsx` | JA labels |
| `components/mdd/MddStatusBadges.tsx` | JA readiness / status display |
| `__tests__/mdd-attachment-semantic-v0.2.test.ts` | New |
| `__tests__/mdd-intake-attachments-v0.1.test.ts` | Expectations updated for v0.2 |
| `docs/mdd/ATTACHMENT_SEMANTIC_ANALYSIS_v0.2_IMPLEMENTATION_REPORT.md` | This report |

## Dependencies added

**None.**

## Embedded image analysis

**DEFERRED.**

- XLSX cell/sheet text continues to be extracted.
- No vision / OCR of embedded workbook photos in v0.2 (would require unsafe or fragile client vision without MVP stability).
- Synthesis notes explicitly record that embedded image vision is deferred.
- Allowed visual conclusions are therefore **not** produced; no unsupported internal-failure inferences.

## Before / after (CR-8/CR-9 style stand-in)

| Aspect | Before | After (v0.2) |
|--------|--------|--------------|
| Attachment cards after Analyze | Persist (prior fix) | Persist |
| Sheet inspectability | Yes | Yes |
| Brief `why` | Often generic / thin ingest note | Evidence established + unresolved + readiness reason |
| Recommendation | Generic “review / organize facts…” | Superintendent-led technical checklist from evidence topics |
| Current Decision Question | Missing | Proposed (UI-only) |
| President Decision | Often pending structured facts | Explicitly **not forced** unless escalation triggers |
| Suggested questions | Stock list even when answered | Filtered by covered topics |
| Missing Information | Generic “structure facts” | Who / What / Evidence after checking intake+attachments |
| Source provenance | Weak in Detail | `evidenceRequired` shown under Reported facts |
| UI language | English-heavy | Japanese-first labels (enums unchanged) |

## Regression test results

| Suite | Result |
|-------|--------|
| `__tests__/mdd-attachment-semantic-v0.2.test.ts` | pass |
| `__tests__/mdd-intake-attachments-v0.1.test.ts` | pass |
| `__tests__/mdd-followup-continuity-v0.1.test.ts` | pass |
| `__tests__/mdd-decision-control-v0.1.test.ts` | pass |

(Re-run after final test fix in the same session.)

## Japanese UI

Display-only (`lib/mdd/ui-labels-ja.ts`). Canonical enums / schema keys / APIs unchanged. Vessel/source quotations remain in original language.

## Known limitations

1. Synthesis is **heuristic** (keyword / topic coverage), not LLM reasoning — may miss nuanced workbook wording.
2. Readiness remains **NOT_READY** while attachment facts are unverified (Gate/Control untouched).
3. Embedded XLSX photos: detect/vision **deferred**.
4. No Supabase; LocalStorage case store unchanged.
5. Some Brief recommendation / why / next-action text is still English (operational content for traceability); chrome/labels are Japanese-first.

## Commit status

**Not committed / not pushed** (per request).
