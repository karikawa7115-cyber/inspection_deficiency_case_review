# Decision Policy v0.2  EDesign Proposal Only

**Status:** DESIGN PROPOSAL  Enot implemented.  
**Date:** 2026-08-23  
**Prerequisite architecture (accepted, do not modify):** Decision Pipeline v0.1.2  
**Evidence:** v0.1.2 live rerun (`tmp/mdd-llm-golden-run-2026-08-23T10-18-25-728Z.json`)  EGC01 **Pass**; residual Golden Fail on GC02 (D05/D10b), GC03 (D04), GC04 (D04/D11).

**Does not modify / does not implement in this document:**  
System Prompt v1.0 · Canonical Schema v1.0 · Golden Spec / Eval Rules · Quality Gate Rules v1.1 · Pipeline v0.1.2 · Semantic Refill · live LLM runs.

**Scope of this proposal:** Deterministic **Decision Policy** (Control-layer policy) for:

1. **Authority Domain Policy** (addresses residual D04 class of failures)  
2. **Review Candidate B-guarded Policy** (addresses residual D11 / MR→RC mechanical promotion)  
3. Canonical consistency when MR suggestion ≠ final Review flag  
4. Later evaluator domain-equivalence recommendation (Eval not edited now)

**Explicitly out of scope:** GC02 D05 / `NEEDS_SEMANTIC_FILL` · GC02 D10b Knowledge Update · Semantic Refill (future v0.3 candidate for D05).

---

## 0. Positioning relative to v0.1.2

| Layer | Owner of final state (v0.1.2) | v0.2 adds |
| --- | --- | --- |
| `qualityGate` / readiness | Gate | unchanged |
| Authorities (additive minima) | Control hybrid | **domain-complete minima** (generalized) |
| `reviewCandidate.flag` | LLM + promote-only / R6b | **B-guarded Control final** (both directions) |
| `learning.managementReviewCandidate` | LLM | remains LLM suggestion; not silently deleted |
| President prose / KU | LLM | unchanged (refill / learning later) |

v0.2 is **policy completeness** on top of an accepted ownership pipeline  Enot another pipeline reorder.

---

## A. Authority Domain Policy

### A.1 Problem class (from live residuals)

| Case | Present after Control | Spec / Eval still needs | Gap |
| --- | --- | --- | --- |
| **GC03-class** | Master ops · Tech verify · Flag · President closure | **Root cause** domain (`root cause` substring) | SMS / RC / CAPA follow-up authority missing |
| **GC04-class** | Company cash-position · Final CTM funding | **Ship Fund data** domain (`ship fund d`) | Vessel-side fund/source-data authority missing |

Fix must be **decision-class / signal triggered**, never vessel- or Golden-ID keyed.

### A.2 Shared concepts

Introduce (design-level) **Authority Domains**  Estable product concepts independent of Spec wording:

| Domain ID | Intent |
| --- | --- |
| `OPS_EXECUTION` | Onboard corrective / operational execution |
| `TECH_VERIFY` | Technical verification / superintendent judgment |
| `EXTERNAL_FLAG` | Flag / ASI / external inspection follow-up |
| `CLOSURE_ACCEPTANCE` | Company / President final acceptance of closure |
| `RC_SMS_FOLLOWUP` | Root-cause / SMS / CAPA / horizontal / effectiveness system follow-up |
| `SHIP_FUND_SOURCE` | Vessel-reported cash/fund / CTM carry-forward / pending vessel expenses evidence |
| `COMPANY_LIQUIDITY` | Company cash-position / remittance feasibility |
| `FUNDING_APPROVAL` | Final funding / CTM amount decision |

Control upserts **concrete** `{ authority kind, roleLabel }` mapped from domain + available envelope cues. Golden Spec strings remain human acceptance truth; Control must populate domains that Spec/Eval can still match **today** via label inclusion, without hardcoding GC IDs.

