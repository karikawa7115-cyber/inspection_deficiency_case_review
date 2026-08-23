# Decision Control Layer v0.1 — Design Proposal

**Status:** APPROVED FOR IMPLEMENTATION — v0.1 implemented behind `MDD_DECISION_CONTROL_V01` (see implementation report).  
**Direction:** Approved with Q1–Q6 final decisions (2026-08-23).  
**Inputs:** Three-model live comparison (gpt-4o-mini, gpt-5.6-terra, gpt-5.6-sol) on GC01–GC04 under Structured Outputs + Quality Gate v1.1.  
**Does not modify:** System Prompt v1.0, Structured Output Schema v1.0, Quality Gate v1.1, Golden Case Specification v1.0, Golden LLM Evaluation Rules v1.0.

---

## 0. Approved design constraints (pre-implementation)

These constraints are normative for any future Control v0.1 implementation.

### 0.1 Current Decision Question (Case Envelope, first-class)

`currentDecisionQuestion` is a **first-class Case Envelope field**. The LLM must **not** be required to infer the current decision solely from the full case narrative.

It must express at least:

| Component | Meaning |
| --- | --- |
| **decisionRequiredNow** | What decision is currently required (the principal management question) |
| **expectedDecider** | Who is expected to make or confirm it (role / authority kind) |
| **deferredToExecutionOrClosure** | What is intentionally deferred to execution / closure (not part of the current decision) |

Envelope shape (illustrative; not Schema v1.0):

```
CaseEnvelope.currentDecisionQuestion {
  decisionRequiredNow: string
  expectedDecider: string          // e.g. President/DP | Superintendent | Finance/Accounting | …
  deferredToExecutionOrClosure: string[]
  // optional: decisionClass token for Control rules (not Golden ID)
}
```

### 0.2 Control Layer auditability (no silent overwrite)

Decision Control must **never silently overwrite** an LLM semantic result.

For **every** deterministic intervention, retain:

| Field | Requirement |
| --- | --- |
| `originalLlmValue` | Value before Control |
| `controlledValue` | Value after Control (final for that field) |
| `ruleId` | Stable rule identifier (e.g. `R3`, `R6`) |
| `reason` | Human-readable justification |
| `at` | ISO timestamp |
| `controlVersion` | e.g. `decision-control/0.1` |

Audit records are part of the Analyze/Brief envelope (alongside Gate findings), not buried in `debug` alone.

### 0.3 President/DP policy (non-mechanical)

Do **not** mechanically require President/DP on every case.

`presidentDecision.requiredNow` must be derived from:

1. Stable **decision-authority rules** (who owns this class of decision), and  
2. The **Current Decision Question** (`expectedDecider` / `decisionRequiredNow`)

Avoid Golden-case-specific “always President on GC0x” rules.

### 0.4 No case-specific deterministic patches

Rules must generalize beyond GC01–GC04.

Forbidden: vessel name, Golden Case ID, or Spec fixture identity as rule predicates.

Example — **Review Candidate** must use policy criteria such as:

- repeat / recurring issue  
- system weakness hypothesis under challenge  
- high risk / safety-compliance exposure  
- fleet-wide relevance  
- ineffective or shallow corrective action  
- external signal (Flag/Class/authority observation requiring retention)

Not: “vessel ORBIT” or “if goldenId === GC03”.

### 0.5 Critical human override (unchanged Gate semantics)

Preserve Quality Gate Rules v1.1 / v1.0 override policy:

| Rule | Meaning |
| --- | --- |
| Proceed despite Critical | Human may decide to **proceed** while Critical findings remain |
| Findings remain visible | Critical findings are **not** cleared or relabeled as Warnings |
| Readiness | Override must **not** make readiness `READY` |
| Separate audit action | Proceed is stored as an **auditable human action** (`proceedDespiteCritical`), distinct from readiness |
| Not Gate bypass | Critical override ≠ Gate bypass; `passed` stays false while Criticals remain |

---

## 1. Objective

Separate **LLM semantic work** from **deterministic MDD decision-control rules**, so that:

- Models may vary in prose quality without reshuffling *policy* outcomes (authorities, readiness class, review policy, case-type locks, finance approval dependencies).
- Remaining failures stop “moving between models” solely because each model re-invents MDD policy.
- Golden Spec remains the acceptance truth; Decision Control must not become a Golden-case patch kit.
- Every Control intervention is **auditable** (§0.2); nothing is silently rewritten.

### 1.1 LLM owns (semantic)

| Work | Examples |
| --- | --- |
| Fact extraction & bucketting | Confirmed / unverified / assumptions |
| Missing-information discovery | Who / What / Evidence drafts |
| Risk interpretation | Risk list, severity narrative |
| Option generation | Genuine alternatives (when real) |
| Recommendation drafting | Direction prose within boundaries |
| Root-cause / preventive-action analysis | Challenge shallow RC; CAPA suggestions |
| Management-learning *suggestions* | Soft signals for CA/PA/EV/HC/fleet/IA/MR/KU |

### 1.2 Deterministic MDD owns (decision control)

| Work | Examples |
| --- | --- |
| Final Case Type confirmation | Where rules/data + Current Decision Question establish type |
| Final Readiness alignment (pre-Gate) | Stage-aware; Gate remains final Critical/READY authority |
| Decision Authority requirements | Minimum role→authority sets from **decision class + CDQ**, not “always President” |
| President/DP `requiredNow` | Only when CDQ + authority rules say President/DP decides now (§0.3) |
| Review Candidate policy | Policy criteria (§0.4), not Golden identity |
| Known metadata/tags | Vessel, case id, envelope-derived labels |
| Finance approval dependencies | Liquidity before READY; final amount authority when CDQ is funding decision |
| Professional Boundary enforcement | Hard vetoes with full audit |
| Decision-stage interpretation | Bound to CDQ deferred vs required-now |

### 1.3 Human owns

| Work | Examples |
| --- | --- |
| Final operational decision | Approve / defer / escalate |
| Critical override | Proceed-despite-Critical (§0.5) — never silent; never forces READY |
| Ambiguous case-type / policy judgment | When rules conflict or data insufficient |
| Spec / Prompt / Gate / Control version approval | Any normative change |

---

## 2. Why now (evidence from three-model comparison)

| Observation | Implication |
| --- | --- |
| Schema + Gate v1.1 largely green on 4o-mini; terra/sol reintroduce CriticalFails via different paths | Failures are **not** mainly Schema shape; they are policy + semantic drift |
| Same Spec fails rotate across models (tags, authorities, President Decision, Review, case type) | LLM alone will not converge; **policy should not be left to free generation** |
| All models frequently emit `President Decision: Not required at this stage.` | Prompt licenses the phrase; without CDQ, models under-identify when President *is* required |
| GC02 type flips to `INSPECTION_COMPLIANCE` on sol | Case Type needs confirmation from **principal decision** (CDQ), not inspector presence |
| GC03 Review flag true/false flips by model | Review is **policy** (criteria-based), not prose taste |
| False DECISION_BLOCKING on execution/closure gaps | Staging needs CDQ “deferred” list, not narrative alone |
| Required tags often missing while vessel/title known | Envelope metadata must not depend on LLM invention |

**Conclusion:** Implement Control after this constraint set; **do not** yet retune System Prompt v1.0 (see §9).

---

## 3. Failure classification (GC01–GC04 across three models)

Legend:

- **LLM_SEMANTIC_FAILURE** — model prose/intent/structure wrong; fixing needs better semantic draft or later Prompt revision  
- **DETERMINISTIC_POLICY_CANDIDATE** — stable MDD/business rule; Control Layer should set/override **with audit**  
- **INPUT_CONTEXT_DEFICIENCY** — case envelope lacked explicit Current Decision Question / metadata  
- **GOLDEN_EVALUATOR_ARTIFACT** — eval keyword/tag matching is brittle; not necessarily wrong brief  

> GC01–GC04 illustrate classes; rules must **not** key off Golden IDs (§0.4).

### 3.1 GC01 — CREW_MANNING (expected READY; postpone Nansha→Japan)

