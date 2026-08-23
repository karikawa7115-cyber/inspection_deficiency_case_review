# MDD Quality Gate Rules v1.0

**Status:** **Frozen (superseded for active evaluation)** — retained for history / regression.  
**Active Quality Gate:** [QUALITY_GATE_RULES_v1.1.md](./QUALITY_GATE_RULES_v1.1.md) (`evaluateQualityGateV1_1`).  
**Machine implementation (v1.0):** `lib/mdd/quality-gate/evaluate-v1.ts` (`evaluateQualityGateV1`)  
**Depends on (frozen):**

- `docs/mdd/SYSTEM_PROMPT_v1.0.md`
- `docs/mdd/GOLDEN_CASE_SPECIFICATION_v1.0.md`
- `docs/mdd/STRUCTURED_OUTPUT_SCHEMA_v1.0.md`

**Out of scope:** Production LLM connection, Case Status redesign.

**Naming note:** Critical codes match Structured Output Schema v1.0 / System Prompt.  
`SAFETY_OR_COMPLIANCE_UNRESOLVED` is the canonical code (not a shortened alias).

**Versioning:** Active path is v1.1+. This v1.0 text remains frozen for comparison.

---

## 1. Gate taxonomy

### 1.1 Purpose

Quality Gate evaluates whether a Decision Brief may responsibly be marked **READY** (and, secondarily, whether CONDITIONAL / NOT_READY is appropriate). It does **not** replace human confirmation. It does **not** authorize payments, Class acceptance, or technical closure.

### 1.2 Severities

| Severity | Placement in Schema v1.0 | Blocks `READY`? | Default effect |
| --- | --- | --- | --- |
| **Critical** | `qualityGate.criticalFailures[]` | **Yes (always)** | `passed` must be `false`; `decisionReadiness` must not be `READY` |
| **Warning** | `qualityGate.warnings[]` | **No** | Inform President / operator; may advise CONDITIONAL; never alone forces NOT_READY |

### 1.3 Finding record (Schema-compatible)

Each gate emits zero or more findings:

```
GateFinding {
  code: QualityGateCode   // Critical or WARN_*
  message: string         // human-readable, specific to this case
  relatedFieldPaths?: string[]
}
```

Aggregates (Schema v1.0):

- `qualityGate.passed === (criticalFailures.length === 0)`
- Warnings never flip `passed` to false by themselves

### 1.4 Families

| Family | Codes | Notes |
| --- | --- | --- |
| **Critical (fixed 7)** | §2 | Preserve System Prompt / Schema categories |
| **Warning (v1.0 set)** | §3 | Quality issues; do not auto-block READY; stale may escalate (§3.1.1) |
| **Case-type applicability** | per gate | Finance dependency gates **skip** non-Finance cases |
| **Lifecycle nuance** | Inspection/ISM RC | Warning vs Critical only when RC materially required (§3.6) |

### 1.5 What Gate is not

- Not Case Status
- Not Review Candidate flag (may *warn* about learning/review inconsistency)
- Not a substitute for Professional Boundary owners (Class, Flag, Master, Tech Supt, Medical, Legal)

---

## 2. Critical gate definitions

All seven are **Critical**. Any one → **READY invalid**. Human override of Critical is restricted (§6).

Shared columns:

- **Detects:** what signal is evaluated  
- **Fail when:** concrete fail condition  
- **Blocks READY:** always **Yes**  
- **Primary Case Types:** where the gate is especially important (still evaluated globally unless “Skip when” says otherwise)  
- **Override:** see §6  

---

### 2.1 `CRITICAL_FACT_MISSING`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Material information required for the President decision (or for safe/compliant direction) is absent and not merely optional execution detail. |
| **Fail when** | ≥1 `facts.missingInformation` item with `blocksReadiness === true`, **or** executive direction depends on an unstated material fact that is neither Confirmed nor labeled Assumption, **or** gate logic marks a critical gap with this code. |
| **Does not fail when** | Missing JP port/ETA-style execution detail that Golden Spec says must not force NOT_READY (e.g. GC01); optional evidence only → use Warning. |
| **Blocks READY** | Yes |
| **Especially important for** | All types; CREW_MANNING, TECHNICAL, INSPECTION_COMPLIANCE, FINANCE_COMMERCIAL |
| **Skip when** | Never fully skipped; severity of *which* facts block is case-specific |
| **Typical readiness if failed** | `NOT_READY` (or `CONDITIONAL` only if a supportable direction exists **and** no Safety/Compliance/Boundary critical remains — still never READY) |

