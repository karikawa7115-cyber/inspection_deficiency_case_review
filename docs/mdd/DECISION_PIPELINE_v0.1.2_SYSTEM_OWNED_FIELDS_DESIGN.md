# Decision Pipeline v0.1.2  ESystem-Owned Fields  
## Design Proposal Only

**Status:** DESIGN PROPOSAL  Enot implemented.  
**Date:** 2026-08-23  
**Context:** v0.1.1 live rerun (`tmp/mdd-llm-golden-run-2026-08-23T09-05-22-818Z.json`) showed P1 (Finance activation) and P2 (two-stage validation) directionally successful, and exposed a deeper **field-ownership** failure: LLM-emitted `qualityGate` remained authoritative enough to break Canonical after Control correctly staged readiness.

**Does not modify (this document):**  
System Prompt v1.0 · Canonical Schema v1.0 · Golden Spec v1.0 · Golden Eval Rules v1.0 · Quality Gate Rules v1.1 · Semantic Refill · new model runs.

**Evidence baseline:** Control ON + Gate v1.1 + gpt-4o-mini · GC01–GC04.

---

## 0. Problem statement

| Case | Ownership symptom |
| --- | --- |
| **GC01** | Control set readiness **READY** (CDQ-deferred missings). LLM draft still carried `qualityGate.criticalFailures` with `CRITICAL_FACT_MISSING`. Canonical Schema correctly rejected READY + criticals ↁE**CriticalFail / D00**. Finance F0 worked (no spurious finance Critical). |
| **GC04** | P2 allowed Control to run; Canonical passed. Residual Golden **D04** (authority domain gap) and **D11** (`reviewCandidate.flag=true` vs Spec `no`). |
| **GC03** | D04 residual (known). New **D05** (President Decision intent keywords absent)  Emodel variance. |
| **GC02** | Unchanged residual D05 + D10b + `NEEDS_SEMANTIC_FILL` (expected under deferred refill). |

**Root cause class:** Multiple writers for the same final-state fields without a single authoritative owner. Especially `qualityGate` and (secondarily) `decisionReadiness` / `reviewCandidate.flag`.

---

## 1. Quality Gate ownership

### 1.1 Current state (v0.1.1)

```text
LLM emits qualityGate (Schema-required shape)
  ↁEControl may change readiness / facts / authorities (does not rewrite qualityGate findings)
  ↁECanonical validates consistency of LLM qualityGate ↁEreadiness
  ↁE(only if Canonical OK) deterministic Gate evaluator runs and overwrites readiness/QG in report path
```

Therefore the **LLM draft Gate** can veto the pipeline at Canonical **before** the deterministic Gate becomes authoritative.

### 1.2 Proposed ownership

| Layer | Role |
| --- | --- |
| LLM | May emit a **draft** `qualityGate` because Schema v1.0 still contains the object (frozen; do not remove from Schema in v0.1.2). Draft is **non-authoritative**. |
| Deterministic Quality Gate v1.1 | **Sole authoritative final owner** of final `qualityGate.passed`, `criticalFailures`, `warnings`, `evaluatedAt`, and **enforced** `decisionReadiness`. |
| Audit | Preserve original LLM `qualityGate` inside `originalLlmDraft` (already retained by Control). Optionally mirror as `debug.llmDraftQualityGate`  Eoptional; not required if `originalLlmDraft` is always stored. |

### 1.3 Rules

1. After Decision Control, **discard LLM qualityGate as final state** (keep in audit only).  
2. Run Gate v1.1 on the **controlled** subject (+ finance activation F1∨F2∨F3).  
3. Write Gate results + enforced readiness into the assembled output.  
4. Only then run Canonical Schema v1.0  Evalidating the **assembled** system-consistent payload, not the LLM’s self-graded Gate.

This does **not** weaken Canonical: the READY↔criticals and passed↔criticals rules remain; the system simply stops asking Canonical to police an LLM-authored Gate that was never meant to be final.

---

## 2. Proposed final pipeline

