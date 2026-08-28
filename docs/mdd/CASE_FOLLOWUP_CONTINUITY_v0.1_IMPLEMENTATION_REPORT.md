# Case Follow-up Continuity v0.1 — Implementation Report

**Date:** 2026-08-28  
**Decisions locked:** Author optional · per-follow-up attachments · reset confirm on Re-analyze · Brief chips for suggested vessel questions  

## What shipped

- Same Case **Follow-up thread** under Intake (add / remove; optional author; per-follow-up attachments)
- Analyze / Re-analyze composes `[FOLLOW-UP n]` (+ nested attachments) with source boundaries
- Generic heuristic path surfaces follow-up text as **Reported but Unverified** and emits **Suggested questions to vessel** chips (click to copy)
- Human confirmation flags reset on every Analyze / Re-analyze
- Golden Case path ignores follow-ups / chips (unchanged)

## Files

| Path | Role |
|------|------|
| `docs/mdd/CASE_FOLLOWUP_CONTINUITY_v0.1_DESIGN_PROPOSAL.md` | Accepted decisions |
| `lib/mdd/types.ts` | `CaseFollowUp`, `suggestedQuestionsToVessel?` on UI Brief |
| `lib/mdd/attachments/compose-analyze-input.ts` | Follow-up composition |
| `lib/mdd/decision-engine/propose.ts` | Generic follow-up + question chips |
| `components/mdd/MddFollowUpThread.tsx` | Follow-up UI |
| `components/mdd/MddIntakeAttachments.tsx` | `title` / `compact` |
| `components/mdd/MddCaseWorkspace.tsx` | Wire thread + chips |
| `__tests__/mdd-followup-continuity-v0.1.test.ts` | Focused tests |

## Not changed

Control · Policy · Gate · Prompt · Structured Output Schema v1.0 · Golden Spec/Eval