**Role selection order (generalized):**

1. Prefer an existing LLM authority that already covers the domain (semantic/kind match).  
2. Else upsert default mapping for the domain (below).  
3. If mapping ambiguous ↁEemit finding `AUTHORITY_DOMAIN_UNRESOLVED`; do **not** invent a person name; may leave gap (Gate/Golden may still Fail).

---

### A.3 Rule AD-INSPECT-RC  ERoot Cause / SMS follow-up domain

**Purpose:** Inspection/ISM decisions that depend on RC/CAPA/system learning must name who owns that follow-up, separate from Master execution and Tech verification.

#### Triggering inputs (any of)

| Signal | Source |
| --- | --- |
| `decisionClass === inspection_non_closure` | CDQ |
| `primaryCaseType ∁E{INSPECTION_COMPLIANCE, ISM_MANAGEMENT}` | Controlled type |
| Tags / missing / learning indicate RC–CAPA stack | `root_cause*`, `horizontal*`, `effectiveness*`, `correctiveAction`, `preventiveAction`, `effectivenessVerification`, `horizontalCheck` |
| CDQ `decisionRequiredNow` / deferred list mentions root cause, CAPA, horizontal check, effectiveness, SMS | CDQ text |

**Not triggered by:** mere presence of Flag authority alone without RC/CAPA/system signals (Flag remains EXTERNAL_FLAG domain).

#### Required domain

`RC_SMS_FOLLOWUP` must be present in the final authority set when the trigger fires.

#### Concrete role selection (default map)

| Preference | `authority` kind | Example `roleLabel` (illustrative, not Golden-keyed) |
| --- | --- | --- |
| 1 | `Other` or Company/DP-capable label already present | Reuse if role text covers root-cause/SMS/audit follow-up |
| 2 (upsert) | `President/DP` **or** dedicated Company SMS owner if envelope later provides one | e.g. `Root cause / SMS / CAPA follow-up` |
| 3 | Do not assign Master or Superintendent alone as RC owner (they already cover OPS_EXECUTION / TECH_VERIFY) |

**Rationale:** Root-cause / SMS corrective-system ownership is a **Company management system** duty, not identical to onboard execution or technical verification. Defaulting to President/DP / DP-office is generalized ISM practice for Phase 1; later envelopes may supply a named DPA/SMS role without changing the domain rule.

#### Control may upsert?

**Yes**  Eadditive upsert when domain absent (same spirit as current R3).

#### Audit

- `ruleId`: e.g. `AD-INSPECT-RC`  
- Record: trigger signals matched, domain required, whether reused vs upserted, final `{authority, roleLabel}`  
- Finding optional: `AUTHORITY_DOMAIN_ADDED`

#### If no valid role can be resolved

- Emit `AUTHORITY_DOMAIN_UNRESOLVED` with `relatedFieldPaths: ["executive.decisionAuthorities"]`  
- Do not block Control completion  
- Leave domain missing ↁEGate/Golden may Fail (honest)

---

### A.4 Rule AD-FINANCE-SHIPFUND  EShip Fund / vessel cash evidence domain

**Purpose:** Funding-amount decisions that depend on vessel-side figures must separate **source-data ownership** from **company liquidity** and **final funding approval**.

#### Triggering inputs (any of)

| Signal | Source |
| --- | --- |
| `decisionClass === finance_funding_amount` | CDQ |
| `primaryCaseType === FINANCE_COMMERCIAL` **and** material vessel-side finance inputs | Type + envelope |
| Envelope / `financeSourceInput` / LLM finance sourceFacts contain ship fund, carry-forward, pending vessel expenses, adjusted ship-fund balance, vesselRequiredApprox | Envelope / draft |
| CDQ text concerns CTM amount, ship fund, remittance from vessel position | CDQ |

**Not triggered by:** pure company-liquidity confirmation with no vessel-side figures (then COMPANY_LIQUIDITY + FUNDING_APPROVAL may suffice).

