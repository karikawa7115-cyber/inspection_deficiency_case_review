# Decision Pipeline v0.1.2 — Implementation Report

**Status:** IMPLEMENTED (narrow scope only)  
**Date:** 2026-08-23  
**Live LLM rerun:** **Not performed** (awaiting review)

**Implements:** System-owned Quality Gate + pipeline reorder / Canonical Output Assembly  
**Does not implement:** Review Candidate B-guarded · GC04 Ship Fund / authority-domain · evaluator changes · Semantic Refill · Prompt / Golden Spec / Golden Eval / Gate rules text edits

---

## 1. What changed

### 1.1 Canonical Output Assembly

New: `lib/mdd/pipeline/assemble-canonical-v0.1.2.ts`

`assembleCanonicalOutputV012(draft, gateEvaluation)` writes:

- `executive.decisionReadiness` ← `gate.enforcedReadiness` (**Gate-owned final**)
- `qualityGate` ← Gate v1.1 `passed` / `criticalFailures` / `warnings` / `evaluatedAt` (**Gate-owned final**)

LLM draft `qualityGate` is never copied into the final assembled object.

### 1.2 Pipeline order (v0.1.2)

```text
Raw + CDQ
  → LLM Semantic Draft
  → Pre-Control Structural Validation
  → Decision Control (optional / flag)
  → Deterministic Quality Gate v1.1
  → Enforced Readiness
  → Canonical Output Assembly
  → Canonical Schema v1.0 Validation   ← unchanged contract
  → Golden Evaluation
```

Wired in:

- `lib/mdd/golden/llm-eval-v1.ts` (`runGoldenLlmEvalPipeline`)
- `app/api/mdd/analyze/route.ts` (LLM non-Golden path)
- `scripts/mdd-phase1-llm-golden-run.ts` (pipeline note only)

### 1.3 Audit retention

Report / Analyze responses retain:

- `originalLlmDraft` — full LLM semantic draft including draft `qualityGate`
- When Control runs: also `decisionControl.originalLlmDraft` (unchanged Control contract)
- `preAssemblyDraft` / `assembledOutput` on Golden eval report for debug

### 1.4 Ownership (architecture rule — as approved)

| Field | Final owner in v0.1.2 code |
| --- | --- |
| `qualityGate` | **Gate** |
| `decisionReadiness` | **Gate** (enforced) |
| President Decision prose | LLM (unchanged) |
| President `requiredNow` | Control (unchanged) |
| Management Learning | LLM (unchanged) |
| Review Candidate flag | LLM + promote-only Control (**B-guarded deferred**) |

---

## 2. Explicitly deferred (unchanged)

- Review Candidate B-guarded demotion  
- GC04 D04 Ship Fund / authority-domain Control rules  
- Golden Eval / Spec / Prompt / Gate rules  
- Semantic Refill v0.2  
- Live model rerun  

---

## 3. Tests

New: `__tests__/mdd-decision-pipeline-v0.1.2.test.ts`

| Assertion | Result |
| --- | --- |
| LLM draft Criticals not authoritative after Gate recompute | PASS |
| Spurious LLM finance Critical retained in `originalLlmDraft`; F0 does not poison final Gate | PASS |
| Final `qualityGate` ≡ Gate v1.1 output | PASS |
| Final readiness ≡ enforced Gate readiness | PASS |
| Canonical runs after assembly (LLM QG would fail Canonical alone) | PASS |
| Original LLM `qualityGate` auditable | PASS |

Regression suites (Control v0.1 / v0.1.1, Gate v1.0/v1.1, Schema, Golden eval, Structured Outputs): **all green**.

```text
Test Files  8 passed
Tests       64 passed
```

---

## 4. Expected effect on prior live GC01 failure mode

Under v0.1.1, Control set READY while LLM `qualityGate.criticalFailures` remained → Canonical abort before Gate.

Under v0.1.2, Gate recomputes → assembly overwrites QG/readiness → Canonical validates **assembled** payload. Deterministic tests cover this pattern. **Live confirmation deferred.**

Residual risks after next live run (not claimed fixed by v0.1.2): GC01/GC04 **D11** (RC flag; B-guarded deferred), GC04 **D04** (Ship Fund domain deferred), GC02/GC03 semantic dims.

---

## 5. Key files

- `lib/mdd/pipeline/assemble-canonical-v0.1.2.ts` (new)
- `lib/mdd/golden/llm-eval-v1.ts`
- `app/api/mdd/analyze/route.ts`
- `__tests__/mdd-decision-pipeline-v0.1.2.test.ts` (new)
- `docs/mdd/DECISION_PIPELINE_v0.1.2_SYSTEM_OWNED_FIELDS_DESIGN.md` (design; status → implemented narrow scope)
- `docs/mdd/DECISION_PIPELINE_v0.1.2_IMPLEMENTATION_REPORT.md` (this file)

---

## 6. Stop

Implementation complete. Deterministic tests green. **No live LLM rerun** until review.