```text
Raw Case + CDQ
  ↁELLM Semantic Draft
  ↁEPre-Control Structural Validation          (shape/types/enums only)
  ↁEDecision Control v0.1 (+ v0.1.1 finance annotate)
  ↁEDeterministic Quality Gate v1.1           (authoritative findings)
  ↁEEnforced Readiness                        (Gate-owned final readiness)
  ↁECanonical Output Assembly                 (write system-owned finals)
  ↁECanonical Schema v1.0 Validation          (unchanged contract)
  ↁEGolden Evaluation
```

### 2.1 Does this solve GC01 without weakening Canonical?

**Yes  Efor the observed GC01 failure mode  Ewithout changing Canonical rules.**

| Step | GC01 today | GC01 under v0.1.2 proposal |
| --- | --- | --- |
| Control | Sets READY; leaves LLM QG criticals | Same Control behavior OK |
| Gate | Never reached (Canonical abort) | Runs on controlled draft; classifies deferred missings as EXECUTION_CONDITION warnings under Gate v1.1; may keep READY or demote per Gate rules |
| Assembly | N/A | Writes Gate-owned `qualityGate` + enforced readiness into output |
| Canonical | Fails READY + LLM criticals | Validates **assembled** QG↔readiness; should pass if assembly is consistent |

Canonical Schema v1.0 text/contract stays frozen. No softening of finance / MR↔flag / READY↔criticals rules. The change is **pipeline order + ownership**, not Schema relaxation.

**Residual GC01 risks after this fix (not claimed solved):**

- Golden **D11** if `reviewCandidate.flag` remains true (Spec expects `no`)  Esee §5.  
- Semantic quality of recommendation / PD prose (unchanged).  
- If Gate itself Critical-fails for a real reason, Canonical + Golden will still fail  Ecorrectly.

### 2.2 Assembly contract (design)

Assembly must produce a single object where:

- `qualityGate` ≡ Gate evaluator output (codes, messages, evaluatedAt, passed).  
- `executive.decisionReadiness` ≡ `enforcedReadiness`.  
- Cross-field Canonical constraints hold by construction.  
- LLM draft QG remains only under `originalLlmDraft` / Control audit.

---

## 3. Field ownership matrix

**Rule:** exactly one **authoritative final owner** per final-state field. Others may suggest or stage.

| Field | LLM | Control | Gate | Human | **Final owner** | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Case Type** | suggests | may confirm/correct from CDQ decisionClass (R2) |  E| may confirm later | **Control-owned final** (when Control ON); else LLM | CDQ is human/envelope input |
| **tags** | suggests | additive merge from envelope/class (R1) |  E| may confirm | **hybrid:** LLM base + **Control additive final** | Control does not delete LLM tags in v0.1 |
| **Decision Authorities** | suggests | upsert minima by decision-class (R3) |  E| may edit | **hybrid:** LLM + **Control additive final** | Gaps = Control-policy incompleteness |
| **President requiredNow** | suggests | sets true when CDQ expects President (R4) |  E|  E| **Control-owned final** (boolean) | |
| **President Decision text** | **owns prose** | annotates NSF; does not rewrite (v0.1) |  E| may edit | **LLM-owned** until Semantic Refill v0.2 | Control owns *flag* NSF only |
| **Decision Readiness** | draft only | may stage (R5) as **proposal** | **enforces** | override UI later | **Gate-owned final** | Control staging must not outrank Gate |
| **qualityGate** | draft only (Schema-shaped) | must not author final findings | **evaluates** | override record optional | **Gate-owned final** | LLM draft ↁEaudit only |
| **Review Candidate** | suggests | policy promote (R6/R6b); demotion TBD §5 | may warn | confirms | **TBD by §5 approval**  Esee recommendation | Spec D11 cares about final flag |
| **Management Learning** (MR/KU/CA/…) | **owns booleans/prose** | R6b may set RC flag from MR; does not force KU/MR |  E| may confirm | **LLM-owned** (v0.1.2) | KU forcing out of scope |
| **finance extension** | may emit | F0 annotate; may coerce separation/doNotAuthorize (R7) | activates Criticals via F1∨F2∨F3 | supplies envelope snapshot | **hybrid:** envelope/CDQ own *activation*; LLM owns *figures content* unless contradicted; **Gate owns Critical outcomes** | Do not delete cross-domain finance |

### 3.1 Ownership of readiness (clarified)

To avoid dual ownership:

1. Control **may** adjust readiness for CDQ staging (internal staging signal).  
2. Gate **always** recomputes enforced readiness from controlled content + findings.  
3. Assembly writes **only** Gate enforced readiness as final.  
4. Canonical validates that final pair.

Optional design choice (approval Q): expose Control staging readiness in audit only (`controlStagedReadiness`) so it cannot collide with Gate final.

---

## 4. GC04 D04 diagnosis (no patch)

### 4.1 Spec expected role labels (Golden Spec v1.0)

1. **Ship Fund data**  
2. **Company cash-position**  
3. **Final CTM funding**

Eval D04 match: `authBlob` must include first **12 characters** of each label (case-insensitive).

### 4.2 Controlled authorities (09:05Z run)

| roleLabel | authority | Spec match |
| --- | --- | --- |
| President/DP | President/DP |  E|
| Company cash-position | Finance/Accounting | ✁E`company cash` |
| Final CTM funding | President/DP | ✁E`final ctm fu` |

**Missing domain:** **Ship Fund data** (`ship fund d` absent from authBlob).

### 4.3 Control policy today

`finance_funding_amount` R3 upserts only:

- Finance/Accounting · `Company cash-position`  
- President/DP · `Final CTM funding` (if expected)

No upsert for vessel-side / Ship Fund data authority (e.g. Master / Ops / Superintendent as data owner).

### 4.4 Classification

| Verdict | Fit |
| --- | --- |
| **Primary** | **Control-policy gap**  Eincomplete RACI minima for funding-amount decisions (missing Ship Fund / vessel-figure data domain). |
| **Secondary** | **Evaluator semantic-equivalence limitation**  Ebrittle 12-char Spec string match; a correctly owned domain with different wording could still fail D04. |
| **Combined label** | **both** (primary Control gap; secondary eval brittleness) |

**Do not patch in this proposal.** Future fix direction (later approval): generalized finance decision-class authority domain for ship-fund/data  Enot GC04-hardcoded strings. Optional later Eval domain matching is Golden Eval Rules change (out of scope unless separately approved).

---

## 5. Review Candidate false-positive policy

### 5.1 Observations

