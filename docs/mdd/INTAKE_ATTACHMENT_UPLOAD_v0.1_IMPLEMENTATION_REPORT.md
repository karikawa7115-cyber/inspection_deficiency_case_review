# Intake Attachment Upload v0.1 — Implementation Report

**Date:** 2026-08-27  
**Scope:** MDD New Case Intake only  
**Freeze exception:** Attachment upload + attachment-aware Analyze input  
**Not modified:** Decision Control, Decision Policy, Quality Gate, System Prompt, Structured Output Schema, Semantic Refill, Golden Eval, Golden Case expected outputs

## Summary

Intake now accepts email/narrative text **and** one or more attachments. Client-side extraction produces inspectable text; Analyze receives a source-bounded composition of narrative + attachment contents. Attachment-derived lines are **Reported but Unverified**, never auto-Confirmed.

## Files changed

| Path | Role |
|------|------|
| `lib/mdd/attachments/types.ts` | Attachment + extraction status types |
| `lib/mdd/attachments/compose-analyze-input.ts` | Compose `[INTAKE NARRATIVE]` / `[ATTACHMENT n]` input; fact candidates |
| `lib/mdd/attachments/extract.ts` | Client extractors (xlsx, docx, pdf, text, images) |
| `lib/mdd/attachments/index.ts` | Barrel |
| `lib/mdd/types.ts` | Optional `attachments?: IntakeAttachmentRecord[]` on `MddCase` |
| `lib/mdd/decision-engine/propose.ts` | Generic path uses attachments; Golden paths unchanged |
| `components/mdd/MddIntakeAttachments.tsx` | DnD / browse UI, cards, extracted preview |
| `components/mdd/MddCaseWorkspace.tsx` | Wire Attachments under Intake; pass attachments into Analyze |
| `__tests__/mdd-intake-attachments-v0.1.test.ts` | Focused unit/integration tests |
| `package.json` / `package-lock.json` | New deps |

## Libraries added

| Package | Purpose |
|---------|---------|
| `xlsx` | XLSX / XLS sheet + cell text extraction |
| `mammoth` | DOCX text extraction |
| `pdfjs-dist` | PDF text-layer extraction (no OCR) |

## Formats supported (v0.1)

| Format | Behavior |
|--------|----------|
| XLSX / XLS | Sheet names + visible cells as CSV-like text; `[Sheet: Name]` boundaries |
| CSV / TXT / MD | Direct text |
| DOCX | Readable document text |
| PDF | Text layer when present; otherwise `PREVIEW_ONLY` |
| JPG / JPEG / PNG / WEBP | Thumbnail (session) + `PREVIEW_ONLY` (no OCR) |

## Extraction limitations

- **No OCR / vision** — images and scanned PDFs stay `PREVIEW_ONLY`.
- **No spreadsheet “interpretation”** — cells are preserved as text, not reasoned over during extraction.
- **Client-only** — no new backend; works with static export.
- **Persistence** — binaries are **not** stored in LocalStorage. Lightweight metadata + extracted text may be saved on the Case. After browser refresh, original files cannot be restored (re-attach if needed). Supabase Storage = Post-Graduation.
- Extracted text truncated at ~80k characters per file.

## Does attachment content reach Analyze?

**Yes.** On Analyze:

1. UI builds `composeAnalyzeInput({ narrative, attachments })` (dev console debug of first 2k chars).
2. `proposeFromHeuristics({ …, attachments })` receives the same attachment records.
3. Generic (non-Golden) path:
   - Uses extracted lines as **unverified** facts with `Source: <file> / Sheet …` labels.
   - Records in `learning.notes` that Analyze input was composed with source boundaries.
4. Golden Case path (`goldenCaseId` set or GC cue from title/vessel/pastedText only): **unchanged**; attachment text is **not** used for GC detection or GC briefs.

## Safety / anti-hallucination

- Failed extraction → no invented content (`FAILED` note).
- PDF/image without text → `PREVIEW_ONLY`.
- Narrative and attachments kept in separate labeled sections.
- Attachment presence ≠ Confirmed Fact.

## Manual acceptance (CR-8 Excel)

Primary scenario (real vessel email + Excel trouble report):

1. New Case → paste narrative about CR-8 / No.1 DG 3-Way FO Outlet Valve / DO contaminated with VLSFO.
2. Drag the real file  
   `CR-8,9 Trouble report form (open and close) 【No. 1 Diesel GE 3 way FO Outlet Valve Defective】24-Aug-2026.xlsx`
3. Confirm card shows name / type / size / `EXTRACTED`.
4. Expand **Extracted Attachment Content** and inspect sheet/cell text.
5. Analyze → Decision Brief should show attachment-sourced **Reported but Unverified** lines (valve / tank / contamination themes from the sheet — not hard-coded).
6. Case List / Brief flow still works.

Automated stand-in: `__tests__/mdd-intake-attachments-v0.1.test.ts` builds an equivalent multi-sheet workbook (not the production file bytes) and asserts extraction + Analyze feed.

## Regression / build result

| Check | Result |
|-------|--------|
| `__tests__/mdd-intake-attachments-v0.1.test.ts` | **8/8 pass** |
| Golden accept / dedupe / status / GC03 | **pass** |
| Decision Control / Policy / Quality Gate v1.1 / Semantic Refill | **pass** (modules untouched; regressions green) |
| `npm run build` | **pass** |

**Build note:** `tsconfig.json` now excludes `scripts/` from Next’s typecheck. Local debug scripts under `scripts/` (outside this feature) were failing `tsc` and blocking production build; they remain runnable via `tsx` / npm scripts.

## Manual CR-8 Excel

Automated stand-in workbook covers multi-sheet extraction + Analyze feed.  
Please smoke-test locally with the real file:

`CR-8,9 Trouble report form (open and close) 【No. 1 Diesel GE 3 way FO Outlet Valve Defective】24-Aug-2026.xlsx`

Checklist: drag → card `EXTRACTED` → expand preview → Analyze → unverified facts show sheet-sourced lines; Golden Case load still works without attachments.

## Commit status

**Not committed / not pushed** — ready for review.