#### Required domain

`SHIP_FUND_SOURCE` must be present when the trigger fires, **in addition to**:

- `COMPANY_LIQUIDITY` (existing Finance/Accounting · cash-position)  
- `FUNDING_APPROVAL` (existing President · final CTM funding) when President is expected decider  

#### Concrete role selection (default map)

| Preference | `authority` kind | Example `roleLabel` |
| --- | --- | --- |
| 1 | Reuse LLM authority covering ship fund / vessel cash / Master cash report | keep |
| 2 (upsert) | `Master` | e.g. `Ship Fund data / vessel cash evidence` |
| 3 (alt) | `Other` with vessel-ops label if Master inappropriate for case type | rare |

**Rationale:** Ship-reported balances and pending vessel expenses are **vessel evidence**, distinct from shore Finance liquidity and President funding approval.

#### Control may upsert?

**Yes**  Eadditive.

#### Audit

- `ruleId`: e.g. `AD-FINANCE-SHIPFUND`  
- Triggers, reuse vs upsert, final authority pair  

#### If unresolved

- `AUTHORITY_DOMAIN_UNRESOLVED` · no invented personal names · domain may remain missing  

---

### A.5 Interaction with existing R3

| Existing R3 | v0.2 |
| --- | --- |
| Crew / Technical / Inspection / Finance minima | Keep |
| Inspection: Master, Superintendent, Flag?, President? | **Add** AD-INSPECT-RC when RC/CAPA/system triggers |
| Finance: Finance cash-position, President funding | **Add** AD-FINANCE-SHIPFUND when vessel-side fund triggers |

No Golden ID branches. Role labels should be stable domain phrases so today’s Eval 12-char inclusion can pass Spec labels like “Root cause… E/ “Ship Fund data… E**without** Eval change  Ebut that coupling is transitional (see A.6).

### A.6 Evaluator domain-equivalence (recommendation only  Edo not edit Eval now)

**Today:** D04 requires `authBlob` to include `expectedAuthorityRoleLabels[i].slice(0,12)`.

**Assessment:**

| Approach | Fit |
| --- | --- |
| Keep substring Eval + Control emits Spec-compatible labels | Works short-term; couples Control labels to Spec prose |
| **Later:** Eval matches **domains** (or authority-kind + domain tags) | Correct long-term; Spec can list domains; Control and Eval share domain vocabulary |

**Recommendation:**  

1. Implement Authority Domain Policy in Control first (v0.2).  
2. Schedule **Golden Eval Rules v1.1** (separate approval) to score D04 by domain coverage / equivalence, not brittle substrings.  
3. Until then, default upsert labels should be chosen to satisfy both **domain intent** and **current Spec inclusion** without GC-specific forks.

**Do not edit Eval in v0.2 implementation wave unless separately approved.**

---

## B. Review Candidate B-guarded Policy

### B.1 Approved target model (from v0.1.2 Q5)

| Item | Rule |
| --- | --- |
| LLM | May suggest `reviewCandidate` and `learning.managementReviewCandidate` |
| Control | **Owns final** `reviewCandidate.flag` in **both** directions |
| Criteria | Generalized only  Enever Golden/vessel suppression |
| Audit | Every promote/demote recorded; original LLM suggestion retained in `originalLlmDraft` |

### B.2 Established retention criteria (policy vocabulary)

Final Review Candidate **should be true** when **one or more** fire (generalized detectors; refine in impl with tests):

| Criterion | Typical signals |
| --- | --- |
| **Repeat** | Repeat deficiency / recurrence language; prior similar CAPA ineffective |
| **High Risk** | Safety / compliance / Flag / ISM high-consequence case class |
| **System Weakness** | Tags/assumptions/hypothesis of system weakness; SMS chain gaps |
| **Fleet-wide relevance** | `fleetWideRelevance ∁E{yes, possible}` |
| **Ineffective Corrective Action** | Learning/CA flags + evidence of ineffective prior CA |
| **Knowledge Gap** | Explicit knowledge-update / procedure-gap need tied to retention (not alone KU boolean) |
| **Reporting Failure** | Recordkeeping / document_control / reporting failure signals |
| **External Signal** | Flag / ASI / Class / external authority involvement on retention-worthy case |