| Failure pattern | Primary class | Notes |
| --- | --- | --- |
| T01 missing vessel/crew tags | **DETERMINISTIC_POLICY_CANDIDATE** | Envelope-derived tags |
| D04 incomplete authorities | **DETERMINISTIC_POLICY_CANDIDATE** | From CDQ + manning decision-class RACI — include President **only if** CDQ expectedDecider is President/DP |
| D05 / D07: “not required”; CONDITIONAL vs READY | **INPUT_CONTEXT_DEFICIENCY** + policy | With CDQ “approve postpone?”, President may be required; port/docs deferred → READY eligible |
| Port/ETA / docs as DECISION_BLOCKING | **DETERMINISTIC_POLICY_CANDIDATE** | Match CDQ deferred list → EXECUTION_CONDITION |
| Spurious finance | **LLM_SEMANTIC_FAILURE** | |
| Weak intent keywords | **LLM_SEMANTIC_FAILURE** / GOLDEN artifact | |

### 3.2 GC02 — TECHNICAL (expected CONDITIONAL)

| Failure pattern | Primary class | Notes |
| --- | --- | --- |
| Wrong primary type (INSPECTION vs TECHNICAL) | **DETERMINISTIC_POLICY_CANDIDATE** | CDQ principal = Class/CMS handling confirm |
| Thin authorities / President misuse | **DETERMINISTIC_POLICY_CANDIDATE** | Supt + Class; President only if CDQ says management confirmation by President/DP |
| False DECISION_BLOCKING on C/E feasibility | **DETERMINISTIC_POLICY_CANDIDATE** | Often deferred confirm under CDQ |
| Soft review/monitor | **LLM_SEMANTIC** / soft policy | Do not force Review solely because case is technical |

### 3.3 GC03 — INSPECTION_COMPLIANCE (expected CONDITIONAL; Review YES)

| Failure pattern | Primary class | Notes |
| --- | --- | --- |
| Review flag false | **DETERMINISTIC_POLICY_CANDIDATE** | Trigger via **policy criteria** (external Flag signal + system/CAPA weakness signals), not vessel/Golden ID |
| ASI wording as DECISION_BLOCKING | **DETERMINISTIC_POLICY_CANDIDATE** | CDQ: current decision = keep open / non-closure; ASI completeness often deferred to closure evidence |
| President “not required” vs closure stance | **DETERMINISTIC_POLICY_CANDIDATE** | Only if CDQ expectedDecider is President/DP (closure acceptance) |
| Weak recommendation intent | **LLM_SEMANTIC_FAILURE** | Control does not author rec |

### 3.4 GC04 — FINANCE_COMMERCIAL (expected CONDITIONAL)

| Failure pattern | Primary class | Notes |
| --- | --- | --- |
| Finance-only authorities; missing final amount owner | **DETERMINISTIC_POLICY_CANDIDATE** | When CDQ is CTM **funding amount**, President/DP (or declared final funder) is required — not on every finance note |
| “not required” on amount decision | Same | Driven by CDQ, not blanket finance→President |
| Tags / intent keywords | Mix deterministic envelope + LLM semantic | |

### 3.5 Cross-cutting

| Pattern | Class |
| --- | --- |
| False DECISION_BLOCKING | DETERMINISTIC — CDQ deferred list + Gate stage taxonomy |
| Universal “not required” | INPUT_CONTEXT_DEFICIENCY without CDQ; Prompt licenses phrase — Control sets `requiredNow` only when CDQ+authority rules say so |

---

## 4. Responsibility matrix

| Concern | LLM Semantic Draft | Decision Control Layer | Quality Gate v1.1 | Human |
| --- | --- | --- | --- | --- |
| Infer current decision from narrative alone | **Must not be required** | Consumes envelope CDQ | — | Authors/confirms CDQ |
| Extract facts / missing / risks / options | **Primary** | No silent delete; may annotate stage | — | Correct facts |
| Draft recommendation / why | **Primary** | Boundary veto with audit; no silent prose rewrite preferred | Boundary Criticals | Approve |
| Draft President Decision prose | Draft candidate | Set `requiredNow` per §0.3; flag empty “not required” when required; **audit before/after**; prefer LLM rewrite pass over silent invented prose | — | Final yes/no |
| Primary Case Type | Propose | Confirm/override + audit | — | Resolve conflicts |
| Tags | Propose optional | Merge envelope tags + audit | — | — |
| Authorities | Propose | Upsert minima from CDQ+decision class + audit; **no blanket President** | Authority Criticals | Adjust |
| Review Candidate | Suggest | Policy criteria (§0.4) + audit | Consistency warns | Override with audit |
| Missing-info stage | Hints | Reclassify using CDQ deferred vs required + audit | Critical vs Warning | — |
| Readiness | Propose | Align with stage/CDQ; Gate final on Critical | **Enforce** no READY with Critical | Proceed ≠ READY (§0.5) |
| Critical override | — | Does not clear Criticals | Findings remain; `passed=false` | Auditable proceed action |
| `evaluatedAt` | — | System inject | Sets on eval | — |