---

### 2.2 `SAFETY_OR_COMPLIANCE_UNRESOLVED`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Unresolved Safety / Human Life or Compliance issue that would make a management decision irresponsible. |
| **Fail when** | Recommendation/President Decision proceeds despite unresolved statutory/safety obligation; invents or ignores a safety emergency; treats non-compliance as acceptable without authority path; or required compliance confirmation is missing and decision is framed as closed/READY. |
| **Does not fail when** | Spec explicitly states no immediate safety/manning emergency (GC01) and recommendation respects that. |
| **Blocks READY** | Yes |
| **Especially important for** | OPERATIONAL, TECHNICAL, CREW_MANNING, INSPECTION_COMPLIANCE, ISM_MANAGEMENT |
| **Skip when** | Never for inspection/compliance closure claims |

---

### 2.3 `DECISION_AUTHORITY_UNCLEAR`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Role→authority pairs insufficient or ambiguous for the principal decision. |
| **Fail when** | `decisionAuthorities.length === 0`; required authority domains for the case type missing (e.g. Finance case without Finance/Accounting when liquidity is material; Technical case without Tech/Class path when Class acceptance is material); President listed as sole owner of purely routine/delegable work with no other authorities; authority `status` leaves the deciding party unidentified. |
| **Does not fail when** | Multiple clear pairs exist even if some are `pending`. |
| **Blocks READY** | Yes |
| **Especially important for** | All types |
| **Skip when** | Never |

---

### 2.4 `PROFESSIONAL_BOUNDARY_VIOLATION`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Output substitutes for Class, Flag, Master’s statutory authority, Superintendent technical judgment, medical, or legal professionals. |
| **Fail when** | States Class acceptance as definitive without Class confirmation; declares electrical/technical fault closed without Tech Supt; President framed as making technical/Class judgment personally; photo-only compliance closure asserted; medical/legal conclusions invented. |
| **Does not fail when** | Boundary is correctly stated in `professionalBoundaries[]` and recommendation defers to the right authority. Empty `professionalBoundaries` is allowed when no specialist boundary applies — do not invent. |
| **Blocks READY** | Yes |
| **Especially important for** | TECHNICAL, INSPECTION_COMPLIANCE, ISM_MANAGEMENT |
| **Inspection/ISM nuance** | Declaring case **closed** or **READY** while violating boundary → Critical. Mentioning a technical item still open with proper escalation → usually OK (may be CONDITIONAL). |

---

### 2.5 `RECOMMENDATION_UNSUPPORTED`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Recommendation / President Decision not supported by facts, labeled assumptions, risks, authority, and feasibility. |
| **Fail when** | Direction contradicts confirmed facts; relies on silent guesses; invents artificial options where compliance leaves no choice *and* treats them as real; Necessary collapsed into Affordable (finance) without separation; recommendation asserts outcomes that only a specialist can confirm. |
| **Does not fail when** | Direction is supportable with explicit Assumptions and Missing Information listed. |
| **Blocks READY** | Yes |
| **Especially important for** | All types |

---

### 2.6 `FINANCIAL_DEPENDENCY_UNRESOLVED`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Required **company financial** dependency for a funding/feasibility decision is unresolved. |
| **Fail when** | `primaryCaseType === FINANCE_COMMERCIAL` **or** `finance` extension present, **and** a required liquidity/dependency remains unconfirmed while output claims READY **or** treats uncertain receipts as received **or** authorizes payment/transfer **or** collapses Necessary≠Affordable. For CONDITIONAL finance briefs, emit this Critical when readiness is incorrectly set to READY; if CONDITIONAL and dependency explicitly missing, prefer this Critical **or** `CRITICAL_FACT_MISSING` with `blocksReadiness` — v1.0 rule: **claiming READY with unconfirmed blocking liquidity → this Critical**. |
| **Does not fail when** | Case is non-Finance **and** no `finance` extension (gate **skipped**). Vessel ops cost mentioned casually without finance decision → skip. |
| **Blocks READY** | Yes (when gate applies) |
| **Especially important for** | `FINANCE_COMMERCIAL` only (plus any case that attaches `finance`) |
| **Skip when** | Non-Finance cases without `finance` extension — **must not affect** them |

