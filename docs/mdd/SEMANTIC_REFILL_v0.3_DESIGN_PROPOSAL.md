# Bounded President Decision Semantic Refill v0.3 — Design Proposal Only

**Status:** DESIGN PROPOSAL — not implemented.  
**Date:** 2026-08-23  
**Accepted prerequisites (do not modify):** Decision Policy v0.2 · Pipeline v0.1.2 · System Prompt v1.0 · Canonical Schema v1.0 · Quality Gate Rules v1.1 · Golden Spec / Eval Rules  

**Accepted & deferred (preserve; do not implement here):** Case Context Source Provenance v0.1 (H1–H5 approved).

**Evidence / focus:**

| Case | Status after Policy v0.2 | This proposal |
| --- | --- | --- |
| GC01 | Pass | regression guard only |
| GC03 | Pass | may benefit if NSF pattern recurs; not the design driver |
| GC04 D04 | Fail — classified **`INPUT_CONTEXT_DEFICIENCY` / `GOLDEN_EXPECTATION_NOT_INPUT_GROUNDED`** | **out of scope** (do not invent provenance; do not change Eval/expected output) |
| **GC02 D05** | Fail + `NEEDS_SEMANTIC_FILL` | **in scope** |
| GC02 D10b | Fail (`knowledgeUpdateCandidate`) | **out of scope** |

**Does not implement / does not run:** code · live LLM · model bake-offs · Prompt/Schema/Gate/Eval edits · Source Provenance · D10b / KU policy.

---

## 0. Positioning

### 0.1 Problem (GC02 live shape)

Policy v0.2 live artifact (`tmp/mdd-llm-golden-run-2026-08-23T10-42-00-100Z.json`):

| Field | Raw LLM | After Control |
| --- | --- | --- |
| `presidentDecision.requiredNow` | `false` | `true` (R4) |
| `presidentDecision.text` | `"Not required at this stage."` | **unchanged** |
| Finding | — | `NEEDS_SEMANTIC_FILL` |
| Golden D05 | — | **Fail** (no intent: maintain / ClassNK / re-confirmation / clarification) |

Control correctly owns the **boolean** and correctly **refuses** to invent presidential prose. Residual D05 is therefore a **semantic authorship gap**, not a Policy v0.2 defect.

### 0.2 Product rule retained from Control v0.1 Q3

> LLM (or a bounded LLM refill) must author the President Decision sentence. Control must not silently write presidential prose.

v0.3 is the deferred **bounded refill** that Q3 anticipated — narrowed to President Decision only.

### 0.3 Ownership matrix delta (design)

| Field | Final owner today | After Semantic Refill v0.3 (when refill succeeds) |
| --- | --- | --- |
| `presidentDecision.requiredNow` | Control | Control (unchanged) |
| `presidentDecision.text` | LLM draft (NSF retained) | **Refill-owned final** (audited); else LLM draft retained |
| All other structured fields | per Pipeline v0.1.2 / Policy v0.2 | **unchanged by refill** |

---

## A. Objective

Design a **Bounded President Decision Semantic Refill v0.3** that:

1. Fires only when Control has determined President is required **and** prose is unusable **and** `NEEDS_SEMANTIC_FILL=true`.  
2. Rewrites **only** `executive.presidentDecision` text (structured PD block fields allowed for that block alone).  
3. Never invents technical/Class/Flag conclusions or financial affordability.  
4. Preserves full audit of original vs refill.  
5. On validation failure: keep NSF; do **not** silently substitute.

Primary acceptance target for later implementation/live: **GC02 D05**. D10b remains deferred.

---

## B. Trigger (all must hold)

Refill runs **only if** every condition is true:

| # | Condition | Source |
| --- | --- | --- |
| T1 | Control determines President required now (`requiredNow=true` after R4 / CDQ `expectedDecider`) | Control |
| T2 | Existing President Decision prose is **absent**, **contradictory** to requiredNow, or **says not required** (incl. licensed empty phrase) | Deterministic detectors |
| T3 | `needsSemanticFill === true` (Control finding `NEEDS_SEMANTIC_FILL`) | Control |

