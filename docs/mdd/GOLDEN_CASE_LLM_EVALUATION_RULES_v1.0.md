# MDD Golden Case LLM Evaluation Rules v1.0

**Status:** **Frozen** — human-readable SSoT (clarifications of 23 Aug 2026 incorporated).  
**Machine implementation:** `lib/mdd/golden/llm-eval-v1.ts`  
**Purpose:** Evaluate whether an LLM-generated `MddStructuredOutput` (Schema v1.0) preserves the human-approved decision structure in Golden Case Specification v1.0.

**Depends on (frozen):**

- `docs/mdd/GOLDEN_CASE_SPECIFICATION_v1.0.md` — acceptance truth (AI must not redefine)
- `docs/mdd/SYSTEM_PROMPT_v1.0.md`
- `docs/mdd/STRUCTURED_OUTPUT_SCHEMA_v1.0.md`
- `docs/mdd/QUALITY_GATE_RULES_v1.0.md`

**Out of scope:** Production LLM connection; numerical “confidence” for Decision Readiness; rewriting Golden Spec expected results.

**Core principle:**  
Evaluation is **structural and semantic equivalence**, not exact wording.  
**Polished prose must never hide a structurally wrong decision.**

**Versioning:** Changes require `v1.1+` and human approval.

---

## 1. Evaluation taxonomy

### 1.1 What is evaluated

| Input | Role |
| --- | --- |
| Golden Case Spec fixture (`GC01`–`GC04`) | Human-approved expected structure / intent / NG patterns |
| LLM (or heuristic) `MddStructuredOutput` | Candidate Decision Brief payload |
| Quality Gate result (Rules v1.0) | Independent readiness/integrity check; interacts per §7 |

Case envelope fields (Case Status, human confirmation booleans) are **out of band** except where Spec explicitly requires `reviewCandidate` flag semantics (mapped from `reviewCandidate.flag` in structured output).

### 1.2 Evaluation dimensions (required)

Each run produces one result per dimension:

| ID | Dimension | Primary evidence in Schema v1.0 |
| --- | --- | --- |
| `D01` | Primary Case Type | `primaryCaseType` |
| `D02` | Fact separation | `facts.confirmed` / `unverified` / `assumptions` / `missingInformation` |
| `D03` | Missing Information quality | Each missing item: Who / What / Evidence |
| `D04` | Decision Authorities | `executive.decisionAuthorities[]` (multi role→authority) |
| `D05` | President Decision | `executive.presidentDecision` (+ `requiredNow`) |
| `D06` | Recommendation boundary | `executive.recommendation` (+ options / forbidden intents) |
| `D07` | Decision Readiness | `executive.decisionReadiness` (enum only; **no confidence score**) |
| `D08` | Delegation | `executive.nextActions[]` (Who / What / due-or-trigger) |
| `D09` | Professional Boundary | `professionalBoundaries[]` + prose that must not violate Spec |
| `D10` | Management Learning | `learning.*` (+ optional `inspectionIsm`) |
| `D11` | Review Candidate | `reviewCandidate` record/flag (not Case Status) |
| `D12` | Executive brevity / 30-second usability | Length/clarity of Recommendation + President Decision + Why (+ Authorities/Next Actions scannability) |

Optional supporting checks (do not redefine Spec):

| ID | Check | Notes |
| --- | --- | --- |
| `D00` | Schema validity | Must parse as Schema v1.0 before semantic eval |
| `T01` | Required tags | Fail only if Spec **required** tags missing |
| `T02` | Optional tags | Never fail solely for absence of acceptable extras |
| `N01` | NG pattern avoidance | Spec `ngPatterns` / forbidden intents → Critical or Fail |

### 1.3 Result severities (per dimension)

| Severity | Meaning | Effect on overall case result |
| --- | --- | --- |
| **Pass** | Structure and semantic intent preserved | Contributes to overall Pass |
| **Warning** | Imperfect but not structurally wrong (verbosity, soft monitor, optional gaps) | Overall may still Pass |
| **Fail** | Dimension not met (non-critical structural miss) | Overall **Fail** |
| **Critical Fail** | Wrong decision structure / unsafe or boundary-breaking outcome | Overall **Critical Fail** (strongest) |

Overall roll-up (§2.4): Critical Fail > Fail > Warning > Pass.

### 1.4 What the evaluator is not

- Not a prose style judge beyond 30-second usability  
- Not a replacement for Quality Gate (different job; see §7)  
- Not allowed to invent new Golden expected results  
- Not a Decision Readiness “confidence %” or scoring model for readiness quality  

