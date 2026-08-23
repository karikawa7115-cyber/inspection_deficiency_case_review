# Decision Control v0.1.1 / Pipeline Adjustment — Design Proposal

/** Status:** DESIGN APPROVED; P1+P2 implemented — see `DECISION_CONTROL_v0.1.1_IMPLEMENTATION_REPORT.md`.  
**Date:** 2026-08-23  
**Context:** Control v0.1 live re-run (`gpt-4o-mini` + `MDD_DECISION_CONTROL_V01=1`) accepted as directionally successful.  
**Out of scope this document:** Semantic refill; System Prompt edits; Golden Spec / Eval Rules edits; new GC-specific Control patches; live LLM re-run.

**Does not modify (when later implemented must still preserve):**  
System Prompt v1.0 · Structured Output Schema v1.0 (Canonical) · Quality Gate Rules v1.1 text intent · Golden Case Spec v1.0 · Golden LLM Evaluation Rules v1.0.

---

## 0. Problem statement (from Control ON run)

| Case | Issue |
| --- | --- |
| **GC01** | Spurious LLM `finance` extension activated Gate `FINANCIAL_DEPENDENCY_UNRESOLVED` after Control correctly staged READY → Gate demoted; Golden CriticalFail |
| **GC04** | Canonical Zod **cross-field** failure (`managementReviewCandidate` vs `reviewCandidate.flag`) **before** Control → Control never ran |
| **GC03** | D04 still Fail despite semantically rich controlled authorities |
| **GC02** | D05 Fail (expected with NEEDS_SEMANTIC_FILL); D10b Fail — needs classification |

---

## 1. Finance Gate activation rule (generalized)

### 1.1 Current behavior (problem)

Quality Gate v1.1 activates finance Critical / stale-liquidity paths when:

```text
primaryCaseType === FINANCE_COMMERCIAL  OR  finance extension present
```

(`evaluate-v1.1.ts` — `financeActive`)

Therefore an LLM may emit an unsupported `finance` object on a **CREW_MANNING** case and incorrectly trigger `FINANCIAL_DEPENDENCY_UNRESOLVED` / liquidity stale escalation.

### 1.2 Proposed activation (authoritative context)

**Finance Critical checks** (and finance-driven stale→Critical escalation) activate only when **at least one** of:

| Code | Condition |
| --- | --- |
| **F1** | `primaryCaseType === FINANCE_COMMERCIAL` (post-Control confirmed type) |
| **F2** | Current Decision Question is funding/payment/liquidity oriented — e.g. `decisionClass === "finance_funding_amount"` **or** CDQ `decisionRequiredNow` / `expectedDecider` matches funding/liquidity/CTM/remittance/payment-approval intent (generalized detectors, not Golden IDs) |
| **F3** | **Source facts** establish a material financial dependency — e.g. envelope `financeSourceInput` / case finance snapshot present with material amounts, **or** confirmed fact texts that are clearly funding decisions *and* CDQ does not mark them as non-decision context |

**Explicit non-activation:**

| Code | Rule |
| --- | --- |
| **F0** | Presence of LLM `finance` extension **alone** does **not** activate Finance Critical checks |

### 1.3 What happens to spurious finance extensions

Do **not** blindly delete all finance content on non-finance cases (cross-domain finance must remain possible under F2/F3).

Proposed handling when `finance` present but **F1∨F2∨F3 is false**:

| Step | Behavior |
| --- | --- |
| Gate | Treat finance Critical pack as **inactive** (skip FINANCIAL_DEPENDENCY / finance READY-liquidity Critical / finance-only stale escalation) |
| Control (optional annotate) | Emit audit finding e.g. `SPURIOUS_FINANCE_EXTENSION` — retain original `finance` in `originalLlmDraft`; may leave controlled `finance` intact for debug **or** move to `debug` / mark `finance.ignoredForGate=true` in control audit metadata without inventing numbers |
| Warnings | Optional soft warning only — must **not** flip `passed` or block READY |

Legitimate cross-domain example: TECHNICAL case whose CDQ asks “approve emergency purchase funding?” → **F2 true** → Finance Criticals apply even if primary type stays TECHNICAL.

### 1.4 Where to implement (later)

Prefer **Quality Gate v1.1.1** (or Gate subject enrichment from Control/CDQ) so activation uses authoritative context. Control may **supply** `financeGateEligible: boolean` into the Gate subject; Gate remains the emitter of Critical codes.

**Do not weaken** Canonical Schema finance field shapes.

### 1.5 Regression risks

| Risk | Mitigation |
| --- | --- |
| Real finance dependency missed on mixed cases | Require F2/F3 detectors + tests with CDQ funding on non-FINANCE type |
| GC04 finance Criticals stop firing | F1 still true for FINANCE_COMMERCIAL |
| Silent drop of finance evidence | Keep original draft; audit `SPURIOUS_FINANCE_EXTENSION` |

---

## 2. Two-stage validation architecture

### 2.1 Observed failure (GC04)

Canonical Schema v1.0 `superRefine` rejected:

`managementReviewCandidate === true` without `reviewCandidate.flag` (and without `monitorOnly`)

Pipeline today:

```text
Provider SO → normalize → evaluatedAt inject → parseMddStructuredOutput (Canonical)
  → (only if parse OK) Decision Control → Gate → Golden
```

Control never saw GC04.

### 2.2 Proposed pipeline

```text
Raw Case + CDQ
  → LLM Semantic Draft (Provider Structured Outputs)
  → Pre-Control Structural Validation          ← NEW (shape/types only)
  → Decision Control v0.1 (+ v0.1.1 finance eligibility annotate)
  → Canonical Structured Output Schema v1.0   ← EXISTING Zod + superRefine (unchanged contract)
  → Quality Gate v1.1 (+ finance activation rule §1)
  → Enforced Readiness
  → Golden Evaluation
```

### 2.3 Pre-Control Structural Validation (allowed)

May check **only** representation constraints needed for safe Control execution:

| Allowed | Examples |
| --- | --- |
| Root object / required top-level keys present | `schemaVersion`, `executive`, `facts`, … |
| Types | string / boolean / array / object |
| Enums | case type, readiness, authority kinds, gate codes |
| Arrays of objects with required local fields | `id`, `text` where Schema requires |
| Basic formats | non-empty strings where `minLength` applies **if** mirrored as structural |

**Must not** enforce cross-field **policy/semantic** consistency at this stage, including (non-exhaustive):

- `qualityGate.passed` ↔ criticalFailures length  
- READY ↔ critical failures  
- `managementReviewCandidate` ↔ `reviewCandidate.flag`  
- finance `separationPreserved` / `doNotAuthorizePayment` truth when finance present  
- MoneyView origin when amount present  

Those remain **Canonical Schema v1.0** after Control (Control may repair policy-level inconsistencies such as Review flag vs MR — already in R6 scope for flag; MR stays LLM).

### 2.4 Canonical Schema v1.0

**Unchanged.** Not weakened. Not replaced. Still the final machine contract before Gate.

If Pre-Control fails → stop with structural error (Control not applied).  
If Canonical fails after Control → stop with Schema invalid (Gate/Golden as today).

### 2.5 GC04-shaped repair path (illustrative, not a Golden patch)

After Pre-Control OK, Control may (existing R6 spirit / future small rule):

- If MR candidate true and flag false and not monitorOnly → set flag true (already allowed by Q4 policy criteria), **or** leave for Canonical fail if criteria do not fire

v0.1.1 should clarify: **cross-field Schema repairs that are also Control policy** run in Control; Canonical remains the verifier.

### 2.6 Regression risks

| Risk | Mitigation |
| --- | --- |
| Drift between Pre-Control and Canonical shape | Generate Pre-Control schema from Zod **minus** `superRefine` / policy refinements |
| Control receives invalid shapes | Pre-Control must be strict enough for R1–R9 navigation |
| Double-parse cost | Acceptable; cache parsed structural tree |

---

## 3. GC03 D04 diagnosis (no new Control rule yet)

### 3.1 Facts from Control ON run

**Spec expected role labels (Golden Spec / `expectedAuthorityRoleLabels`):**

1. Onboard corrective execution  
2. Technical verification  
3. **Root cause**  
4. Final acceptance  

**Controlled authorities (semantically):**

| roleLabel | authority |
| --- | --- |
| President/DP | President/DP |
| Onboard corrective execution | Master |
| Technical verification | Superintendent |
| External Flag / ASI follow-up | Flag Administration |
| Final acceptance of Company closure | President/DP |

### 3.2 How D04 is scored (Eval Rules machine impl)

```ts
spec.expectedAuthorityRoleLabels.every((role) =>
  authBlob.toLowerCase().includes(role.toLowerCase().slice(0, 12)),
);
```

- “Onboard corrective…” → needs substring `onboard corre` → **present**  
- “Technical verification” → `technical ve` → **present**  
- “Final acceptance” → `final accept` → **present**  
- “Root cause” → `root cause` → **absent** from controlled authBlob  

### 3.3 Classification

| Layer | Verdict |
| --- | --- |
| **Primary** | **Control-policy gap (incomplete RACI for inspection_non_closure)** — no upserted authority covering root-cause / SMS / audit follow-up domain |
| **Secondary** | **Golden evaluator artifact / semantic-equivalence limitation** — match is brittle first-12-character inclusion against Spec role **strings**, not authority-kind / decision-domain equivalence |

Authorities present are largely **semantically correct** for Master / Tech / Flag / President closure, but **incomplete** vs Spec’s four-domain RACI (missing root-cause/SMS follow-up). This is **not** “only a label typo on an existing correct role.”

### 3.4 Recommended fix direction (later — no implement now)

**Prefer Control-policy completion (generalized), not Golden role-string patches:**

- Extend inspection/ISM **decision-class** authority minima with a domain such as “Root cause / SMS / audit follow-up” mapped to Company/DP (or equivalent authority kind), **without** hardcoding GC03 vessel/Golden ID.  
- Optionally later: Eval D04 semantic equivalence by **authority domains** (Master ops, Tech verify, RC/SMS, President closure) — that would be Golden Eval Rules v1.1, out of scope unless separately approved.

**Do not** add GC03-specific roleLabel string literals as the long-term design.

---

## 4. GC02 remaining failures

### 4.1 D05 — President Decision intent

| Item | Detail |
| --- | --- |
| Observation | `requiredNow` forced true; text still “Not required at this stage.”; `NEEDS_SEMANTIC_FILL=true` |
| Classification | **Expected residual** while semantic refill is deferred (v0.2) |
| Action now | **None** (explicitly do not solve) |

### 4.2 D10b — what it is

Machine rule (`llm-eval-v1.ts`):

```ts
if (spec.knowledgeUpdateExpected && !output.learning.knowledgeUpdateCandidate)
  → D10b fail "expected true"
```

GC02 Spec sets `knowledgeUpdateExpected: true` (Class/CMS clarification → knowledge update candidate).

Control ON run: `learning.knowledgeUpdateCandidate === false` (unchanged by Control; Control does not set learning KU/MR flags by Q4 design).

### 4.3 D10b classification

| Option | Fit |
| --- | --- |
| **LLM semantic failure** | **Primary** — model did not mark Knowledge Update Candidate though Spec/decision class expects it |
| Control-policy gap | Only if product policy later says Control must force KU for technical Class-handling confirm — **not** approved in v0.1 |
| Evaluator artifact | **No** — D10b is a direct boolean Spec expectation, not brittle string match |

**Recommendation:** Leave to LLM / future Prompt or optional Control learning minima **only after** explicit policy approval; not part of v0.1.1 finance/validation work.

---

## 5. Proposed v0.1.1 scope (design only)

| ID | Change | Touches |
| --- | --- | --- |
| **P1** | Finance Gate activation via F1∨F2∨F3; F0 ignores lone LLM finance | Gate subject + optional Control annotate |
| **P2** | Pre-Control structural Zod (no policy superRefine) → Control → Canonical Schema v1.0 | LLM / Analyze / Golden pipeline |
| **P3** | Document GC03 D04 / GC02 D10b diagnoses | This proposal only |
| **Non-goals** | Semantic refill; Prompt; Golden Spec/Eval edits; GC-specific Control role strings |

---

## 6. Regression risks (summary)

| Area | Risk | Test posture |
| --- | --- | --- |
| Finance | Mixed-case funding miss / crew false Critical | §7 T-FIN-* |
| Validation | Pre-Control too weak/strong; Canonical bypass | §7 T-VAL-* |
| Control | Idempotency / audit still hold after pipeline split | Existing Control suite + new hooks |
| GC04 path | MR/flag inconsistency reaches Control then Canonical | T-VAL-GC04-shape |

---

## 7. Exact tests to add (when implementing)

### Finance activation

| ID | Test |
| --- | --- |
| **T-FIN-01** | CREW_MANNING + spurious `finance` + no CDQ funding + no financeSourceInput → Gate finance Criticals **do not** fire; READY/CONDITIONAL per non-finance rules |
| **T-FIN-02** | FINANCE_COMMERCIAL + unconfirmed liquidity + READY → `FINANCIAL_DEPENDENCY_UNRESOLVED` still fires (F1) |
| **T-FIN-03** | TECHNICAL primary + CDQ `finance_funding_amount` (or funding decisionRequiredNow) + unconfirmed liquidity + READY → finance Critical **does** fire (F2) |
| **T-FIN-04** | Non-FINANCE type + envelope financeSourceInput material + CDQ non-funding → define expected F3 behavior in impl notes; assert no false Critical from extension-only |
| **T-FIN-05** | Spurious finance retained in `originalLlmDraft`; audit/finding records non-activation |

### Two-stage validation

| ID | Test |
| --- | --- |
| **T-VAL-01** | Draft with MR=true, flag=false passes Pre-Control structural; fails Canonical if Control does not repair |
| **T-VAL-02** | Draft with MR=true, flag=false + Control R6 policy fires → Canonical passes after Control |
| **T-VAL-03** | Draft missing `executive` / wrong enum fails Pre-Control; Control not invoked |
| **T-VAL-04** | Canonical still rejects READY + criticalFailures mismatch after Control |
| **T-VAL-05** | Pipeline order integration: structural OK → Control → Canonical OK → Gate |

### Diagnosis locks (no product change required to land, but assert understanding)

| ID | Test |
| --- | --- |
| **T-D04-GC03-DOC** | Fixture matching Control ON GC03 authorities → D04 fails specifically for missing `root cause` substring (documents evaluator+gap) |
| **T-D10b-GC02-DOC** | Fixture KU=false with `knowledgeUpdateExpected` → D10b fail; Control leave KU unchanged |

### Existing suites

Keep green: Control v0.1 unit tests, Gate v1.0/v1.1, Golden LLM eval, Schema Zod, Structured Outputs adapter.

---

## 8. Approval questions

1. Approve Finance activation **F1∨F2∨F3** with **F0** (extension-alone insufficient)?  
2. Approve two-stage validation with Pre-Control = structural-only and Canonical Schema v1.0 unchanged after Control?  
3. Accept GC03 D04 as **Control-policy gap + evaluator substring limitation**, fix later via generalized RC/SMS authority domain (not Golden strings)?  
4. Accept GC02 D10b as **LLM semantic failure**; no v0.1.1 Control change?  
5. Proceed to implement P1+P2 only after approval (still no Prompt/Golden/refill)?

---

## 9. Summary verdict

| Topic | Verdict |
| --- | --- |
| Finance Gate | Activate on authoritative context, not LLM finance presence alone |
| Validation | Pre-Control structural → Control → Canonical v1.0 → Gate |
| GC03 D04 | Incomplete inspection RACI (missing root-cause domain) + brittle Eval label match |
| GC02 D05 | Deferred (NEEDS_SEMANTIC_FILL) |
| GC02 D10b | LLM semantic (`knowledgeUpdateCandidate`) |
| Implement now? | **No** — proposal only |

**End of Decision Control v0.1.1 / Pipeline Adjustment Design Proposal**