---

### 2.7 `FACT_RECOMMENDATION_CONTRADICTION`

| Attribute | Definition |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Material contradiction between fact buckets and recommendation / President Decision. |
| **Fail when** | Confirmed fact says X and recommendation asserts ¬X; derived finance value presented as Confirmed Fact and used to overstate certainty; unverified vessel statement treated as proven effectiveness while recommending closure; hypothesis of system weakness stated as confirmed fact in recommendation. |
| **Does not fail when** | Recommendation explicitly challenges unverified statements (e.g. shallow CR-5) and keeps them in `unverified` / assumptions. |
| **Blocks READY** | Yes |
| **Especially important for** | All types; INSPECTION_COMPLIANCE, FINANCE_COMMERCIAL |

---

## 3. Warning gate definitions

Warnings **never alone** make `passed === false` and **never alone** invalidate READY. They may still advise human to prefer CONDITIONAL.

---

### 3.1 `WARN_STALE_OR_CURRENT_INFO` (Stale information)

| Attribute | Definition |
| --- | --- |
| **Severity** | **Warning by default**; may **escalate to Critical** under §3.1.1 |
| **Detects** | Time-sensitive information may be stale relative to decision timing (liquidity “as of”, ETA, Class advice age, document validity, survey status). |
| **Warn when** | Decision references dated or current-state figures without freshness assurance; remittance/liquidity timing unclear; Class/crew/document status may have aged — but the brief does not claim READY on that basis alone. |
| **Blocks READY** | No (as Warning) |
| **Especially important for** | FINANCE_COMMERCIAL, CREW_MANNING, TECHNICAL, INSPECTION_COMPLIANCE |

#### 3.1.1 Escalation to Critical

Escalate stale-information concern to **Critical** (using the matching Critical code below — taxonomy unchanged) when the decision **materially depends** on current information **and** stale data could change any of:

| If stale data could change… | Emit Critical code |
| --- | --- |
| Safety / Compliance conclusion | `SAFETY_OR_COMPLIANCE_UNRESOLVED` |
| Decision Authority | `DECISION_AUTHORITY_UNCLEAR` |
| Recommendation | `RECOMMENDATION_UNSUPPORTED` |
| Financial feasibility | `FINANCIAL_DEPENDENCY_UNRESOLVED` |
| Required action or timing | `CRITICAL_FACT_MISSING` (and/or `RECOMMENDATION_UNSUPPORTED`) |

**Examples (Critical escalation):** current bank liquidity used as if confirmed for READY; current Class/Flag acceptance asserted from aged advice; current crew/document status assumed current for manning decision; time-sensitive survey status treated as still valid without confirmation.

When escalated: finding remains Critical; optional Warning may also note staleness. **READY remains invalid** while Critical stands.

---

### 3.2 `WARN_OPTIONAL_EVIDENCE_MISSING`  
*(Schema alias: `WARN_OPTIONAL_DETAIL_MISSING` — both accepted in v1.0; prefer `WARN_OPTIONAL_EVIDENCE_MISSING` going forward)*

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Useful but non-blocking evidence/detail missing. |
| **Warn when** | `missingInformation` exists with `blocksReadiness !== true`; nice-to-have schedule/payee/port detail. |
| **Blocks READY** | No |
| **Especially important for** | CREW_MANNING (GC01 JP port), FINANCE (payee/date) |

---

### 3.3 `WARN_WEAK_DELEGATION`

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Next Actions / authorities under-specify Who / What / trigger, or dump routine work on President. |
| **Warn when** | `nextActions` empty while open work remains; actions lack owner; President given visa/document chasing; weak “follow up” without trigger. |
| **Blocks READY** | No (if authorities are still clear — else escalate to `DECISION_AUTHORITY_UNCLEAR`) |
| **Especially important for** | All types |

---

### 3.4 `WARN_OVERLONG_EXECUTIVE`

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Executive Decision exceeds ~30-second comprehension (verbosity / essay). |
| **Warn when** | Recommendation + President Decision + Why together are excessively long or bury the decision; Detail/Learning content duplicated into executive. |
| **Blocks READY** | No |
| **Especially important for** | All types |

---

