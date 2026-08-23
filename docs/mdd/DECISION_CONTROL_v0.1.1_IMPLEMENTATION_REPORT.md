# Decision Control / Pipeline v0.1.1 — Implementation Report

**Status:** IMPLEMENTED (P1 + P2 only)  
**Date:** 2026-08-23  
**Live LLM rerun:** **Not performed** (per scope — stop for review)

**Does not modify:** System Prompt v1.0 · Canonical Schema v1.0 cross-field contract · Quality Gate Rules v1.1 text SSoT · Golden Case Spec v1.0 · Golden LLM Evaluation Rules v1.0 · semantic refill · GC03 RC authority minima · Knowledge Update forcing

---

## 1. Scope delivered

| ID | Change | Result |
| --- | --- | --- |
| **P1** | Finance Gate activation = **F1∨F2∨F3**; **F0** = LLM `finance` alone does not activate Criticals | Done |
| **P2** | Provider SO → **Pre-Control Structural** → Decision Control v0.1 → **Canonical Schema v1.0** → Gate v1.1 → Golden | Done |

Explicitly **out of scope** (unchanged): Prompt, Golden Spec/Eval, semantic refill, RC authority additions, KU forcing, new model runs.

---

## 2. P1 — Finance Gate activation

### 2.1 Resolver

New module: `lib/mdd/quality-gate/finance-activation-v1.1.ts`

| Code | Condition |
| --- | --- |
| **F1** | `primaryCaseType === FINANCE_COMMERCIAL` |
| **F2** | CDQ `decisionClass === finance_funding_amount` **or** funding/payment/remittance/liquidity/affordability/financial-approval language in CDQ text |
| **F3** | Material `financeSourceInput` / envelope finance snapshot (amounts and/or liquidity fields) |
| **F0** | `llmFinanceExtensionPresent` alone → `active: false`, `spuriousLlmFinanceExtension: true` |

### 2.2 Gate wiring

- `QualityGateSubject.financeGateActive?: boolean`
- `evaluateQualityGateV1_1`: activates finance Critical / finance stale-escalation only when `financeGateActive === true`, or (legacy unset) **F1 only** — **not** on `finance.present` alone
- Callers set eligibility via `resolveFinanceGateActivation`:
  - `runGoldenLlmEvalPipeline` (CDQ + `spec.financeSnapshot` / opts)
  - Analyze LLM path
- Heuristic `subjectFromProposal`: F1 or material snapshot → `financeGateActive`

### 2.3 Control annotate (optional, shipped)

When Control runs and F0 applies:

- Finding: `SPURIOUS_FINANCE_EXTENSION`
- Audit ruleId `P1`
- **Does not delete** `finance` payload (cross-domain F2/F3 preserved)

---

## 3. P2 — Two-stage validation

### 3.1 Pipeline order

```text
Provider Structured Output
  → Pre-Control Structural Validation   (mddStructuredOutputObjectSchema)
  → Decision Control v0.1 (+ F0 annotate)
  → Canonical Schema v1.0               (object + unchanged superRefine policy)
  → Quality Gate v1.1 (+ finance activation)
  → Golden Evaluation
```

### 3.2 Schema split

File: `lib/mdd/schema/structured-output-v1.ts`

| Export | Role |
| --- | --- |
| `mddStructuredOutputObjectSchema` / `parseMddStructuredOutputStructural` | Shape, types, enums, arrays, IDs — **no** cross-field policy |
| `mddStructuredOutputSchema` / `parseMddStructuredOutput` | Canonical v1.0 including all `superRefine` rules |

MoneyView `origin` when `amount` present moved from nested structural refine into **Canonical** `superRefine` (same semantic requirement; Pre-Control no longer blocks Control on it).

### 3.3 GC04-style MR / flag repair

Control **R6b**: if `managementReviewCandidate === true` and `reviewCandidate.flag !== true` and not `monitorOnly` → set `flag: true` (Canonical coherence repair). Allows Pre-Control pass → Control repair → Canonical pass.

### 3.4 Analyze route

LLM non-Golden path mirrors the same two-stage + finance activation sequence.

---

## 4. Tests

New: `__tests__/mdd-decision-control-v0.1.1.test.ts`

| ID | Assertion |
| --- | --- |
| T-FIN-01 | CREW + spurious finance → no `FINANCIAL_DEPENDENCY_UNRESOLVED` |
| T-FIN-02 | `FINANCE_COMMERCIAL` → finance Critical still fires |
| T-FIN-03 | TECHNICAL + funding CDQ (F2) → finance Critical fires |
| T-FIN-04 | Material source input (F3) activates |
| T-FIN-05 | Control finding `SPURIOUS_FINANCE_EXTENSION`; finance retained |
| T-VAL-01 | MR/flag inconsistency passes Pre-Control; fails Canonical alone |
| T-VAL-02 | Pre-Control → Control R6b → Canonical OK |
| T-VAL-03 | Malformed enum rejected Pre-Control; no Control meta |
| T-VAL-04 | Canonical still rejects READY + criticalFailures |
| T-VAL-05 | GC01 + spurious finance full pipeline: schema OK, no finance Critical |

Regression note: GC04 mutant Gate CriticalFail tests pin `applyDecisionControl: false` so Gate/Golden behavior is asserted independent of env `MDD_DECISION_CONTROL_V01=1` (Control would demote READY→CONDITIONAL and turn Critical into warn).

### Test run (deterministic)

```text
mdd-decision-control-v0.1.1     PASS
mdd-decision-control-v0.1       PASS
mdd-quality-gate-v1 / v1.1      PASS
mdd-structured-output-v1        PASS
mdd-llm-structured-outputs-v1   PASS
mdd-golden-llm-eval-v1          PASS (after mutant Control-off pin)
```

---

## 5. What was intentionally not done

- No System Prompt / Golden Spec / Golden Eval Rules edits  
- No semantic refill  
- No GC03 root-cause / RC authority Control expansion  
- No Knowledge Update forcing  
- **No live LLM Golden rerun** — awaiting review  

---

## 6. Suggested review checklist before live rerun

1. Confirm F0: GC01-like crew case with spurious `finance` no longer CriticalFails on finance alone  
2. Confirm F1: GC04 finance Criticals still available when READY claimed without liquidity (or Control demotes first)  
3. Confirm F2/F3 cross-domain funding still activates Gate  
4. Confirm GC04-shaped MR/flag drafts reach Control and Canonical after R6b  
5. Then enable `MDD_DECISION_CONTROL_V01=1` and run `scripts/mdd-phase1-llm-golden-run.ts` once approved  

---

## 7. Key files touched

- `lib/mdd/quality-gate/finance-activation-v1.1.ts` (new)
- `lib/mdd/quality-gate/evaluate-v1.ts` / `evaluate-v1.1.ts`
- `lib/mdd/schema/structured-output-v1.ts`
- `lib/mdd/decision-control/apply-v0.1.ts`
- `lib/mdd/golden/llm-eval-v1.ts`
- `app/api/mdd/analyze/route.ts`
- `__tests__/mdd-decision-control-v0.1.1.test.ts` (new)
- `__tests__/mdd-golden-llm-eval-v1.test.ts` (Control-off pin for Gate mutants)