**Promote** when criteria fire and flag is false.  
**Demote** when criteria **do not** fire and flag is true (including after discarding unsupported MR  E§B.3).  
**monitorOnly** may remain a soft path later; v0.2 design default: demote to `flag=false` unless a separate MONITOR policy is approved.

### B.3 GC04 failure mode  Eunsupported MR must not force Review=true

**Observed (v0.1.2 live GC04):**

- Raw `reviewCandidate.flag = false`  
- LLM `managementReviewCandidate = true`  
- Current **R6b** promoted Review to true solely for Canonical MR↔flag coherence  
- Spec expects Review **no** ↁEGolden **D11**

**Problem:** R6b treats LLM MR as **authoritative** for Review. Under ownership matrix, MR is **LLM-owned suggestion**; Review flag is **Control-owned final**. Mechanical promotion inverts that.

#### Proposed rule RC-MR-INDEPENDENT

1. **Compute** `reviewPolicyFires` from §B.2 criteria **only** (not from LLM MR boolean alone).  
2. **Set final** `reviewCandidate.flag = reviewPolicyFires` (B-guarded both ways).  
3. **Do not** promote Review solely because `managementReviewCandidate === true`.  
4. If LLM MR=true but policy false ↁEemit finding `UNSUPPORTED_MR_SUGGESTION` (or `MR_SUGGESTION_WITHOUT_RETENTION_CRITERIA`); leave learning MR boolean intact.  
5. **Remove / replace R6b** “MR forces flag Ewith Canonical-consistency strategy in §C (not silent MR wipe).

For GC04-class finance/liquidity cases: liquidity uncertainty alone is **Gate/execution-condition** territory, not automatic Management Review retention  Eunless High Risk / System Weakness / External Signal / etc. also fire.

### B.4 Audit requirements (every transition)

| Event | Audit fields |
| --- | --- |
| false→true | criteria matched; prior LLM flag; new reason |
| true→false | criteria absent; prior LLM flag/reason preserved in `originalLlmDraft`; finding `REVIEW_CANDIDATE_DEMOTED` |
| no-op | optional debug only |

### B.5 Interaction with Pipeline v0.1.2

Control still runs **before** Gate and Assembly. Final Review flag is Control-owned entering Gate. Gate does not redefine Review flag (unless a future Gate rule is approved  Enot proposed here).

---

## C. Canonical consistency: MR suggestion vs final Review flag

Canonical Schema v1.0 (frozen) currently requires approximately:

> if `managementReviewCandidate === true` and not `monitorOnly`, then `reviewCandidate.flag` should be true.

Under B-guarded policy, **valid product states** include:

| LLM MR | Final Review flag | Allowed? |
| --- | --- | --- |
| true | true | Yes  Epolicy also fired |
| false | true | Yes  EControl promoted |
| false | false | Yes |
| **true** | **false** | **Yes under B-guarded**  Eunsupported MR suggestion |

### C.1 Strategy (without weakening Schema contract text as a “rule deletion E

Canonical Schema remains frozen. Consistency is achieved by **Canonical Output Assembly / Control output shaping** that preserves auditability:

**Recommended approach: Split suggestion vs final on assembly-adjacent Control output**

| Field | Behavior |
| --- | --- |
| `learning.managementReviewCandidate` | Keep LLM value (suggestion) |
| `reviewCandidate.flag` | Control final from §B |
| When MR=true ∧ flag=false | Set `reviewCandidate.monitorOnly = true` **only if** that satisfies Canonical’s MONITOR exception **and** product accepts MONITOR as “not full Review Candidate E **OR** |

