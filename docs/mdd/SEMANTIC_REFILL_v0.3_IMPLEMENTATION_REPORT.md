# Semantic Refill v0.3 — Implementation / Test Report

**Status:** IMPLEMENTED (deterministic verification) — **no live LLM rerun**  
**Commit:** `823afc6`  
**Date:** 2026-08-23  
**Design SSoT:** `docs/mdd/SEMANTIC_REFILL_v0.3_DESIGN_PROPOSAL.md` (L1–L7 approved)

**Frozen / unchanged by this feature’s contract:** Decision Policy v0.2 · Pipeline v0.1.2 ownership · System Prompt v1.0 · Schema v1.0 · Quality Gate Rules v1.1 · Golden Spec / Eval · Source Provenance (design-only, deferred)

---

## 1. Files added / changed (Semantic Refill scope)

### Added — `lib/mdd/semantic-refill/`

| File | Role |
| --- | --- |
| `version.ts` | `SEMANTIC_REFILL_VERSION=0.3`, prompt version stamp |
| `feature-flag.ts` | Flag + model resolve |
| `prose-defect.ts` | T2 defect classifiers (shared with Control NSF) |
| `build-payload.ts` | Allowlisted refill input builder |
| `prompt.ts` | Bounded refill system/user prompt (not System Prompt v1.0) |
| `validate.ts` | Fail-closed deterministic validator |
| `apply.ts` | Trigger check, accept/reject, NSF clear, audit |
| `call-llm.ts` | Live `{ text }` JSON refill call |
| `run-stage.ts` | Stage orchestration (inject or LLM) |
| `index.ts` | Public exports |

### Added — tests / docs

| File | Role |
| --- | --- |
| `__tests__/mdd-semantic-refill-v0.3.test.ts` | Deterministic refill suite (14) |
| `docs/mdd/SEMANTIC_REFILL_v0.3_DESIGN_PROPOSAL.md` | Design |
| `docs/mdd/SEMANTIC_REFILL_v0.3_IMPLEMENTATION_REPORT.md` | This report family |

### Changed — wiring / Control NSF alignment

| File | Change |
| --- | --- |
| `lib/mdd/decision-control/apply-v0.1.ts` | NSF via shared prose detectors; finding codes `SEMANTIC_REFILL_*` |
| `lib/mdd/golden/llm-eval-v1.ts` | Async pipeline; `Control → Refill → Gate` |
| `app/api/mdd/analyze/route.ts` | Refill stage before Gate when flag on |
| `scripts/mdd-phase1-llm-golden-run.ts` | Passes refill LLM config |
| `__tests__/mdd-golden-llm-eval-v1.test.ts` | `await` async pipeline |

---

## 2. Feature flag and default

| Item | Value |
| --- | --- |
| **Name** | `MDD_SEMANTIC_REFILL_V03` |
| **Enabled when** | `1` / `true` / `yes` / `on` (case-insensitive) |
| **Default** | **OFF** (unset / empty / other → disabled) |
| **Independence** | Independent of `MDD_DECISION_CONTROL_V01` |

---

## 3. Exact trigger T1 ∧ T2 ∧ T3

Implemented in `shouldTriggerSemanticRefillV03` (+ Control R4 for NSF emission).

| ID | Condition | Implementation |
| --- | --- | --- |
| **T1** | President required now | `controlled.executive.presidentDecision.requiredNow === true` (after Control R4) |
| **T2** | PD prose unusable | `classifyPresidentProseDefect(text, true)` ∈ {`absent`, `not_required`, `contradictory`} |
| **T3** | NSF true | `needsSemanticFill === true` (Control finding `NEEDS_SEMANTIC_FILL`) |

**Also required:** CDQ present on envelope (no CDQ → no trigger).

**T2 detectors (`prose-defect.ts`):**

- `absent` — empty / whitespace-only text  
- `not_required` — `/not required at this stage/i`  
- `contradictory` — asserts no President/DP decision needed / deferred while `requiredNow` is true  

Stage also requires feature flag ON (`runSemanticRefillStage` / pipeline opts).

---

## 4. Bounded input allowlist

Built by `buildSemanticRefillPayload` — **only**:

| Included | Notes |
| --- | --- |
| Current Decision Question | `decisionRequiredNow`, `expectedDecider`, `deferredToExecutionOrClosure`, `decisionClass` |
| Controlled Case Type | `primaryCaseType` |
| Controlled Decision Authorities | full array copy |
| Facts | `confirmed`, `unverified`, `assumptions`, `missingInformation` |
| Recommendation | `executive.recommendation` |
| Professional Boundaries | array copy |
| Trigger metadata | defectClass, NSF, original PD text, requiredNow |

**Explicitly excluded:** any readiness field · `qualityGate` · Review Candidate · learning/KU/MR · Golden Spec/Eval strings · full raw narrative re-dump · Source Provenance · finance affordability conclusions as inputs · Golden/vessel IDs as keys

---

## 5. Validator rules

`validatePresidentDecisionRefill` — **non-empty alone is insufficient**. Reject codes:

| Code | Meaning |
| --- | --- |
| `EMPTY` | Missing / blank text |
| `STILL_NOT_REQUIRED` | Still says/implies PD not required |
| `CDQ_CONTRADICTION` | Contradicts Current Decision Question |
| `DEFERRED_AS_CURRENT` | Converts deferred execution/closure item into current decision |
| `PROFESSIONAL_BOUNDARY` | Violates professional boundary |
| `RECOMMENDATION_CONTRADICTION` | Contradicts controlled recommendation |
| `UNSUPPORTED_TECHNICAL_INVENTION` | Invents Class/technical/Flag conclusions |
| `UNSUPPORTED_FINANCIAL_INVENTION` | Invents affordability / liquidity-confirmed / payment auth |
| `MUTATED_NON_PD_FIELD` | Candidate differs outside `presidentDecision.text`, or `requiredNow` not true |

---

## 6. Fail-closed behavior

On validation failure:

1. Keep **original** `presidentDecision.text`  
2. Keep `needsSemanticFill=true` and `NEEDS_SEMANTIC_FILL`  
3. Emit `SEMANTIC_REFILL_REJECTED` with validation codes  
4. Record attempted `refillOutput` in audit  
5. **Never** silently substitute rejected text  
6. Continue pipeline to Gate with unchanged PD  

---

## 7. NSF clearing / `SEMANTIC_REFILL_APPLIED`

On **accepted** refill only:

| Action | Result |
| --- | --- |
| `needsSemanticFill` | `false` |
| Findings | Remove `NEEDS_SEMANTIC_FILL`; add `SEMANTIC_REFILL_APPLIED` |
| Controlled draft | PD text = accepted refill; `requiredNow` remains `true` |

This is **Control/pipeline-state** resolution — Quality Gate does **not** score NSF.

---

## 8. Audit fields retained

`SemanticRefillAudit`:

| Field | Content |
| --- | --- |
| `refillVersion` | `0.3` |
| `promptVersion` | e.g. `pd-refill-v0.3.0` |
| `model` | Model id used for propose |
| `timestamp` | ISO |
| `triggerReason` | defect class or `not_triggered` |
| `originalLlmPresidentDecision` | `{ text, requiredNow }` |
| `refillOutput` | proposed `{ text }` or null |
| `finalPresidentDecision` | what entered Gate path |
| `validationResult` | `accepted` / `rejected` / `skipped` |
| `validationCodes` | reject codes (if any) |
| `applied` | boolean |

Full original LLM draft remains under Control `originalLlmDraft` (never mutated by refill).

---

## 9. PD-text-only mutation — confirmed

- Apply path clones controlled draft and writes **only** `executive.presidentDecision.text` (forces `requiredNow: true`).  
- Validator `detectNonPdMutation` rejects if any other field differs.  
- Deterministic test asserts JSON equality of draft with PD stripped before vs after accept.

---

## 10. Refill model configuration / default

| Item | Value |
| --- | --- |
| Env | `MDD_SEMANTIC_REFILL_MODEL` |
| Resolve order | `MDD_SEMANTIC_REFILL_MODEL` → else `MDD_AI_MODEL` → else **`gpt-4o-mini`** |
| First controlled live test intent | primary draft **and** refill = `gpt-4o-mini` (isolate refill effect) |
| Stronger model | Configurable later; **not compared yet** |

---

## 11. Deterministic tests — count and results

**Suite:** `__tests__/mdd-semantic-refill-v0.3.test.ts`  
**Count:** **14** tests  
**Result (re-run 2026-08-23):** **14/14 passed**

Coverage includes: trigger true/false · accepted refill · rejected not-required · deferred violation · boundary · recommendation/CDQ contradiction · technical/financial invention · NSF preserve/clear · audit · allowlist · pipeline inject accept/reject · idempotency · non-PD mutation.

---

## 12. Regression suites — remain green

Re-run after implementation (same session verification):

| Suite | Result |
| --- | --- |
| `mdd-semantic-refill-v0.3` | 14 passed |
| `mdd-decision-control-v0.1` | 10 passed |
| `mdd-decision-control-v0.1.1` | 10 passed |
| `mdd-decision-policy-v0.2` | 14 passed |
| `mdd-decision-pipeline-v0.1.2` | 6 passed |
| `mdd-golden-llm-eval-v1` | 10 passed |
| `mdd-quality-gate-v1.1` | included in regression set |

**Aggregate for this verification run:** all listed suites **passed** (Decision Control / Policy / Pipeline / Gate / Golden eval remain green). Schema v1.0 unchanged as frozen contract; structural/canonical paths continue to use existing parsers.

---

## 13. Pipeline placement (reminder)

```text
Structural → Decision Control (+ Policy v0.2)
  → Semantic Refill v0.3   (flag + T1∧T2∧T3)
  → Quality Gate v1.1
  → Enforced Readiness (Gate-owned)
  → Canonical Assembly → Canonical Schema → Golden Eval
```

Refill receives **no readiness field**. Final readiness remains Gate-owned only.

---

## 14. Stop / non-claims

- **No live LLM Golden rerun** performed for this report.  
- GC02 D05 live Pass **not claimed**.  
- GC02 D10b and GC04 D04 remain out of Semantic Refill scope.

**End of Semantic Refill v0.3 implementation/test report.**