### 3.5 `WARN_UNNECESSARY_ESCALATION`

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Over-escalation to President, MR, IA, or Class attendance without evidence. |
| **Warn when** | Ordinary one-off treated as system crisis; MR/IA candidates set without basis; Class attendance for every item merely because concern exists (GC02 NG). |
| **Blocks READY** | No |
| **Especially important for** | CREW_MANNING, TECHNICAL, FINANCE_COMMERCIAL |

---

### 3.6 `WARN_SHALLOW_ROOT_CAUSE`

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning by default; may **promote to Critical** under §3.6.1 **only when Root Cause is materially required** |
| **Detects** | Root cause language is shallow (“human error”, “insufficient checking”, “improper filling”) without Person→Procedure→Trigger→Verification→Failure Point challenge. |
| **Applies when** | Root Cause analysis is a **required part of resolution** — typically relevant `INSPECTION_COMPLIANCE` or `ISM_MANAGEMENT` cases (and tags such as `root_cause_required`). |
| **Does not apply when** | Ordinary cases where Root Cause is **not** materially relevant (e.g. routine CREW_MANNING postponement, ordinary FINANCE CTM amount choice). Do **not** invent RC requirements. |
| **Warn when** | RC-required case still open / CONDITIONAL; shallow RC appears; recommendation **challenges** them and does not close. |
| **Blocks READY** | No (as Warning) |
| **Especially important for** | INSPECTION_COMPLIANCE, ISM_MANAGEMENT |

#### 3.6.1 Promotion rule (only if Root Cause materially required)

| Situation | Severity |
| --- | --- |
| RC-required case; ongoing rectification + system follow-up; shallow RC challenged; readiness CONDITIONAL | **Warning** `WARN_SHALLOW_ROOT_CAUSE` |
| RC-required case; output marks **READY** or implies **Company closure** while accepting shallow RC as adequate | **Critical** via `RECOMMENDATION_UNSUPPORTED` and/or `FACT_RECOMMENDATION_CONTRADICTION` (and Safety/Compliance if closing non-compliant) — do **not** leave as Warning only |
| Photo-only closure (RC-required / compliance case) | Critical `PROFESSIONAL_BOUNDARY_VIOLATION` / `SAFETY_OR_COMPLIANCE_UNRESOLVED` as applicable |
| Non-RC-required ordinary case with casual “human error” wording unrelated to closure | **No RC gate** (ignore or optional soft note only — do not Critical-escalate) |

---

### 3.7 `WARN_REVIEW_LEARNING_OPPORTUNITY`

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Unresolved or inconsistent management-learning / review opportunity. |
| **Warn when** | Strong learning signals (IA+ASI, fleet-wide possible) but `reviewCandidate.flag === false` without `monitorOnly`; or `managementReviewCandidate === true` without flag (should be Schema-invalid — if seen at gate layer, warn + treat as consistency defect); or Knowledge Update clearly warranted but unset. |
| **Blocks READY** | No |
| **Especially important for** | INSPECTION_COMPLIANCE, ISM_MANAGEMENT, TECHNICAL (soft monitor) |

---

### 3.8 `WARN_HYPOTHESIS_AS_FACT_RISK` *(retained from Schema v1.0)*

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Analytical hypothesis at risk of being read as confirmed system weakness. |
| **Warn when** | Hypothesis present; prose tone may over-claim. If actually placed in `facts.confirmed` → Critical `FACT_RECOMMENDATION_CONTRADICTION`. |
| **Blocks READY** | No (as Warning) |

---

### 3.9 `WARN_MONITOR_REVIEW` *(retained from Schema v1.0)*

| Attribute | Definition |
| --- | --- |
| **Severity** | Warning |
| **Detects** | Soft monitor path without hard Review Candidate commitment (GC02-style). |
| **Warn when** | `reviewCandidate.monitorOnly === true` or Spec expects no_or_monitor. |
| **Blocks READY** | No |

---

## 4. Evaluation order

Evaluate in this order. Later gates may assume earlier findings. Short-circuit is **not** required for Warnings; Critical findings always accumulate.

1. **Input / shape sanity** (authorities present; fact buckets present; finance source vs derived not in confirmed) — may emit Critical codes  
2. `CRITICAL_FACT_MISSING`  
3. `SAFETY_OR_COMPLIANCE_UNRESOLVED`  
4. `PROFESSIONAL_BOUNDARY_VIOLATION`  
5. `DECISION_AUTHORITY_UNCLEAR`  
6. `FINANCIAL_DEPENDENCY_UNRESOLVED` (**skip** if non-Finance and no `finance`)  
7. `RECOMMENDATION_UNSUPPORTED`  
8. `FACT_RECOMMENDATION_CONTRADICTION`  
9. **Warnings pack** (any order within; recommended):  
   - stale/current → optional evidence → weak delegation → overlong executive → unnecessary escalation → shallow RC → hypothesis risk → review/learning opportunity → monitor review  