### B.1 Prose defect classes (T2)

| Class | Detector (design-level) | Example |
| --- | --- | --- |
| **Absent** | empty / whitespace-only `text` | `""` |
| **Not-required phrase** | same family as today’s `isNotRequiredPresidentText` | `"Not required at this stage."` |
| **Contradictory** | `requiredNow=true` but text asserts deferral / “no President decision” / “not needed now” without stating the CDQ decision | meta-refusal prose |

**Non-triggers (explicit):**

- `requiredNow=false` (President not wanted) — no refill.  
- NSF false even if prose is weak — no opportunistic rewrite.  
- Desire to “improve” otherwise valid PD for Golden keywords — **forbidden**.  
- D10b / learning / Review / readiness dissatisfaction alone — **forbidden**.

### B.2 NSF emission (Control alignment — design note)

Today Control sets NSF primarily on the not-required phrase. For v0.3, Control (or a thin pre-refill classifier) should treat **Absent** and **Contradictory** the same as not-required for NSF, so T2/T3 stay aligned. That is a **Control finding-coverage** clarification for implementation later — **not** a Policy v0.2 behavior change to authority/RC rules.

---

## C. Pipeline placement

Pipeline v0.1.2 order remains normative. Insert refill as an **optional audited stage** after Control, before Gate:

```text
Structural (Zod)
  → Decision Control (+ Policy v0.2)
  → Bounded Semantic Refill v0.3   ← NEW (only if T1∧T2∧T3)
  → Quality Gate v1.1
  → Enforced Readiness   ← Gate-owned final decisionReadiness only
  → Canonical Assembly
  → Canonical Schema
  → Golden Eval
```

**Rationale:** Gate / Assembly must see the post-refill PD when refill succeeds, so Canonical coherence (`requiredNow` vs text) is honest. Refill must not run after Golden (would be eval cheating).

### C.1 Readiness ownership (normative)

| Signal | Owner | Refill may use? |
| --- | --- | --- |
| Final `executive.decisionReadiness` | **Quality Gate only** (Pipeline v0.1.2) | **No** — does not exist yet when refill runs |
| Control-staged / provisional readiness | Control staging audit only (non-authoritative) | **No** (v0.3 choice — see below) |
| CDQ `deferredToExecutionOrClosure` + recommendation + facts | Envelope / controlled draft | **Yes** — sufficient “now vs later” scope |

**v0.3 choice:** Refill inputs include **no readiness field at all** (neither Gate-final nor Control-provisional).  
“Scope of now” comes from CDQ deferred list + recommendation + facts. This avoids inventing a second authoritative readiness source.

Refill must **not** write `decisionReadiness`.

### C.2 `NEEDS_SEMANTIC_FILL` vs Quality Gate

| Layer | Evaluates NSF? |
| --- | --- |
| Decision Control | **Yes** — emits `NEEDS_SEMANTIC_FILL` / `needsSemanticFill` |
| Quality Gate v1.1 | **No** — Gate rules do not score NSF (confirmed: not in Gate evaluator / Gate Rules) |
| Golden Eval D05 | Scores President Decision **intent**, not the NSF flag per se |

Therefore: successful refill **before Gate** clears Control’s NSF finding in the pipeline state / audit. That is **not** “Gate removing an NSF Critical.” Gate never owned NSF. Cleared NSF simply means Gate never sees a stale Control NSF annotation on the subject, and Canonical PD text is coherent.

**Feature flag (implementation later):** e.g. `MDD_SEMANTIC_REFILL_V03=1`, independent of Control flag so refill can be A/B’d without disabling Policy v0.2.

---

## D. Bounded inputs (allowlist)

Refill prompt/user payload may include **only**:

| Input | Why allowed |
| --- | --- |
| Current Decision Question (full triad + `decisionClass`) | Defines the decision President must face; deferred list scopes “now” |
| Controlled `primaryCaseType` | Decision class framing |
| Controlled `executive.decisionAuthorities` | Who decides what — prevents President-as-Class-interpreter |
| Controlled facts: confirmed / unverified / assumptions / missing (reported-oriented) | Grounding; no new narrative |
| Controlled `executive.recommendation` | Align PD with rec **without copying** forbidden inventiveness |
| Controlled `professionalBoundary` (or equivalent boundary block if present on output) | Hard negatives |
| Trigger metadata | NSF reason / defect class |