**Preferred cleaner approach (design choice for approval):**

**C-Option 1  EMONITOR bridge (Schema-compatible, no Schema edit)**  
When policy demotes Review but LLM MR=true:

- `reviewCandidate.flag = false`  
- `reviewCandidate.monitorOnly = true`  
- `reviewCandidate.reason` = audited demotion reason  
- Finding: `UNSUPPORTED_MR_SUGGESTION`  
- Canonical’s existing MONITOR exception keeps Schema green  
- Golden D11 for Spec `no`: treat MONITOR as acceptable **only if** Spec says `no_or_monitor`; for Spec `no`, Eval still fails D11 today  E**note residual** unless Spec/Eval later clarifies MONITOR vs NO  

**C-Option 2  ELearning suggestion mirror (preferred long-term, may need Schema v1.1 later)**  
Keep final `managementReviewCandidate` aligned to policy for Canonical, and store LLM MR under:

- `debug.llmManagementReviewCandidate` and/or always `originalLlmDraft.learning.managementReviewCandidate`

Without Schema v1.1, flipping final MR to false **does** change the LLM-owned learning field on the assembled output  Econflicts with “Management Learning = LLM-owned Eunless we define:

- **Assembled learning MR** = “effective / policy-acknowledged MR E 
- **Original LLM MR** = audit-only  

That is a deliberate ownership nuance: **LLM owns the suggestion record; assembled learning MR becomes policy-filtered.** Requires explicit approval because it slightly reframes “LLM-owned learning. E

**C-Option 3  ESchema v1.1 (out of band)**  
Relax Canonical so MR suggestion need not imply Review flag. Cleanest semantics; **not** in v0.2 if Schema freeze holds.

### C.2 Recommendation for v0.2

| Priority | Choice |
| --- | --- |
| **Primary recommendation** | **C-Option 2 with explicit ownership clarification:** assembled `learning.managementReviewCandidate` may be forced `false` when Review policy does not fire; LLM original retained in `originalLlmDraft`; finding `UNSUPPORTED_MR_SUGGESTION`. Review flag follows policy only. Canonical stays green. |
| **Fallback if refusing to touch assembled MR** | **C-Option 1 MONITOR bridge**  ESchema-safe; may leave Spec=`no` D11 residual until Eval/Spec clarify MONITOR. |
| **Not now** | Schema edit (Option 3) |

**Never:** silently delete LLM MR from `originalLlmDraft`.

---

## D. Semantic work (out of scope reminder)

| Residual | Classification | Next |
| --- | --- | --- |
| GC02 D05 + NSF | Model prose vs requiredNow | Bounded Semantic Refill **v0.3** candidate |
| GC02 D10b | LLM did not set Knowledge Update | Prompt / learning policy later  Enot Control force in v0.2 |
| GC03 D05 (intermittent) | Model variance | Refill v0.3, not Authority/RC policy |

---

## E. Regression / over-determinism risks

| Risk | Mitigation |
| --- | --- |
| Over-upsert authorities on mild cases | Strict triggers; prefer reuse before upsert; findings when unresolved |
| Role labels too Spec-coupled | Domain IDs stable; labels documented as transitional for Eval v1.0 |
| RC demotion hides real novel issues | Mandatory `REVIEW_CANDIDATE_DEMOTED` + original draft; human review of findings |
| Finance cases always get Ship Fund authority | Trigger only when vessel-side fund inputs exist |
| Inspection always gets RC domain | Trigger on RC/CAPA/system signals, not Flag alone |
| MONITOR bridge confuses Golden Spec `no` | Prefer Option 2; document D11 residual if Option 1 chosen |
| Double ownership of learning MR | Approve Option 2 ownership nuance explicitly |
| Idempotency | Domain upserts use stable IDs; second Control pass no growth |

---