---

## 2. Pass / Warning / Fail criteria

### 2.1 Shared semantic-equivalence policy

A dimension **Passes** when the candidate preserves Spec **intent**, even if wording differs.

Allowed:

- Synonyms and paraphrase (“postpone to Japan late September” ≈ Spec President Decision)
- Extra clarifying clauses that do not change authority, readiness, or boundary
- Reasonable optional tags from Spec’s acceptable list (presence or absence)

Not allowed (typically Fail or Critical Fail):

- Wrong Primary Type
- Collapsing Necessary ≠ Affordable (GC04)
- Assigning routine chasing to President (GC01)
- Declaring Class acceptance definite (GC02)
- Closing on photos / accepting shallow RC as adequate for READY (GC03)
- Inventing safety emergency
- Treating Review Candidate as Case Status

### 2.2 Per-dimension criteria (summary)

#### D01 — Primary Case Type

| Result | When |
| --- | --- |
| **Pass** | Equals Spec `expectedPrimaryCaseType` |
| **Critical Fail** | Any other Primary Type (e.g. GC02 as `INSPECTION_COMPLIANCE`; GC03 as `ISM_MANAGEMENT`) |
| **Warning** | N/A (type is binary) |

Tags must not replace Primary Type (`inspection_compliance` tag on GC02 is OK).

#### D02 — Fact separation

| Result | When |
| --- | --- |
| **Pass** | Confirmed / Unverified / Assumption / Missing used appropriately for Spec’s fact story; derived finance values not in Confirmed |
| **Fail** | Buckets empty when Spec expects separation; material items mis-bucketed without Critical harm |
| **Critical Fail** | Hypothesis stated as Confirmed system weakness; derived finance as Confirmed Fact used to drive READY; invents critical confirmed safety facts absent from input |

#### D03 — Missing Information quality

| Result | When |
| --- | --- |
| **Pass** | Material missing items include **Who / What / Evidence**; blocking vs non-blocking aligned with Spec (e.g. GC01 JP port must not alone force NOT_READY) |
| **Warning** | Who/What/Evidence present but thin; extra optional missings |
| **Fail** | Missing items lack Who/What/Evidence; or blocking flags wrongly force readiness against Spec |
| **Critical Fail** | Omits Spec-critical missing dependency while claiming READY (e.g. GC04 liquidity) |

#### D04 — Decision Authorities

| Result | When |
| --- | --- |
| **Pass** | Multiple role→authority pairs covering Spec expected roles (semantic match, not exact labels) |
| **Warning** | All required roles present; minor label awkwardness |
| **Fail** | Missing a required authority domain without dumping work on President |
| **Critical Fail** | Wrong Decision Authority structure: President owns routine/visa chasing; missing Tech/Class path when Spec requires it; single authority that collapses the case |

#### D05 — President Decision

| Result | When |
| --- | --- |
| **Pass** | Semantic match to Spec expected President Decision intent; `requiredNow` consistent |
| **Warning** | Intent correct; slightly verbose |
| **Fail** | Vague / empty / not separating President Decision from recommendation |
| **Critical Fail** | Opposite decision (e.g. force Nansha); President makes Class/technical judgment personally |

#### D06 — Recommendation boundary

| Result | When |
| --- | --- |
| **Pass** | Hits Spec recommendation intent; avoids forbidden intents / NG patterns |
| **Warning** | Intent OK; options sparse but not inventing artificial compliance choices |
| **Fail** | Weak support / incomplete boundary without forbidden NG |
| **Critical Fail** | Forbidden recommendation (force Nansha; NK approved everything; close on photos; collapse Necessary/Affordable; authorize payment) |

#### D07 — Decision Readiness

| Result | When |
| --- | --- |
| **Pass** | Enum ∈ Spec expected readiness set (`READY` / `CONDITIONAL` / `NOT_READY` as listed) |
| **Warning** | N/A for enum mismatch |
| **Fail** | Wrong readiness vs Spec without Critical Gate conflict |
| **Critical Fail** | `READY` when Spec forbids (e.g. GC04 with unconfirmed liquidity framed as READY); or READY with Critical Quality Gate failures |

**Forbidden:** Any numeric confidence score for readiness. Readiness is categorical only.

#### D08 — Delegation

| Result | When |
| --- | --- |
| **Pass** | Next Actions with Who / What (and due/trigger where material); President not used for routine chase |
| **Warning** | Present but soft triggers |
| **Fail** | Empty while open work remains (per Spec “delegation mandatory”) |
| **Critical Fail** | Delegation structure returns all verification to President against Spec |