**Explicitly excluded from refill context:**

- **Any readiness field** (Gate-final or Control-provisional) — final readiness is Gate-owned and not yet computed; provisional must not become a second authority  
- Full raw pasted case narrative beyond what already appears in controlled facts (avoid re-litigation / invention)  
- Golden Spec expected strings / Eval keyword lists  
- Learning block (CA/PA/MR/KU) — D10b out of scope  
- `reviewCandidate`  
- `qualityGate` draft / findings  
- Finance numeric fields as affordability conclusions (figures may appear inside facts if already confirmed/reported; refill must not **decide** affordability)  
- Org defaults / Source Provenance (deferred; unused)  
- Prior Golden IDs / vessel-keyed hints  

---

## E. Output contract

### E.1 Writable surface

| Field | Refill may write? |
| --- | --- |
| `executive.presidentDecision.text` | **Yes** (primary) |
| `executive.presidentDecision.requiredNow` | **No** (already Control-true; must remain `true`) |
| Any other Schema path | **No** |

Optional: if Schema allows ancillary PD metadata inside the same block only (e.g. future `status`), still **no** sibling executive/learning/finance/review fields.

### E.2 Semantic bounds (must)

President Decision text **must**:

1. State the **management decision required now** in CDQ terms (paraphrase allowed).  
2. Remain consistent with `requiredNow=true`.  
3. Respect Decision Authorities (e.g. GC02-class: President = **management confirmation**, not Class technical judgment).  
4. Stay short enough for 30-second executive use (D12-friendly; not an essay).  
5. Align with Recommendation **direction** without restating the whole recommendation memo.

### E.3 Semantic bounds (must not)

Refill **must not**:

| Forbidden | Example |
| --- | --- |
| Invent Class / technical acceptance | “ClassNK has approved all CMS items” |
| Invent Flag / ASI closure | “Flag items can be closed” |
| Invent financial affordability | “Company can afford USD40,000” |
| Collapse Necessary ≠ Affordable | funding cases |
| Force opposite CDQ decision | abandon plan without evidence when CDQ is confirm-subject-to-reconfirm |
| Author KU / MR / Review / readiness / facts / authorities / case type | any side effect |
| Emit “Not required at this stage.” | regresses NSF |

### E.4 GC02-shaped intent (illustrative only — not prompt hardcode of Golden keywords)

For `decisionClass === technical_class_handling_confirm` (generalized):

> Maintain the current handling plan **subject to** focused Class re-confirmation / clarification; President confirms management stance, not personal Class interpretation.

Implementation must key off **decisionClass / CDQ**, never `goldenId === "GC02"`.

---

## F. Validation gate (deterministic, post-LLM)

Before accepting refill text into the controlled draft:

| Check | On fail |
| --- | --- |
| Non-empty trimmed text | reject |
| Does not match not-required phrase family | reject |
| Does not contain hard-forbidden invention patterns (Class-all-approved; photo-only close; liquidity-confirmed-without-evidence; etc. — generalized NG list, not Golden IDs) | reject |
| `requiredNow` remains true | reject if model tried to flip |
| JSON/shape valid for PD block | reject |
| Optional: minimum overlap with CDQ tokens / decisionClass lexicon (soft) | warn or reject per approval Q |

**On any reject:**

1. Keep original LLM `presidentDecision.text`.  
2. Keep `needsSemanticFill=true` and `NEEDS_SEMANTIC_FILL` finding.  
3. Record failed refill attempt in audit (see §G).  
4. **Do not** silently substitute rejected text.  
5. Continue pipeline (Gate → … → Golden may still Fail D05 — honest).

**On accept:**

1. Write refill text to controlled `presidentDecision.text`.  
2. Clear or downgrade NSF finding to audited `SEMANTIC_REFILL_APPLIED` (design: clear NSF boolean; retain audit trail).  
3. Proceed to Gate with filled PD.