---

## 5. Proposed Decision Control rules (v0.1 candidates)

All overrides emit §0.2 audit records. No Golden IDs / vessel-name predicates.

### R1 — Known tags from case envelope

| | |
| --- | --- |
| **Why stable** | Envelope metadata is not semantic inference |
| **Inputs** | `vessel`, `title`, confirmed type, caller tags |
| **Override** | Additive merge only |
| **Audit** | original tags → controlled tags; `R1` |

### R2 — Case Type confirmation (CDQ-aware)

| | |
| --- | --- |
| **Why stable** | Primary type follows principal decision in CDQ |
| **Inputs** | LLM type; CDQ; generalized feature detectors (Class/CMS handling vs inspection closure vs CTM vs crew-change postpone) |
| **Override** | When high-confidence conflict |
| **Audit** | proposed → confirmed; `R2` |
| **Anti-overfit** | Feature/decision-class tokens only |

### R3 — Minimum Decision Authorities (CDQ + decision class)

| | |
| --- | --- |
| **Why stable** | Company RACI by decision class |
| **Inputs** | CDQ.expectedDecider; decision class; LLM authorities |
| **Override** | Upsert **required** pairs for that class; include President/DP **only** when CDQ/authority rules say so (§0.3) |
| **Audit** | per upserted item; `R3` |

### R4 — President Decision `requiredNow` (non-mechanical)

| | |
| --- | --- |
| **Why stable** | MDD surfaces only decisions that need President/DP *now* |
| **Inputs** | CDQ.expectedDecider; decision-authority rules; LLM `presidentDecision` |
| **Override** | If expectedDecider is President/DP (or authority rules assign final management approval to President/DP for this class) → `requiredNow=true`. If text is the licensed empty phrase → set `needsSemanticFill` (prefer LLM fill / UI prompt; avoid Control inventing amounts/Class conclusions). If expectedDecider is **not** President/DP → do **not** force President |
| **Audit** | original requiredNow/text → controlled; `R4` |

### R5 — Readiness vs execution/closure (CDQ + Gate v1.1)

| | |
| --- | --- |
| **Why stable** | Gate stage taxonomy; CDQ lists what is deferred |
| **Inputs** | Missing items; CDQ.deferredToExecutionOrClosure; proposed readiness |
| **Override** | Restage; may allow READY when only deferred execution gaps remain **and** no Critical; may force CONDITIONAL when material non-deferred conditions remain |
| **Audit** | `R5`; never READY via Critical override (§0.5) |

### R6 — Review Candidate (policy criteria, not Golden ID)

| | |
| --- | --- |
| **Why stable** | Retention/MR policy for significant learning/risk |
| **Inputs** | Learning signals; risks; external authority observations; repeat/fleet/high-risk/shallow-CAPA indicators from structured fields + CDQ |
| **Override** | If policy criteria met → `reviewCandidate.flag=true` (and optionally retainAfterClose). Soft monitor path may use `monitorOnly` without forcing MR. **Never** key off vessel/Golden ID |
| **Audit** | criteria matched[]; before/after; `R6` |
| **Scope note** | v0.1 may force **flag** only; whether to force `managementReviewCandidate` is a §10 question |

### R7 — Finance approval dependencies

| | |
| --- | --- |
| **Why stable** | Necessary≠Affordable; no payment authorize; liquidity before READY |
| **Inputs** | Finance case/extension; CDQ (is this a funding-amount decision?); liquidity confirmed |
| **Override** | Upsert final funder authority when CDQ is amount approval; strip payment authorize; demote illegal READY |
| **Audit** | `R7` |