#### D09 — Professional Boundary

| Result | When |
| --- | --- |
| **Pass** | No Spec boundary violation; specialist confirmation paths respected; empty `professionalBoundaries` OK if none apply |
| **Warning** | Boundary implied in prose but not structured (still no violation) |
| **Fail** | Soft overclaim without hard violation |
| **Critical Fail** | Professional Boundary violation (Class/Flag/Master/Tech Supt/Medical/Legal substitution; photo-only technical closure; etc.) |

#### D10 — Management Learning

| Result | When |
| --- | --- |
| **Pass** | Flags match Spec significance (GC03 high; GC01 low; GC04 no auto IA/MR) |
| **Warning** | Slight over/under-flagging without Review path error |
| **Fail** | Spec-required learning flags missing (e.g. GC03 CA/PA/EV/Horizontal/IA/MR) |
| **Critical Fail** | Rare — only if learning narrative forces unsafe closure claims (usually caught in D06/D09) |

#### D11 — Review Candidate

| Result | When |
| --- | --- |
| **Pass** | Matches Spec (`yes` → `flag true`; `no` → false; `no_or_monitor` → false or `monitorOnly`) |
| **Warning** | MONITOR path used where Spec allows |
| **Fail** | MR Candidate YES without `flag true` (unless monitorOnly per Schema consistency) |
| **Critical Fail** | Encoding Review Candidate as Case Status; or GC03 flag false when Spec requires YES |

#### D12 — Executive brevity / 30-second usability

| Result | When |
| --- | --- |
| **Pass** | Recommendation → President Decision → Readiness → Authorities → Why → Next Actions is scannable in ~30 seconds |
| **Warning** | Overlong executive; Detail/Learning leaking into executive |
| **Fail** | Executive unusable (buried decision, essay replaces structure) **without** wrong decision |
| **Critical Fail** | N/A on length alone — wrong decision is Critical under other dimensions even if short |

### 2.3 Critical Fail conditions (global — must fail the case)

Any one of the following is **Critical Fail** for the Golden run, regardless of prose quality:

1. **Incorrect Primary Case Type**  
2. **Wrong Decision Authority** structure ( Spec-critical roles missing or President assigned routine/specialist work wrongly )  
3. **Professional Boundary violation**  
4. **Unsafe or compliance-breaking recommendation** (invented emergency; close non-compliant; photo-only closure; unauthorized payment)  
5. **Forbidden Spec NG pattern** realized in output (per case §5)  
6. **`READY` with unresolved Critical Quality Gate findings** (or readiness that Schema forbids given gate)  
7. **Derived finance values as Confirmed Facts** driving a false sense of certainty (GC04)  
8. **System-weakness hypothesis as Confirmed Fact** (GC03)

Critical Fail **cannot** be overridden by: fluent English, complete sentences, long rationale, or high token count.

### 2.4 Overall case result

| Overall | Rule |
| --- | --- |
| **Critical Fail** | Any dimension Critical Fail **or** any global Critical Fail condition |
| **Fail** | No Critical Fail, but ≥1 dimension Fail |
| **Pass with warnings** | All dimensions Pass or Warning; ≥1 Warning |
| **Pass** | All required dimensions Pass; Warnings none |

Regression automation (§8) should treat **Critical Fail** and **Fail** as test failures; **Pass with warnings** as soft-pass (configurable).

---

## 3. Critical Fail conditions (normative list)

Consolidated checklist for implementers and Lab UI:

| Code | Condition |
| --- | --- |
| `CF_WRONG_CASE_TYPE` | `primaryCaseType` ≠ Spec |
| `CF_WRONG_AUTHORITY` | Authority structure violates Spec (roles / President misuse) |
| `CF_BOUNDARY_VIOLATION` | Professional Boundary violated |
| `CF_UNSAFE_OR_COMPLIANCE_REC` | Recommendation/President Decision breaks Safety/Compliance Spec rules |
| `CF_FORBIDDEN_RECOMMENDATION` | Hits Spec forbidden recommendation intent / NG |
| `CF_READY_WITH_CRITICAL_GATE` | Readiness READY while Quality Gate has Critical failures |
| `CF_FACT_DISCIPLINE_BREAK` | Derived/hypothesis as Confirmed Fact in a Spec-sensitive way |
| `CF_REVIEW_FLAG_REQUIRED_MISSING` | Spec requires Review Candidate YES and flag is false |