## F. Proposed deliverable map (when implementing later)

| Artifact | Content |
| --- | --- |
| Control policy module | AD-INSPECT-RC, AD-FINANCE-SHIPFUND, RC B-guarded, MR handling |
| Deterministic tests | Domain present/absent; GC03/GC04-shaped fixtures without Golden IDs in rule code; MR=true/flag demote; audit findings |
| Docs | Policy ADR / this proposal ↁEimplementation report |
| Eval | Separate proposal for domain-equivalence D04 |

---

## G. Approval questions (with recommended answers)

**How to read:** Each item states the question, the **recommended answer**, and brief rationale. Preliminary positions from review are noted where they already align.

---

### G1. AD-INSPECT-RC (Root Cause / SMS follow-up domain)

**Question:** Approve the generalized AD-INSPECT-RC rule (Inspection/ISM + RC/CAPA/horizontal/effectiveness triggers ↁErequire domain `RC_SMS_FOLLOWUP`; Control may upsert only after role resolution; unresolved ↁEauditable finding)?

**Recommended answer:** **APPROVE.**

**Rationale:** Matches the residual D04 gap without Golden/vessel keys. Aligns with preliminary position.

---

### G2. AD-FINANCE-SHIPFUND (Ship Fund / vessel cash evidence domain)

**Question:** Approve the generalized AD-FINANCE-SHIPFUND rule (funding decision + vessel-side fund/CTM/pending-expense inputs ↁErequire domain `SHIP_FUND_SOURCE`; same resolve/upsert/unresolved pattern)?

**Recommended answer:** **APPROVE.**

**Rationale:** Separates source-data ownership from company liquidity and final funding approval. Aligns with preliminary position.

---

### G3. Authority-role resolution order (explicit  Enot Golden label hard-coding)

**Question:** Approve that Control must **not** hard-code Company/DP or Master merely to satisfy Golden role-label substrings; instead resolve roles from authoritative Case Context, with fallback only when it is a stable organizational rule?

**Recommended answer:** **APPROVE**, with the exact resolver order below as normative for v0.2 implementation.

#### Shared resolver pipeline (both domains)

```text
1. Domain required by policy trigger
2. Scan existing controlled authorities for domain coverage
   (authority kind + roleLabel/notes semantics  Ereuse if already present)
3. Resolve responsible role from authoritative Case Context
   (CDQ expectedDecider / deferred parties, envelope org roles,
    financeSourceInput provenance, declared RACI if present)
4. If resolved ↁEupsert {authority kind, roleLabel} as status=pending
5. If unresolved ↁEemit AUTHORITY_DOMAIN_UNRESOLVED
   (do not invent a person; do not invent a Golden-Spec string)
6. Optional organizational fallback  Eonly if it is a documented
   stable org rule for that domain (see below), never a Golden-case assumption
```

#### Exact resolver order  E`RC_SMS_FOLLOWUP`

| Step | Action |
| --- | --- |
| 1 | Confirm AD-INSPECT-RC trigger fired ↁEdomain required |
| 2 | **Reuse** if an existing authority already covers root-cause / SMS / CAPA / audit follow-up / DPA-like duty |
| 3 | **Case Context resolve:** CDQ `expectedDecider` or deferred parties naming DPA / SMS / Company compliance / Internal Audit owner; envelope people/roles with those duties; any explicit RACI for “root cause E/ “SMS E|
| 4 | If resolved ↁEupsert as `pending` with domain-tagged reason in audit |
| 5 | If unresolved ↁE`AUTHORITY_DOMAIN_UNRESOLVED` for `RC_SMS_FOLLOWUP` |
| 6 | **Organizational fallback (optional, only if product adopts it as stable ISM rule):** Company Designated Person / DP office as SMS follow-up owner  E**not** “President/DP because Golden says Root cause. EIf this fallback is **not** adopted as an org-wide rule, skip step 6 and leave unresolved. |