10. **Aggregate:** set `passed`, enforce readiness consistency (Schema §2.5.1)  
11. **Override layer:** apply only if explicit human override record present (§6); never silent  

---

## 5. Readiness interaction rules

| Condition | Allowed `decisionReadiness` | `qualityGate.passed` |
| --- | --- | --- |
| `criticalFailures.length === 0`, no blocking semantic issue | `READY` or `CONDITIONAL` | `true` |
| `criticalFailures.length === 0`, direction needs confirmations | `CONDITIONAL` preferred | `true` |
| `criticalFailures.length > 0` | `NOT_READY` or `CONDITIONAL` only; **never `READY`** | `false` |
| Warnings only | `READY` allowed if decision still responsible | `true` |
| Finance liquidity missing, direction otherwise clear | `CONDITIONAL` (GC04); Critical if wrongly marked READY | per Critical rules |
| **Critical Override present** (§6) | Human may **proceed**; readiness stays **`CONDITIONAL` or `NOT_READY`** — **override does not make READY** | `false` while Critical findings remain |

**Hard rule (frozen with Schema v1.0):**  
If any Critical failure exists → `READY` is **invalid**.

**Separation of concepts:**

| Concept | Meaning |
| --- | --- |
| **System decision readiness** | Gate assessment (`READY` / `CONDITIONAL` / `NOT_READY`) |
| **Human decision to proceed** | Operational choice to act despite open Critical findings (override) |

These are **separate**. Proceeding ≠ READY.

**Warnings:** never auto-block READY; may be shown prominently in UI.

**Case Status mapping (envelope, not Gate):**  
After Analyze, readiness READY/CONDITIONAL → often `DECISION_REQUIRED`; NOT_READY → `WAITING_FOR_INFORMATION`. Gate does not set Case Status directly.

---

## 6. Human override policy

### 6.1 Principles

1. Critical failures must **not** be silently bypassed.  
2. Override, if allowed, must be **explicit** and **auditable**.  
3. AI / engine must not auto-override.  
4. Override does **not** clear findings.  
5. Override does **not** convert readiness to `READY`.  
6. Human decision to proceed and system assessment of decision readiness are **separate concepts**.

### 6.2 What may be overridden

| Severity | Meaning of “override” | Effect on readiness |
| --- | --- | --- |
| **Warning** | Human acknowledges and may proceed | READY still allowed if otherwise valid |
| **Critical** | Human explicitly chooses to **proceed despite** the Critical finding | Readiness remains **`CONDITIONAL` or `NOT_READY`** until the underlying Critical issue is **resolved** (finding cleared by fix, not by override) |

### 6.3 Override record (envelope / audit — not Schema executive prose)

Minimum fields:

| Field | Requirement |
| --- | --- |
| `overriddenCodes` | Critical codes being proceeded-despite |
| `actor` | Who |
| `at` | ISO timestamp |
| `justification` | Non-empty reason |
| `safetyComplianceAcknowledgement` | Required if involving `SAFETY_OR_COMPLIANCE_UNRESOLVED` or boundary-related Critical |
| `proceedDespiteCritical` | Must be `true` for Critical override |

### 6.4 Effect of Critical override (normative)

1. Critical finding **remains recorded** in `criticalFailures` (`passed` stays `false`).  
2. Override **must not** remove or relabel Critical findings as Warnings.  
3. Override **must not** set `decisionReadiness` to `READY`.  
4. Enforced readiness after override: keep `NOT_READY` or `CONDITIONAL` (never promote to READY).  
5. Human may still execute operational “proceed” outside the readiness label (Case Status / action workflow) — that is not READY.  
6. Only **resolving** the underlying issue (new evidence, corrected brief, re-evaluation with empty criticals) may restore a path to READY.  
7. Golden Lab acceptance ignores override (tests structural purity).

### 6.5 Forbidden

- Dropping Critical codes to force `passed: true` without resolving the issue  
- Relabeling Critical as Warning to unlock READY  
- Using override to claim READY  
- Using `debug.rawModelTrace` as justification  