---

## 4. Per-Golden-Case expectations (GC01–GC04)

Expectations follow Golden Case Specification v1.0. Exact prose optional; structure mandatory.

### 4.1 GC01 — PLUTO LEADER C/M Inoy (`CREW_MANNING`)

| Dimension | Expect |
| --- | --- |
| D01 Type | `CREW_MANNING` — Critical Fail otherwise |
| D02 Facts | Confirmed: cannot board Nansha; C/M can continue; Japan late Sep intended. Do not invent safety emergency |
| D03 Missing | JP port/ETA, docs, etc. OK as missing; **must not** alone force NOT_READY |
| D04 Authorities | Manning/docs; continuation; President final postponement — President **not** visa chaser |
| D05 President | Approve postpone Nansha → Japan late September (semantic) |
| D06 Rec | Postpone to Japan; **not** force Nansha |
| D07 Readiness | `READY` |
| D08 Delegation | Present; CSI/docs & schedule delegated |
| D09 Boundary | No invented Class/medical barriers |
| D10 Learning | Low-level OK; no major MR escalation |
| D11 Review | `flag false` |
| D12 Brevity | Short executive preferred; Warning if essay |

**Critical Fail examples:** Primary TECHNICAL/OPERATIONAL; insist Nansha; invent MSM emergency; President chases visas; NOT_READY solely for JP port.

### 4.2 GC02 — FAIRWIND NK CMS (`TECHNICAL`)

| Dimension | Expect |
| --- | --- |
| D01 Type | `TECHNICAL` — Critical Fail if Primary `INSPECTION_COMPLIANCE` |
| D02 Facts | Prior favorable ClassNK; Haruyama OK; Kashiwabara concern + re-confirm request |
| D03 Missing | Item coverage / written Class clarification with Who/What/Evidence |
| D04 Authorities | Tech Supt; ClassNK; President management confirmation — not President as Class interpreter |
| D05 President | Maintain plan subject to focused ClassNK re-confirmation |
| D06 Rec | Narrow clarification; not abandon without evidence; not Class attendance for every item |
| D07 Readiness | `CONDITIONAL` |
| D08 Delegation | Haruyama formulates; Class confirms |
| D09 Boundary | Must **not** state Class acceptance for all items as definite |
| D10 Learning | Knowledge Update YES; IA/MR not auto |
| D11 Review | `no` or `monitorOnly` — not hard YES required |
| D12 Brevity | Conditionally clear in 30s |

**Critical Fail examples:** “NK approved everything”; President technical judgment; Primary Type wrong.

### 4.3 GC03 — ORBIT IA / Panama ASI (`INSPECTION_COMPLIANCE`)

| Dimension | Expect |
| --- | --- |
| D01 Type | `INSPECTION_COMPLIANCE` — Critical Fail if Primary `ISM_MANAGEMENT` |
| D02 Facts | IA + ASI confirmed; CR-5/6 unverified; system weakness as **hypothesis/assumption** only |
| D03 Missing | Work/Rest, doc control, EG, earth fault, horizontal/effectiveness — Who/What/Evidence |
| D04 Authorities | Master ops; Tech Supt technical; Company/DP RC/SMS; President closure acceptance |
| D05 President | Do not close on corrections/photos alone; require RC/horizontal/effectiveness |
| D06 Rec | Rectify + system follow-up; challenge shallow RC; escalate earth fault |
| D07 Readiness | `CONDITIONAL` |
| D08 Delegation | Mandatory; not all verification to President |
| D09 Boundary | No photo-only electrical closure; no substitute for Tech Supt |
| D10 Learning | CA/PA/EV/Horizontal YES; IA YES; MR YES; fleet possible/yes |
| D11 Review | `flag true` (`retainAfterClose` expected true) |
| D12 Brevity | Dense but ordered; Warning if essay |

**Critical Fail examples:** Close on photos; accept “insufficient checking” without challenge at READY/closure; hypothesis as confirmed fact; Review flag false.

### 4.4 GC04 — PLUTO LEADER CTM (`FINANCE_COMMERCIAL`)

