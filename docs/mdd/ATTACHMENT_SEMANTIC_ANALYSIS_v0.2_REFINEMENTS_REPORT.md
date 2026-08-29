# Attachment Semantic Analysis v0.2 — Final Refinements Report

**Date:** 2026-08-29  
**Scope:** Four refinements only (authorities, readiness/Why consistency, suggested-question filter, Japanese-first Brief content)  
**Not modified:** Decision Control rules engine, Decision Policy, Quality Gate logic (only Why alignment after Gate), Structured Output Schema, Semantic Refill, Golden Eval / Golden Case briefs

## Files changed

| Path | Change |
|------|--------|
| `lib/mdd/attachments/semantic-synthesis-v0.2.ts` | Concrete authorities; JA recommendation/why/next/questions; stronger Q filter; propose CONDITIONAL when material attachment exists |
| `lib/mdd/decision-engine/propose.ts` | `alignWhyWithFinalReadiness`; `applyGateToBrief` rewrites Why to final Gate readiness; JA no-attachment baseline |
| `__tests__/mdd-attachment-semantic-v0.2.test.ts` | Coverage for all 4 refinements |
| `__tests__/mdd-intake-attachments-v0.1.test.ts` | Expectations updated |
| `__tests__/mdd-followup-continuity-v0.1.test.ts` | JA question pattern |
| `docs/mdd/ATTACHMENT_SEMANTIC_ANALYSIS_v0.2_REFINEMENTS_REPORT.md` | This report |

## Behavior changed (4 items)

### 1. Decision Authorities — no vague `Other`
- Technical cases now emit:
  - 本船の技術状況・一時措置・修理実施 → **Master** (notes: C/E)
  - 岸側の技術確認・修理調整・部品・技術フォロー → **Superintendent**
  - Class / 法定の通知・受理 → **Class**
  - 経営承認（Escalation 時のみ） → **President/DP** (`not_required` when no escalation triggers)
- Invalid `Class/Flag` string removed; uses canonical `Class`.
- No CR-8 hard-coding.

### 2. Readiness ↔ Why consistency
- Synthesis Why no longer embeds a hard `Readiness is NOT_READY` verdict.
- Material attachment path proposes **CONDITIONAL** pre-Gate (conditions = remaining confirmations).
- **`applyGateToBrief`** now sets `decisionReadiness = enforcedReadiness` **and** rewrites Why via `alignWhyWithFinalReadiness` so UI badge and explanation cannot disagree.
- Focused regression tests cover CONDITIONAL with no NOT_READY leak.

### 3. Suggested Questions filter
- Compares candidates to intake + attachment evidence corpus.
- Suppresses questions already answered (temporary measures, contamination/isolation, etc.).
- Prefers follow-ups like「一時措置後の…使用可否」when measures are already in evidence.
- Questions are Japanese-first.

### 4. Japanese-first Brief content
- Recommendation / President Decision / Why / Next Actions / Suggested Questions / authority roleLabels generated in Japanese (maritime terms kept: Master, C/E, Superintendent, Class, Flag, President/DP, READY/CONDITIONAL/NOT_READY).
- Raw attachment quotations remain English as extracted.

## CR-8 before / after (summary)

| Item | Before | After |
|------|--------|-------|
| Authorities | `… → Other` | Master / Superintendent / Class / President/DP |
| Badge vs Why | CONDITIONAL badge + “NOT_READY” in Why possible | Why ends with Gate-owned readiness label |
| Vessel questions | Could re-ask temporary/contamination | Suppressed when materially present; ask remaining gaps |
| Brief prose | English-heavy | Japanese-first operational prose |

## Regression results

| Suite | Result |
|-------|--------|
| `mdd-attachment-semantic-v0.2` | pass |
| `mdd-intake-attachments-v0.1` | pass |
| `mdd-followup-continuity-v0.1` | pass |
| `mdd-decision-control-v0.1` | pass |

## Known limitations

1. Synthesis remains heuristic (not LLM).
2. Gate may still adjust readiness; Why is reconciled after Gate, but other English Gate messages are unchanged.
3. Embedded XLSX image vision still deferred.
4. Some learning notes / internal tags remain English for traceability.

## Commit status

**Not committed / not pushed.**