| Case | Spec | Final flag (controlled) | Source |
| --- | --- | --- | --- |
| **GC04** | `no` | **true** | LLM (“liquidity concerns E; Control did not demote ↁEGolden **D11 fail** |
| **GC01** | `no` | **true** | LLM; once Canonical/Gate ownership fixed, likely **D11 fail** next |
| **GC03** | `yes` | true | Appropriate; R6 would promote if LLM false |

Control today: **promote-only** (R6 / R6b false→true). Never true→false.

### 5.2 Options

| Option | Behavior | Pros | Cons |
| --- | --- | --- | --- |
| **A** | LLM suggestion + Control **promote-only** (false→true) | Preserves novel LLM concerns; low risk of suppressing real issues | Cannot clear false positives (GC01/GC04 D11); Spec `no` cases remain Fail |
| **B** | LLM suggestion + Control **owns final flag both directions** | One owner; can clear unsupported flags; Golden Spec-aligned when policy correct | Risk of suppressing legitimate novel issues if demotion policy is too aggressive |

### 5.3 Recommendation (generalized  Enot GC04-specific)

**Recommend Option B with guarded demotion + mandatory audit retention (B-guarded).**

Final owner: **Control policy** for `reviewCandidate.flag` (and related retain/monitor fields as policy dictates).

| Rule | Behavior |
| --- | --- |
| Promote | When retention policy fires (existing R6 spirit: high-risk inspection/ISM + external/system-CAPA signals) **or** Canonical-coherence R6b (MR=true ∧ not monitorOnly) |
| Demote | When **no** promotion criteria fire **and** LLM flag is true ↁEset flag false (or monitorOnly=true if policy prefers soft retention) |
| Audit | Always keep LLM original flag/reason in `originalLlmDraft`; emit finding e.g. `REVIEW_CANDIDATE_DEMOTED` with LLM reason text |
| Novel-issue safety | Demotion never deletes the LLM reason from audit; humans/Golden Lab can inspect findings; optional Gate **warning** (not Critical) when demoting |

**Reject pure A** as the long-term final-owner story if Spec expects authoritative NO without Prompt edits.  
**Reject unguarded B** (silent demote without audit/finding).

**v0.1.2 scope suggestion:** decide ownership principle now; implement B-guarded in a later Control patch only after approval (may be v0.1.2a). Quality Gate ownership (§1 E) can land without RC demotion, accepting residual D11 until RC policy ships.

---

## 6. GC03 D05 (no Control change)

### 6.1 Observation (09:05Z)

President Decision text was meta (“must decide whether to allow closure… E and lacked Spec intent keywords (`not`, `closed`, `root-cause`, `horizontal`, `effectiveness`) ↁEGolden **D05 fail**.

`requiredNow` was already true; **NSF was false** (no R4 text conflict). Control correctly did not invent prose.

### 6.2 Classification

**Model semantic variance** (LLM prose quality), not a Control-policy gap for v0.1.2.

### 6.3 Relation to Semantic Refill v0.2

This **strengthens** the later case for **bounded Semantic Refill v0.2**:

- Control can force structure (`requiredNow`, authorities, readiness staging) but **cannot** supply decision-intent prose without an explicit refill step.  
- GC02 already shows NSF when text contradicts requiredNow.  
- GC03 D05 shows that even when requiredNow is consistent, **intent-bearing PD text** may still be missing.  

Bounded refill should remain **opt-in, audited, non-silent**, and only fill when structural flags demand intent-bearing text  Enot a general rewrite engine. **No Control change for D05 now.**

---

## 7. What v0.1.2 should / should not claim

| Claim | Status |
| --- | --- |
| Solves GC01 Canonical abort caused by LLM-owned QG | **Yes** (via Gate-owned final + reorder) |
| Weakens Canonical Schema | **No** |
| Clears GC04 D04 | **No** (Control-policy gap; defer) |
| Clears GC04/GC01 D11 | **Only if** B-guarded RC policy approved & implemented |
| Clears GC03 D05 / GC02 D05+D10b | **No** (semantic / refill / KU policy later) |
| Changes Prompt / Spec / Eval / Gate rules text | **No** |

---

## 8. Regression / risk notes

| Risk | Mitigation |
| --- | --- |
| Assembly forgets a Gate field ↁECanonical fail | Single `assembleCanonicalOutput(controlled, gateEval)` helper + tests |
| Control staged READY then Gate demotes  Econfusion | Document Gate as final; expose Control staging in audit only |
| Demoting RC hides real issues | B-guarded: finding + originalLlmDraft retention |
| Finance F0 regression | Keep v0.1.1 activation; Gate still sole Critical emitter |
| Double Gate evaluation | Evaluate once post-Control; assembly copies results |

---

## 9. Approval questions

1. **Approve Quality Gate as system-owned final**, with LLM draft retained only in `originalLlmDraft` / audit?  
2. **Approve pipeline reorder:** Control ↁEGate ↁEEnforced Readiness ↁEAssembly ↁE**Canonical** ↁEGolden (Canonical Schema contract unchanged)?  
3. **Approve ownership matrix §3**, especially: readiness & qualityGate = Gate-final; President text = LLM until refill; authorities/tags = hybrid additive Control?  
4. **Accept GC04 D04 as Control-policy gap (+ secondary eval brittleness)**  Efix later via generalized Ship Fund / data authority domain, not Spec/Eval string patches now?  
5. **Review Candidate:** approve **B-guarded** (Control owns final flag both ways + demotion audit finding), or stay **A** (promote-only) for v0.1.2 and accept residual D11?  
6. **Accept GC03 D05 as model variance** supporting later Semantic Refill v0.2  E**no Control change now**?  
7. **Proceed to implement** only §1 E (Gate ownership + pipeline reorder + assembly) first, deferring RC demotion and finance RACI D04 to follow-on approvals?

---

## 10. Summary verdict

| Topic | Verdict |
| --- | --- |
| Deeper issue | Final-state field ownership, especially `qualityGate` |
| GC01 fix path | Gate-owned finals + Canonical after assembly  E**no Schema weaken** |
| GC04 D04 | Missing **Ship Fund data** authority domain  E**both** (Control gap primary) |
| Review Candidate | Prefer **B-guarded**; A cannot clear Spec `no` false positives |
| GC03 D05 | Model variance ↁEstrengthens Semantic Refill v0.2 case |
| Next | Approval only  E**do not implement / do not rerun** until answered |