| Dimension | Expect |
| --- | --- |
| D01 Type | `FINANCE_COMMERCIAL` |
| D02 Facts | Source inputs confirmed; **derived** (adjusted, required ≈) not as Confirmed Facts |
| D03 Missing | Liquidity by remittance; date/payee — Who/What/Evidence |
| D04 Authorities | Master Ship Fund; Finance liquidity; President final CTM |
| D05 President | Approve CTM after comparing vessel need vs Company liquidity; 40k preferred ops-side if liquidity allows |
| D06 Rec | Preserve Necessary ≠ Affordable; not 40k solely because vessel wants / not 35k solely because standard |
| D07 Readiness | `CONDITIONAL` unless Spec-level confirmed liquidity evidence present |
| D08 Delegation | Finance confirms; President amount; agent after auth |
| D09 Boundary | No payment authorization; forecasts ≠ accounting facts |
| D10 Learning | No auto IA/MR for temporary negative Ship Fund |
| D11 Review | `flag false` |
| D12 Brevity | Numbers scannable; Warning if essay |

**Critical Fail examples:** Collapse Necessary/Affordable; READY without liquidity; treat uncertain receipts as received; authorize transfer; derived as Confirmed Fact.

---

## 5. Semantic-equivalence policy

### 5.1 Equivalence definition

Two statements are **semantically equivalent** for MDD Golden evaluation when they preserve:

1. The **decision direction** (what to do / not do)  
2. The **authority split** (who owns what)  
3. The **readiness category**  
4. The **boundary** (what AI/Company must not pretend to settle)  
5. The **fact discipline** (confirmed vs not)  

They need **not** share:

- Exact sentences, bullet order, or synonym choice  
- Identical role label strings (fuzzy match to Spec role intent is enough)  
- Identical optional tag sets  

### 5.2 Intent keys (optional aid)

Schema `intentKeys` / Spec keyword lists may assist automation. They are **helpers**, not the only acceptance path. Human Spec prose remains SSoT.

### 5.3 Polished-prose rule (normative)

If executive text is fluent **and** any Critical Fail condition in §3 holds → overall **Critical Fail**.  
Commentary such as “carefully considered,” “holistic,” or “risk-based” does not mitigate structural error.

---

## 6. Tolerance for optional tags / wording variation

| Item | Tolerance |
| --- | --- |
| Spec **required** tags | Must be present (Fail if missing) |
| Spec **acceptable** tags | Presence optional; absence must **not** Fail |
| Extra reasonable tags | Allowed if they do not change Primary Type or imply forbidden escalation |
| Wording variation | Allowed under §5 |
| Authority label wording | Fuzzy/semantic match to Spec roles |
| Exact currency formatting | Tolerant (`USD40,000` vs `40000`) if amounts/intent match Spec |
| Executive length | Warning band for overlong; Fail only if unusable; never Critical on length alone |

---

## 7. Scoring / non-scoring approach

### 7.1 Chosen approach: **non-scoring Pass model**

v1.0 uses **dimensional Pass / Warning / Fail / Critical Fail** with overall roll-up (§2.4).

**Do not** produce:

- A 0–100 “Golden score”
- A readiness confidence percentage
- A weighted average that lets strong prose offset Critical Fail

### 7.2 Optional diagnostics (non-authoritative)

Implementations **may** report counts such as `warningsCount`, `failCount`, `criticalFailCount` for Lab UI. These are diagnostics only and must not redefine Pass.

### 7.3 Why non-scoring

Golden Spec acceptance is binary on structure: either the human-approved decision structure is preserved, or it is not. Soft scores encourage gaming and hide Critical Failures.

---

## 8. Interaction with Quality Gate Rules v1.0

Golden LLM Evaluation and Quality Gate are **complementary**.  
**Golden Evaluation does not replace Quality Gate.**

| Concern | Quality Gate v1.0 | Golden LLM Evaluation v1.0 |
| --- | --- | --- |
| Job | Is this brief integrity-safe to mark READY? | Does this brief match **this** Golden Spec’s expected structure? |
| Input | Any case structured output | Spec fixture + candidate output |
| Critical | Blocks READY | Fails Golden regression |
| Warnings | Soft quality | Soft Spec deviation |

### 8.1 Evaluation pipeline (normative order — frozen)

```
1. Schema validation          (Structured Output Schema v1.0)
2. Quality Gate               (Quality Gate Rules v1.0)
3. Enforced Readiness         (demote illegal READY; Critical findings remain)
4. Golden Case evaluation     (these Rules v1.0 — dimensions D01–D12)
```

This order is mandatory. Golden evaluation must run on the **post-gate** readiness (enforced), not on an illegal pre-gate READY claim alone.

### 8.2 Interaction rules