### R8 — Professional Boundary hard vetoes

| | |
| --- | --- |
| **Why stable** | Non-negotiable specialist boundaries |
| **Inputs** | Prose + boundaries arrays |
| **Override** | Prefer annotate + Gate Critical over silent prose rewrite; if rewrite ever needed, full audit |
| **Audit** | snippet + reason; `R8` |

### R9 — Decision-stage reinterpretation

| | |
| --- | --- |
| **Why stable** | Gate v1.1 stages + CDQ deferred list |
| **Inputs** | CDQ; missing items; blocksReadiness hint |
| **Override** | Relabel stage only; do not delete missing items |
| **Audit** | per item llm vs controlled stage; `R9` |

---

## 6. Proposed data flow

### 6.1 Target pipeline

```
Raw Case Input
  → Case Context / Envelope
       - vessel, title, pastedText, financeSourceInput
       - known tags / ids
       - Current Decision Question (first-class; §0.1)
  → LLM Semantic Draft
       - receives CDQ in user payload (not Prompt rewrite)
       - System Prompt v1.0 (unchanged this phase)
       - Structured Outputs → Zod Schema v1.0
       - normalize + system evaluatedAt
  → Decision Control Layer v0.1
       - R1–R9 with mandatory audit records (§0.2)
       - preserve original LLM snapshot
  → Quality Gate v1.1
       - Critical/Warning; readiness enforcement
  → Enforced Readiness
       - Gate wins on Critical → never READY
       - Human proceed-despite-Critical is separate (§0.5)
  → Decision Brief (+ controlAudit + gate + optional humanOverride)
  → Golden Evaluation (Rules v1.0 unchanged)
```

### 6.2 Current Decision Question — confirmed design

**Approved:** first-class **Case Envelope** field (not Schema v1.0 bump in v0.1).

Must include §0.1 triad: decision required now / expected decider / deferred execution-closure.

Golden Lab / UI supplies CDQ from **decision-class templates** (generalized), never from Golden answer keys:

| Decision class (generic) | decisionRequiredNow (example framing) | expectedDecider | deferred (examples) |
| --- | --- | --- | --- |
| Crew-change postponement approval | Approve postponement of planned change to later port/window? | President/DP (final management) or declared owner | Exact port/ETA; routine docs chase |
| Technical Class handling confirmation | Maintain proposed Class/CMS handling subject to focused Class confirm? | Superintendent + Class; President/DP only if management confirmation asked | Written Class reply detail; item-by-item execution |
| Inspection/ISM non-closure | May Company close now, or must CAPA/RC/horizontal/effectiveness remain open? | President/DP or Company closure authority per RACI | Full external observation text; photo packs |
| Funding amount (CTM etc.) | What amount to approve given vessel need vs liquidity? | President/DP (final) + Finance (liquidity) | Payee/date execution detail |

---

## 7. Risks of over-determinism / Golden overfitting

| Risk | Mitigation |
| --- | --- |
| GC01–04 patches | §0.4 — no Golden/vessel predicates |
| Silent overwrite | §0.2 — mandatory audit; keep original snapshot |
| Blanket President | §0.3 — CDQ + authority rules only |
| Control-authored fake decisions | Prefer `needsSemanticFill`; no invented amounts/Class acceptance |
| Hiding LLM weakness | Golden still scores semantic dims; audit exposes pre-control |
| Override as Gate bypass | §0.5 — forbidden |
| Tag stuffing | Envelope-derivable only |

---

## 8. Recommendation on System Prompt v1.0

**Do not change System Prompt v1.0 in this phase.**

Pass CDQ via **user/case payload** into the LLM connection layer so the model sees the current decision without a Prompt version bump. Revisit Prompt v1.1 only after Control is proven (clarify “not required” only when CDQ does not assign President/DP).

---

## 9. Implementation boundary (explicit non-goals until implementation approval)

- This document remains a proposal; no production code yet.  
- No Schema/Prompt/Gate/Spec/Eval edits in this update.  
- No additional model runs.  
- No weakening of Quality Gate Critical codes.  
- Future implementation: feature flag + full `controlAudit[]` on every Analyze.