---

## 7. Golden Case expectations (GC01–GC04)

Expectations are **structural**, aligned with Golden Case Specification v1.0. Exact prose may vary.

### 7.1 GC01 — PLUTO LEADER C/M Inoy (`CREW_MANNING`)

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `READY` |
| Critical failures | **None** |
| Must not fire | `CRITICAL_FACT_MISSING` solely for JP port/ETA; invent safety emergency (`SAFETY_OR_COMPLIANCE_UNRESOLVED`); President as visa chaser (`DECISION_AUTHORITY_UNCLEAR` / `WARN_WEAK_DELEGATION`) |
| Acceptable warnings | `WARN_OPTIONAL_EVIDENCE_MISSING` (port/ETA/docs); light `WARN_WEAK_DELEGATION` if any softness |
| Finance gates | **Skipped** |
| Review/learning | No forced MR; avoid `WARN_UNNECESSARY_ESCALATION` |

### 7.2 GC02 — FAIRWIND NK CMS (`TECHNICAL`)

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` |
| Critical failures | **None** if Class re-confirmation path + Tech Supt authority preserved |
| Must fire Critical if | “NK approved everything”; President makes technical judgment; boundary violated → `PROFESSIONAL_BOUNDARY_VIOLATION` / `RECOMMENDATION_UNSUPPORTED` |
| Acceptable warnings | `WARN_MONITOR_REVIEW`; `WARN_OPTIONAL_EVIDENCE_MISSING` (written Class reply); `WARN_UNNECESSARY_ESCALATION` if over-Class-attendance suggested (should be absent in good run) |
| Finance gates | **Skipped** |

### 7.3 GC03 — ORBIT IA / Panama ASI (`INSPECTION_COMPLIANCE`)

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` |
| Critical failures | **None** for a correct CONDITIONAL brief that challenges shallow RC and keeps technical boundary |
| Must fire Critical if | Close on photos; accept shallow RC as adequate for READY/closure; declare earth fault closed; treat hypothesis as confirmed fact |
| Expected warnings | `WARN_SHALLOW_ROOT_CAUSE` (challenge ongoing); possibly `WARN_REVIEW_LEARNING_OPPORTUNITY` only if flag/learning inconsistent (good run: MR YES + `reviewCandidate.flag true` → no consistency warn) |
| Finance gates | **Skipped** |

### 7.4 GC04 — PLUTO LEADER CTM (`FINANCE_COMMERCIAL`)

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` (liquidity unconfirmed) |
| Critical failures | **None** while CONDITIONAL and Necessary≠Affordable preserved |
| Must fire Critical if | READY claimed without liquidity; payment authorized; uncertain receipts treated as received; Necessary collapsed into Affordable; derived values as Confirmed Facts (`FACT_RECOMMENDATION_CONTRADICTION` / `RECOMMENDATION_UNSUPPORTED` / `FINANCIAL_DEPENDENCY_UNRESOLVED`) |
| Expected warnings | `WARN_OPTIONAL_EVIDENCE_MISSING` or `WARN_STALE_OR_CURRENT_INFO` for liquidity timing / payee |
| Finance gates | **Active** |

---

## 8. Compatibility with Structured Output Schema v1.0

| Gate Rules v1.0 | Schema v1.0 |
| --- | --- |
| Critical codes (7) | Identical to Schema / System Prompt set |
| `criticalFailures` / `warnings` / `passed` | Unchanged aggregate rules |
| READY blocked by Critical | Schema §2.5.1 R1–R4 |
| New WARN_* codes in §3 | Additive; Schema text already allows `WARN_*` extension. Machine Zod enum should be extended additively when Gate Rules are implemented (**no Critical rename**). |
| Alias `WARN_OPTIONAL_DETAIL_MISSING` | Keep accepted for backward compatibility with Schema examples |
| Override audit fields | Case envelope / audit — **outside** `MddStructuredOutput` executive |
| Finance skip | Matches Schema: finance extension optional; non-Finance must not require finance fields |

---

## 9. Document control

| Item | Value |
| --- | --- |
| Rules version | **1.0** (**frozen**) |
| Machine implementation | `lib/mdd/quality-gate/evaluate-v1.ts` |
| LLM | Not connected |
| Change policy | Human-approved `v1.1+` only |

**End of Quality Gate Rules v1.0**
