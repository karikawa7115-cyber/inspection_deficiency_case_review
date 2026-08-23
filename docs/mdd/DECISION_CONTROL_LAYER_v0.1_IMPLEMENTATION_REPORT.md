# Decision Control Layer v0.1 — Implementation Report

**Date:** 2026-08-23  
**Status:** Implemented behind feature flag — **no live LLM re-run** (per acceptance).  
**Frozen docs unchanged:** System Prompt v1.0, Structured Output Schema v1.0, Quality Gate v1.1, Golden Case Spec v1.0, Golden LLM Evaluation Rules v1.0.

---

## 1. What shipped

| Item | Path |
| --- | --- |
| CDQ types (envelope) | `lib/mdd/case-envelope/current-decision-question.ts` |
| GC01–GC04 CDQ envelopes only | `lib/mdd/golden/cdq-envelopes.ts` (does **not** change expected decisions) |
| Control engine R1–R9 | `lib/mdd/decision-control/apply-v0.1.ts` |
| Feature flag | `MDD_DECISION_CONTROL_V01=1\|true\|yes\|on` via `feature-flag.ts` |
| Pipeline hook | `runGoldenLlmEvalPipeline(..., { applyDecisionControl, envelope })` |
| Analyze API | Optional `currentDecisionQuestion`; Control when flag on |
| LLM user payload | Passes CDQ when provided |
| Golden run script | Loads CDQ envelopes; Control when flag on |
| Unit tests | `__tests__/mdd-decision-control-v0.1.test.ts` (10) |

### Feature flag (default OFF)

```bash
# enable Control on Analyze / golden LLM pipeline
MDD_DECISION_CONTROL_V01=1
```

When OFF, behavior matches prior Schema → Gate → Golden path (regression preserved).

---

## 2. Q1–Q6 decisions implemented

| Decision | Implementation |
| --- | --- |
| Q1 CDQ envelope triad | `decisionRequiredNow`, `expectedDecider`, `deferredToExecutionOrClosure` (+ optional `decisionClass`) |
| Q2 Authority upsert | R3 inserts `status: "pending"` only; no `confirmed`; President only if CDQ expectedDecider requires it |
| Q3 President text | `requiredNow=true` + `NEEDS_SEMANTIC_FILL` + audit; **text retained**; no refill |
| Q4 Review | R6 may force `flag` + `retainAfterClose`; never forces `managementReviewCandidate`; criteria generalized |
| Q5 Critical override | Unchanged Gate semantics (no Control bypass path) |
| Q6 Frozen specs | Not modified |

---

## 3. Constraints A–E

| Constraint | How verified |
| --- | --- |
| A Deterministic / no LLM / idempotent | Pure function; `applyDecisionControlV01IdempotentCheck` test |
| B Mandatory audit | Every mutation has ruleId, fieldPath, original, controlled, reason, version, timestamp |
| C Legacy without CDQ | `CDQ_REQUIRED` finding; no invented CDQ; GC CDQ only in `cdq-envelopes.ts` |
| D Source vs controlled | `originalLlmDraft` + `controlled` always returned |
| E Acceptance tests | See §4 |

---

## 4. Deterministic test results

```
npx vitest run __tests__/mdd-decision-control-v0.1.test.ts \
  __tests__/mdd-quality-gate-v1.test.ts \
  __tests__/mdd-quality-gate-v1.1.test.ts \
  __tests__/mdd-golden-llm-eval-v1.test.ts \
  __tests__/mdd-structured-output-v1.test.ts \
  __tests__/mdd-llm-structured-outputs-v1.test.ts
```

**Result: 6 files, 48 tests — all passed.**

Control-specific coverage:

- CDQ_REQUIRED  
- Idempotency (authorities/tags/controlled JSON stable on re-apply)  
- Audit fields + NEEDS_SEMANTIC_FILL without text overwrite  
- President **not** mechanical when expectedDecider is Superintendent only  
- GC01 READY vs deferred port/docs (R5/R9)  
- GC02 type TECHNICAL + Class/Supt/(President when CDQ says so)  
- GC03 Review flag without forcing MR  
- GC04 Finance + President pending + liquidity READY→CONDITIONAL  

---

## 5. Pipeline (when flag ON)

```
Raw Case + CDQ envelope
  → LLM Semantic Draft (CDQ in user payload; Prompt v1.0 frozen)
  → normalize + system evaluatedAt
  → Decision Control v0.1 (audit + original retained)
  → Quality Gate v1.1
  → Enforced Readiness
  → Golden Eval (Rules v1.0)
```

Heuristic `proposeFromHeuristics` remains Gate-only (no Schema draft). LLM / Analyze(`mode=llm`) / Golden LLM runner are the Control-enabled paths.

---

## 6. Explicit non-goals (this PR)

- No live model re-run  
- No semantic refill (v0.2)  
- No Prompt / Schema / Gate / Spec / Eval edits  
- No Golden expected-result changes  

---

## 7. Recommended next review steps

1. Review this report + `apply-v0.1.ts` rule predicates for over-fit risk.  
2. When approved for live measurement: run GC01–GC04 with `MDD_DECISION_CONTROL_V01=1` and **same** model as the clean baseline (`gpt-4o-mini`), then compare.  
3. Only after that, consider v0.2 semantic refill for `NEEDS_SEMANTIC_FILL`.

**End of implementation report**