**Recommendation on fallback:** Treat Company DP / SMS office as a **stable ISM organizational default** (optional product switch `ORG_DEFAULT_RC_SMS_OWNER=DP`), not a Golden assumption. If the switch is off, prefer unresolved finding over inventing Master/President labels for Eval.

#### Exact resolver order  E`SHIP_FUND_SOURCE`

| Step | Action |
| --- | --- |
| 1 | Confirm AD-FINANCE-SHIPFUND trigger fired ↁEdomain required |
| 2 | **Reuse** if an existing authority already covers ship fund / vessel cash / Master’s cash report / vessel-side fund evidence |
| 3 | **Case Context resolve:** who supplied or owns ship-fund figures in envelope / `financeSourceInput` notes / CDQ (e.g. Master, Chief Engineer, vessel accounts); declared vessel cash RACI |
| 4 | If resolved ↁEupsert as `pending` |
| 5 | If unresolved ↁE`AUTHORITY_DOMAIN_UNRESOLVED` for `SHIP_FUND_SOURCE` |
| 6 | **Organizational fallback (optional stable ops rule):** Master as default owner of ship-reported fund/cash evidence  E**only** if adopted as company ops standard (`ORG_DEFAULT_SHIP_FUND_OWNER=Master`), never because Spec says “Ship Fund data. EIf switch off ↁEleave unresolved. |

**Recommendation on fallback:** Prefer Case Context; enable Master fallback only as an explicit org default. **Do not** pick Master solely to match Golden’s 12-character substring.

---

### G4. Eval D04 domain-equivalence

**Question:** Defer moving Golden Eval D04 from role-label substring matching to domain-equivalence matching until a separate Golden Eval Rules revision?

**Recommended answer:** **DEFER** (as proposed).

**Rationale:** Aligns with preliminary position. Control domains land first; Eval coupling is transitional and must not block policy correctness. Unresolved-authority findings remain honest when Context cannot resolve a role.

---

### G5. Review Candidate B-guarded + remove R6b MR→flag force

**Question:** Approve B-guarded Review Candidate (Control owns final `reviewCandidate.flag` both directions from generalized retention criteria) and **remove** the current R6b assumption that `managementReviewCandidate=true` automatically forces `reviewCandidate.flag=true`?

**Recommended answer:** **APPROVE** both.

**Rationale:** Aligns with preliminary position. LLM MR is suggestion; Review flag is policy. GC04 live failure was exactly R6b mechanical promotion.

---

### G6. Management Review ownership under Option 2 (hybrid  Eexplicit)

**Question:** Approve Option 2 with the hybrid ownership model below for `managementReviewCandidate`, including audit requirements for every true↔false change on assembled finals?

**Recommended answer:** **APPROVE Option 2 with hybrid ownership as stated here** (not silent suppression for Canonical).

#### Final ownership definition

| Layer | Role for Management Review |
| --- | --- |
| **LLM** | **Suggestion only**  Eemits `learning.managementReviewCandidate` on the semantic draft |
| **Control / Review Policy** | **Authoritative final** for the **assembled** `learning.managementReviewCandidate` when policy filters effective MR acknowledgment for Canonical consistency |
| **Human** | **Final acceptance / escalation**  Econfirms or overrides Review / MR outcomes outside the automated pipeline |

#### Preservation rule (non-negotiable)

- The LLM’s original `managementReviewCandidate` (and related reason/context) **must remain preserved** in `originalLlmDraft` (and Control audit payloads).
- **Do not** silently suppress an LLM Management Review suggestion merely to satisfy Canonical Schema.
- Any divergence between suggestion and assembled final must be **visible** via findings + audit.

#### Assembled vs original

| Field location | Meaning |
| --- | --- |
| `originalLlmDraft.learning.managementReviewCandidate` | Immutable semantic suggestion (audit/debug) |
| Assembled `learning.managementReviewCandidate` | Policy-effective final for machine contract / Canonical |
| `reviewCandidate.flag` | Independently Control-owned from retention criteria (§B), **not** forced by LLM MR |

