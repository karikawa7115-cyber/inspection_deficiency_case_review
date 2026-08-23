# Semantic Refill v0.3 — Implementation Report

**Status:** IMPLEMENTED (deterministic) — **no live LLM rerun**  
**Date:** 2026-08-23  
**Design:** `docs/mdd/SEMANTIC_REFILL_v0.3_DESIGN_PROPOSAL.md` (L1–L7 approved as recommended)

**Does not modify:** Decision Policy v0.2 · Pipeline ownership contracts (v0.1.2 stages retained; refill is additive) · System Prompt v1.0 · Structured Output Schema v1.0 · Quality Gate Rules v1.1 · Golden Spec / Eval · Source Provenance design

---

## 1. What was implemented

Bounded **President Decision text** refill only:

| Item | Detail |
| --- | --- |
| Trigger | `requiredNow=true` ∧ prose absent/contradictory/not-required ∧ `NEEDS_SEMANTIC_FILL=true` |
| Writable | `executive.presidentDecision.text` only (`requiredNow` forced true, not flipped) |
| Pipeline | `Control → Semantic Refill → Gate` |
| Flag | `MDD_SEMANTIC_REFILL_V03=1\|true\|yes\|on` (independent of Control) |
| Model | Configurable via `MDD_SEMANTIC_REFILL_MODEL` (default `gpt-4o-mini`) |
| Fail-closed | Rejected refill keeps original PD + NSF; records attempt |
| Success | `needsSemanticFill=false`; finding `SEMANTIC_REFILL_APPLIED`; original PD in audit / `originalLlmDraft` |

### 1.1 Modules

| Path | Role |
| --- | --- |
| `lib/mdd/semantic-refill/prose-defect.ts` | Absent / not-required / contradictory detectors |
| `lib/mdd/semantic-refill/build-payload.ts` | Allowlisted refill inputs (no readiness) |
| `lib/mdd/semantic-refill/prompt.ts` | Separate refill prompt (not System Prompt v1.0) |
| `lib/mdd/semantic-refill/validate.ts` | Bounded deterministic validator |
| `lib/mdd/semantic-refill/apply.ts` | Apply / reject / NSF clear |
| `lib/mdd/semantic-refill/call-llm.ts` | Live refill LLM call (json_object `{text}`) |
| `lib/mdd/semantic-refill/run-stage.ts` | Stage orchestration |
| `lib/mdd/semantic-refill/feature-flag.ts` | Flag + model resolve |

### 1.2 Control alignment

R4 NSF emission expanded to absent / contradictory / not-required (shared detectors). Message updated to reference Semantic Refill v0.3. Finding codes added: `SEMANTIC_REFILL_APPLIED`, `SEMANTIC_REFILL_REJECTED`.

### 1.3 Wiring

- `runGoldenLlmEvalPipeline` is **async**; runs refill when flag on + NSF; supports injected `semanticRefillProposedText` for tests and `semanticRefillLlmConfig` for live.
- `app/api/mdd/analyze/route.ts` — Golden and non-Golden LLM paths run refill before Gate when enabled.
- `scripts/mdd-phase1-llm-golden-run.ts` — passes refill LLM config (model overrideable).

### 1.4 Readiness / NSF ownership (as approved)

- Refill inputs include **no readiness field**.
- Final `decisionReadiness` remains Gate-owned.
- NSF is Control/pipeline-owned; Gate does not evaluate NSF. Success clears NSF in pipeline state before Gate.

### 1.5 Validator reject codes

`EMPTY` · `STILL_NOT_REQUIRED` · `CDQ_CONTRADICTION` · `DEFERRED_AS_CURRENT` · `PROFESSIONAL_BOUNDARY` · `RECOMMENDATION_CONTRADICTION` · `UNSUPPORTED_TECHNICAL_INVENTION` · `UNSUPPORTED_FINANCIAL_INVENTION` · `MUTATED_NON_PD_FIELD`

Non-empty text alone is never sufficient for acceptance.

---

## 2. Tests

**Suite:** `__tests__/mdd-semantic-refill-v0.3.test.ts` (14) + regressions.

Covered:

- Trigger true / false  
- Accepted refill (PD-only mutation, NSF clear, audit)  
- Rejected “not required” (NSF preserved)  
- Deferred-item violation  
- Professional Boundary / recommendation / technical / financial invention rejects  
- Idempotency (second apply not re-triggered after NSF clear)  
- Allowlist excludes readiness/review/learning/gate  
- Pipeline inject accept / reject  

**Regression green:** Control v0.1 · Policy v0.2 · Pipeline v0.1.2 · Control v0.1.1 · Golden LLM eval — **64/64 passed**.

---

## 3. How to enable (later live — not run now)

```bash
# Control (existing)
MDD_DECISION_CONTROL_V01=1

# Semantic Refill v0.3
MDD_SEMANTIC_REFILL_V03=1

# First controlled live test: same model for draft + refill
MDD_AI_MODEL=gpt-4o-mini
# MDD_SEMANTIC_REFILL_MODEL unset → defaults to gpt-4o-mini
```

Then: `npx tsx --env-file=.env.local scripts/mdd-phase1-llm-golden-run.ts`

**Not executed in this task.**

---

## 4. Explicit non-claims

| Item | Status |
| --- | --- |
| GC02 D05 live Pass | **Not claimed** (no live run) |
| GC02 D10b | Out of scope / unchanged |
| GC04 D04 | Still `INPUT_CONTEXT_DEFICIENCY` / `GOLDEN_EXPECTATION_NOT_INPUT_GROUNDED` |
| Stronger refill model | Configurable but **not** compared yet |
| Source Provenance | Still deferred |

---

## 5. Stop

Implementation complete with deterministic tests green.  
**Await review before any live LLM Golden rerun.**