---

## G. Audit / provenance of the refill itself

Persist (Control audit extension or sibling `semanticRefill` record):

| Field | Content |
| --- | --- |
| `originalLlmPresidentDecision` | raw `{ text, requiredNow }` |
| `refillOutput` | proposed `{ text }` (+ accept/reject) |
| `finalPresidentDecision` | what entered Gate |
| `model` | model id used for refill call |
| `promptVersion` | refill prompt/version string (separate from System Prompt v1.0) |
| `timestamp` | ISO time of refill attempt |
| `triggerReason` | NSF + defect class (absent / not-required / contradictory) |
| `validationResult` | pass/fail + codes |
| `inputsFingerprint` | hash/summary of allowlisted inputs (debug) |

Original full LLM draft remains under existing `originalLlmDraft`. Refill never mutates that snapshot.

---

## H. Model choice analysis (configurable; first live test = mini)

| Option | Pros | Cons | When |
| --- | --- | --- | --- |
| **A. Same `gpt-4o-mini` as primary draft** | Isolates refill effect; cost/latency parity | Same model that emitted empty phrase may still fail tight second prompt | **First controlled live test** |
| **B. Stronger model only for refill** | Better constraint following on tiny surface | Confounds refill vs model upgrade | **Only if** A still fails after bounded refill |

**Design recommendation (for approval, not a run):**

- Refill model is **always configurable** (e.g. `MDD_SEMANTIC_REFILL_MODEL`).  
- **First controlled live test:** **`gpt-4o-mini` for both** primary draft and refill — isolate Semantic Refill itself.  
- Escalate to stronger refill-only model **only after** mini+refill still fails.  
- No bake-off in this design phase.

Voice consistency risk is acceptable: PD is a distinct speech act from Recommendation, and audit preserves both authors.

---

## I. Interaction with frozen layers

| Layer | Refill may change? |
| --- | --- |
| System Prompt v1.0 | **No** — refill uses a **separate** bounded prompt/version |
| Schema v1.0 | **No** — writes existing PD fields only |
| Gate v1.1 | **No** rules; consumes post-refill draft |
| Policy v0.2 | **No** |
| Pipeline v0.1.2 stages | **Additive** refill stage only |
| Golden Spec / Eval | **No** (GC04 expectation grounding unchanged; D10b unchanged) |
| Source Provenance v0.1 | **No** (deferred) |

---

## J. Out of scope

| Item | Status |
| --- | --- |
| GC02 D10b / `knowledgeUpdateCandidate` | **Out of scope** |
| GC04 D04 / provenance enrichment / org Master default | **Out of scope** (`INPUT_CONTEXT_DEFICIENCY` / `GOLDEN_EXPECTATION_NOT_INPUT_GROUNDED`) |
| General rewrite of Recommendation / Why / Next Actions | Forbidden |
| Control-authored PD templates without LLM | Forbidden (Q3 retained) |
| Implementation / live Golden rerun / model bake-off | Deferred |
| Eval D05 keyword softening | Forbidden |

---

## K. Expected later effect (analytical only)

| Case / dim | Expected if refill works |
| --- | --- |
| GC02 D05 | **Likely Pass** when NSF was not-required phrase and CDQ is Class-handling confirm |
| GC02 D10b | **Unchanged** (still Fail until separate KU work) |
| GC01 / GC03 | No refill if NSF false; if intermittent NSF+not-required recurs, same bounded path may help D05 without touching Policy |
| GC04 D04 | **Unchanged** (input-grounding; not refill) |

No claim of live Pass without a future approved run.

---

## L. Approval questions

### L1. Scope — bounded PD refill; D10b and GC04 D04 out of scope?

**Question:** Approve Semantic Refill v0.3 as a **bounded President Decision text refill** only, triggered solely by T1∧T2∧T3 (`requiredNow` after Control + unusable/contradictory/not-required PD prose + `NEEDS_SEMANTIC_FILL`), writing **only** `executive.presidentDecision.text`, and explicitly leaving **GC02 D10b / KU**, **GC04 D04** (`INPUT_CONTEXT_DEFICIENCY` / `GOLDEN_EXPECTATION_NOT_INPUT_GROUNDED`), Review, facts, authorities, case type, recommendation, finance, learning, Gate rules, and Eval expectations out of scope?