#### Audit requirements for every true→false or false→true change (assembled MR and/or Review flag)

Each change must record at least:

| Audit field | Content |
| --- | --- |
| `originalSuggestion` | LLM value before policy |
| `finalValue` | Assembled value after policy |
| `policyCriteriaEvaluated` | Which retention / MR-support criteria were tested and their boolean results |
| `ruleId` | e.g. `RC-B-GUARDED`, `RC-MR-FILTER`, `AD-…` as applicable |
| `reason` | Human-readable why promote/demote/filter |

Findings such as `UNSUPPORTED_MR_SUGGESTION`, `REVIEW_CANDIDATE_DEMOTED`, `MR_EFFECTIVE_FILTERED` remain in Control findings for Lab/human review.

#### Canonical consistency under this model

- Assembled MR and assembled Review flag are co-produced so Canonical Schema v1.0 remains satisfied **by construction**.
- Satisfaction must come from **documented policy filtering + audit**, never from deleting the suggestion from `originalLlmDraft`.

**Reject:** C-Option 1 as primary if Option 2 is approved (MONITOR bridge remains emergency fallback only).  
**Reject for v0.2:** Schema v1.1 (Option 3) unless separately unfrozen.

---

### G7. Semantic Refill / GC02 D05 and D10b

**Question:** Continue to defer GC02 D05 / `NEEDS_SEMANTIC_FILL` and GC02 D10b (and intermittent GC03 D05) outside Decision Policy v0.2?

**Recommended answer:** **DEFER** (as preliminary position).

**Rationale:** D05 ↁEbounded Semantic Refill v0.3 candidate; D10b ↁEseparate LLM semantic-learning / later policy  Enot Authority Domain or RC B-guarded.

---

### G8. Implementation gate

**Question:** Proceed to implement Decision Policy v0.2 only after G1–G7 are confirmed, without changing Pipeline v0.1.2, Prompt, Schema, Golden Spec/Eval, or running a live LLM until a separate rerun approval?

**Recommended answer:** **YES  Eimplement only after explicit confirmation of G1–G7**, especially G3 (resolver order / no Golden hard-coding) and G6 (hybrid MR ownership + audit).

---

### G  ECompact recommendation board

| ID | Topic | Recommended answer |
| --- | --- | --- |
| G1 | AD-INSPECT-RC | **APPROVE** |
| G2 | AD-FINANCE-SHIPFUND | **APPROVE** |
| G3 | Role resolution via Case Context (+ optional org fallback switches) | **APPROVE** |
| G4 | Eval D04 domain-equivalence | **DEFER** |
| G5 | RC B-guarded + remove R6b MR→flag | **APPROVE** |
| G6 | Option 2 hybrid MR ownership + full audit | **APPROVE** |
| G7 | Semantic / D05 / D10b | **DEFER** |
| G8 | Implement when G1–G7 confirmed; no live rerun yet | **YES** |

---

## H. Summary verdict

| Topic | Verdict |
| --- | --- |
| D04 class | Control **Authority Domain** gaps  Efix with generalized AD rules, not Golden strings |
| GC03-shaped gap | Missing **RC_SMS_FOLLOWUP** domain |
| GC04-shaped gap | Missing **SHIP_FUND_SOURCE** domain |
| D11 / GC04 | R6b MR→Review is wrong ownership; B-guarded + RC-MR-INDEPENDENT |
| Canonical | Prefer Option 2 (assembled MR filtered; LLM MR audited); MONITOR bridge as fallback |
| Eval | Recommend later domain-equivalence; do not edit now |
| Semantic residuals | Refill v0.3 / learning  Eout of scope |

**Stop.** Design proposal and approval questions only  Eno implementation, no live rerun.