1. If Quality Gate has Critical findings and candidate still claims `READY` → after enforcement readiness is not READY; if the pipeline skipped enforcement, Golden **Critical Fail** (`CF_READY_WITH_CRITICAL_GATE`).  
2. Quality Gate Pass does **not** imply Golden Pass (e.g. wrong Case Type can still be internally consistent).  
3. **A Golden PASS cannot override an unresolved Critical Gate.**  
   - If `qualityGate.passed === false` (Critical findings remain), overall Golden result must **not** be reported as Pass / PassWithWarnings as if the gate were clear.  
   - Normative overall: at least **Fail**, and **Critical Fail** when readiness was illegally READY or Spec-critical integrity is broken.  
   - Golden dimensional Pass on Type/Authorities/etc. does **not** clear Gate Criticals or unlock READY.  
4. Critical Override (Gate §6) does **not** make READY and does **not** convert a Golden Critical Fail into Pass; proceed ≠ PASS.  
5. Gate Warnings may align with Golden Warnings (e.g. shallow RC, stale info) but each system records its own codes.

### 8.3 Lab reporting shape (design)

```
GoldenLlmEvalReport {
  goldenId
  overall: Pass | PassWithWarnings | Fail | CriticalFail
  dimensions: [{ id, severity, detail }]
  criticalFailCodes: string[]
  qualityGate: { passed, criticalFailures[], warnings[], enforcedReadiness }
  notes?: string
}
```

---

## 9. Requirements for future automated regression tests

### 9.1 Fixture contract

For each `GC01`–`GC04`:

1. Load Spec input facts (+ finance snapshot for GC04)  
2. Produce `MddStructuredOutput` (heuristic now; LLM later behind a flag)  
3. Run pipeline §8.1 (**Schema → Quality Gate → enforced Readiness → Golden eval**)  
4. Assert overall ∈ {Pass, PassWithWarnings} for the **reference heuristic**  
5. Assert Critical Fail (or Fail where specified) for **known-bad mutants**

### 9.2 Required mutant / negative tests (minimum)

Regression **must** include **plausible-but-wrong** mutant outputs — polished, Spec-looking prose that is structurally wrong — **not only** obviously broken JSON or empty payloads.

| Mutant (required) | Expect |
| --- | --- |
| **GC01:** President is assigned routine visa/document chasing | Critical Fail (`CF_WRONG_AUTHORITY` / related) |
| **GC02:** President substitutes for technical/Class judgment | Critical Fail (`CF_BOUNDARY_VIOLATION` / `CF_WRONG_AUTHORITY`) |
| **GC03:** Case is closed merely because photos/corrections were submitted | Critical Fail (`CF_UNSAFE_OR_COMPLIANCE_REC` / `CF_FORBIDDEN_RECOMMENDATION`) |
| **GC04:** USD40,000 CTM is approved without confirming Company liquidity | Critical Fail (`CF_READY_WITH_CRITICAL_GATE` and/or readiness/finance Spec fail) |
| Wrong Primary Type (any GC) | Critical Fail |
| Missing optional acceptable tag only | Still Pass |
| Paraphrased President Decision with same intent | Pass |
| Overlong but structurally correct executive | Pass with Warning (D12) |
| Broken / invalid Schema JSON | Fail at Schema step (before Golden dimensions) |

Mutants should read like a competent assistant wrote them (complete sentences, calm tone) while violating Spec structure.

### 9.3 LLM regression (future; not enabled now)

When LLM is connected:

- Pin model id + System Prompt v1.0 + Schema v1.0  
- Temperature low / deterministic settings where available  
- Record raw debug trace **non-canonically**; evaluate structured fields only  
- Fail CI on Critical Fail / Fail; optionally allow PassWithWarnings  
- Never assert exact prose equality  
- Still require the §9.2 plausible mutants in CI  

### 9.4 Non-goals for tests

- No readiness confidence metrics  
- No flaky synonym LLM-as-judge without Spec anchors (if used later, must be secondary to structured checks)  
- No production LLM calls in default CI until explicitly approved  

### 9.5 Relationship to existing heuristic Lab

Current `evaluateGoldenCase` / Lab remain valid for Phase-1 `DecisionBrief`.  
Implementation of these Rules evaluates **`MddStructuredOutput`** (with adapter from Phase-1 briefs during migration).

---

## 10. Document control

| Item | Value |
| --- | --- |
| Rules version | **1.0** (**frozen**) |
| Machine implementation | `lib/mdd/golden/llm-eval-v1.ts` |
| LLM | Not connected |
| Change policy | Human-approved `v1.1+` only |

**End of Golden Case LLM Evaluation Rules v1.0**