**Recommended answer:** **APPROVE.**

---

### L2. Pipeline slot, Readiness ownership, and NSF vs Gate?

**Question:** Approve pipeline order `Control → Semantic Refill → Gate`, with these ownership rules:

1. Final `decisionReadiness` remains **Gate-owned only** (Pipeline v0.1.2).  
2. Refill runs **before** Gate and therefore **must not** depend on final Gate readiness (it does not exist yet).  
3. Refill inputs include **no readiness field at all** (neither Gate-final nor Control-provisional), so no second authoritative readiness source is created; “now vs later” comes from CDQ deferred list + recommendation + facts.  
4. Quality Gate v1.1 **does not** evaluate `NEEDS_SEMANTIC_FILL` (Control-only finding). Successful refill clears NSF in Control/pipeline state **before** Gate; that is not Gate scoring or removing an NSF Critical.

Also approve an independent feature flag for the refill stage?

**Recommended answer:** **APPROVE** (no readiness in refill inputs; NSF is Control-owned and cleared pre-Gate on success).

---

### L3. Input allowlist (no readiness)?

**Question:** Approve the allowlisted refill inputs — CDQ (including deferred), controlled case type, decision authorities, confirmed/unverified/assumptions/missing facts, recommendation, professional boundary, trigger metadata — and the explicit exclusions: **any readiness field**, learning/KU/MR, Review Candidate, qualityGate, Golden Spec/Eval strings, full raw narrative re-dump, finance affordability conclusions, Source Provenance, vessel/Golden IDs?

**Recommended answer:** **APPROVE.**

---

### L4. Fail-closed validation + audit preservation?

**Question:** Approve that failed refill validation retains the **original** LLM President Decision text, keeps `NEEDS_SEMANTIC_FILL`, records the failed attempt (model, prompt/version, timestamp, trigger reason, proposed text, validation codes), never silently substitutes rejected text, and that both original PD and any accepted refill remain fully auditable under `originalLlmDraft` / refill audit?

**Recommended answer:** **APPROVE.**

---

### L5. Model strategy (configurable; first live test = mini both)?

**Question:** Approve that the refill **model is configurable**, but for the **first controlled live test** both primary draft and refill use **`gpt-4o-mini`**, so the experiment isolates Semantic Refill (bounds/pipeline/prompt) rather than a model upgrade; a stronger refill-only model is compared **only if** mini+bounded refill still fails; no bake-off in this design phase?

**Recommended answer:** **APPROVE** — configurable implementation; **first live test = `gpt-4o-mini` for both**; stronger model only as a later contingency.

---

### L6. NSF clear on success (Control finding, not Gate)?

**Question:** On accepted refill, clear `needsSemanticFill` and replace the Control `NEEDS_SEMANTIC_FILL` finding with audited `SEMANTIC_REFILL_APPLIED`, while preserving original LLM PD in audit/`originalLlmDraft`? Confirm this is a **Control/pipeline-state** clearance, not a Quality Gate evaluation of NSF?

**Recommended answer:** **APPROVE.**

---

### L7. Defer implementation until these L1–L7 answers are locked?

**Question:** Defer implementation and live rerun until L1–L7 are formally answered; keep Source Provenance deferred; leave GC04 D04 classification and Golden Eval/expected outputs unchanged?

**Recommended answer:** **APPROVE defer implementation** until approval of this clarified L1–L7 set.

---

## M. Stop condition

This document stops at:

1. Bounded refill objective and GC02 D05 focus  
2. Triggers, inputs, output bounds, validation, audit  
3. Pipeline placement and model-choice analysis (no runs)  
4. Explicit D10b / GC04 / Provenance exclusions  
5. Approval questions L1–L7  

**No implementation. No live LLM run. Decision Policy v0.2 unchanged. Source Provenance unchanged (deferred).**