---

## 10. Design questions (with recommended answers)

### Q1. Current Decision Question as envelope-first-class?

**Question:** Approve Current Decision Question as a first-class Case Envelope field with the triad (decision required now / expected decider / deferred to execution-closure), supplied to the LLM in the case payload so it need not infer the current decision from the full narrative alone?

**Recommended answer:** **Yes.** Envelope-first (no Schema v1.0 bump in Control v0.1). CDQ is mandatory input to Control and should be passed into the LLM user payload. Schema echo of CDQ can wait for a later Schema version if needed.

---

### Q2. Authority intervention mode (R3)?

**Question:** When required authorities are missing, should Control **upsert** them into `decisionAuthorities`, or **warn-only** (leave LLM output unchanged and surface a control warning)?

**Recommended answer:** **Upsert** missing required authorities (status `pending`), with full §0.2 audit (original array → controlled array). Warn-only leaves the rotating D04 failures unfixed. Do not invent `confirmed` status. Do not upsert President/DP unless CDQ/authority rules require it (§0.3).

---

### Q3. President Decision text when `requiredNow` becomes true (R4)?

**Question:** If Control sets `requiredNow=true` but the LLM emitted the licensed empty phrase (“President Decision: Not required at this stage.”), may Control replace the text with a Control-generated decision-statement skeleton, or must the LLM always author the sentence?

**Recommended answer:** **LLM must author the sentence** for v0.1. Control sets `requiredNow=true`, retains original text in audit, sets `needsSemanticFill=true`, and optionally triggers a **bounded semantic refill** (same model, CDQ-constrained) or UI prompt — **not** a silent Control-written presidential decision. Inventing amounts/Class conclusions in Control is forbidden. If refill is out of scope for v0.1, leave text as-is with audit flag (Golden may still fail D05 until refill exists).

---

### Q4. Review policy force scope (R6)?

**Question:** When Review policy criteria fire, should Control force only `reviewCandidate.flag` (and optionally `retainAfterClose`), or also force `learning.managementReviewCandidate`?

**Recommended answer:** Force **`reviewCandidate.flag` (+ retainAfterClose when retention policy says so)** in v0.1. Do **not** auto-force `managementReviewCandidate` — that remains an LLM/human semantic learning judgment. Gate consistency warning may still fire if MR=true with flag false; Control’s job is the retention **flag** policy. Criteria must be generalized (§0.4), never Golden/vessel keyed.

---

### Q5. Critical human override packaging?

**Question:** Confirm that Critical override remains Gate-aligned: proceed allowed; Criticals remain visible; readiness never becomes READY due to override; proceed stored as separate auditable human action; override ≠ Gate bypass?

**Recommended answer:** **Yes — confirm as written in §0.5.** Control must not offer a path that clears Criticals or sets READY on override. Brief/API should expose `humanOverride.proceedDespiteCritical` separately from `decisionReadiness`.

---

### Q6. Proceed to implement Control v0.1 without Prompt / Schema / Gate / Eval edits?

**Question:** Implement Decision Control v0.1 against frozen System Prompt v1.0, Schema v1.0, Quality Gate v1.1, Golden Spec v1.0, and Golden LLM Evaluation Rules v1.0, with CDQ on the envelope and mandatory control audit — no frozen-document edits in the first implementation PR?

**Recommended answer:** **Yes.** First implementation: envelope CDQ + Control R1–R9 (as constrained) + audit + wire into propose/Analyze/Golden LLM pipeline behind a flag. No Prompt/Schema/Gate/Eval text changes. Re-baseline models only after Control is on.

---

## 11. Summary verdict

| Question | Answer |
| --- | --- |
| Add Decision Control between LLM draft and Gate? | **Yes** |
| Current Decision Question first-class? | **Yes (envelope triad)** |
| Silent overwrite allowed? | **No — full audit always** |
| President on every case? | **No — CDQ + authority rules only** |
| Golden-ID / vessel patches? | **Forbidden** |
| Critical override = Gate bypass? | **No** |
| Change System Prompt now? | **No** |

**End of Decision Control Layer v0.1 Design Proposal**
