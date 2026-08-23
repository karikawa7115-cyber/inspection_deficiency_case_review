# MDD Quality Gate Rules v1.1

**Status:** **Frozen** — human-approved active Quality Gate SSoT (23 Aug 2026).  
**Does not modify:** System Prompt v1.0, Structured Output Schema v1.0, Golden Case Specification v1.0, Golden LLM Evaluation Rules v1.0.  
**Machine implementation:** `lib/mdd/quality-gate/evaluate-v1.1.ts` (`evaluateQualityGateV1_1`)  
**Prior version (history/regression):** Quality Gate Rules v1.0 — `docs/mdd/QUALITY_GATE_RULES_v1.0.md` + `evaluateQualityGateV1` (kept; not active).

**Out of scope:** Case Status redesign; Schema enum / authority / review-candidate / professional-boundary rule changes.

**Versioning:** Changes require `v1.2+` and human approval.

---

## 0. Delta from Quality Gate Rules v1.0

| Area | v1.0 | v1.1 |
| --- | --- | --- |
| **Missing-information Critical** | Any `facts.missingInformation` with `blocksReadiness === true` → `CRITICAL_FACT_MISSING` | Critical **only** when the missing item is **DECISION_BLOCKING** for the *current* required decision |
| **Important ≠ Critical** | Easy to treat all “important” gaps as Critical | Explicit three-way stage taxonomy (§2.1.1) |
| **GC02 ClassNK confirmation** | LLM marking `blocksReadiness: true` forced Critical / readiness collapse | Classified **EXECUTION_CONDITION**; supports **CONDITIONAL**; expected Gate readiness **CONDITIONAL** |
| **GC03 RC / horizontal / effectiveness** | Same over-Critical risk | Primarily **CLOSURE_OR_EFFECTIVENESS_CONDITION**; supports **CONDITIONAL** / Warning; **not** automatic NOT_READY |
| **GC04 Company liquidity (current)** | Same over-Critical risk when listed as blocking missing | **EXECUTION_CONDITION** for final CTM remittance; expected Gate readiness **CONDITIONAL** at this stage (READY still forbidden without confirmed liquidity) |
| **`qualityGate.evaluatedAt`** | Schema field; model often invents empty/invalid values | **System-owned execution metadata** — injector / evaluator sets ISO timestamp; LLM must not invent runtime metadata (§10) |
| **Unchanged** | Seven Critical codes; Warning taxonomy; authority / boundary / review rules; finance skip; override policy; Golden expected readiness labels | Same — **not** weakened |

**Intent:** Fix a **specification interaction** (Gate over-firing Critical on execution/closure conditions) before judging model capability. Do **not** change Golden expected results merely to pass runs.

---

## 1. Gate taxonomy

### 1.1–1.5

Same as Quality Gate Rules v1.0 §1, except:

- Critical still always blocks `READY`.
- Warnings never alone force NOT_READY.
- **Additional principle (v1.1):** Missing information is **decision-stage aware**. The evaluator must ask:  
  **“Does this missing information block the current decision, or only execution/closure?”**

---

## 2. Critical gate definitions

Critical codes **2.2–2.7** are unchanged from v1.0 (`SAFETY_OR_COMPLIANCE_UNRESOLVED`, `DECISION_AUTHORITY_UNCLEAR`, `PROFESSIONAL_BOUNDARY_VIOLATION`, `RECOMMENDATION_UNSUPPORTED`, `FINANCIAL_DEPENDENCY_UNRESOLVED`, `FACT_RECOMMENDATION_CONTRADICTION`).

### 2.1 `CRITICAL_FACT_MISSING` (clarified)

| Attribute | Definition (v1.1) |
| --- | --- |
| **Severity** | Critical |
| **Detects** | Material information **required to responsibly make the current President/authority decision** is absent (not merely required for later execution, remittance, Class paperwork, or closure/effectiveness proof). |
| **Fail when** | ≥1 missing-information item classified as **DECISION_BLOCKING** (§2.1.1), **or** executive direction depends on an unstated material fact that is neither Confirmed nor labeled Assumption and is decision-blocking, **or** gate logic marks a decision-blocking gap with this code. |
| **Does not fail when** | Missing item is **EXECUTION_CONDITION** or **CLOSURE_OR_EFFECTIVENESS_CONDITION** (§2.1.1); JP port/ETA-style detail (GC01); optional evidence only → Warning. **`blocksReadiness === true` alone is not sufficient** — stage classification is authoritative. |
| **Blocks READY** | Yes (when this Critical fires) |
| **Typical readiness if failed** | `NOT_READY` (or `CONDITIONAL` only if a supportable direction exists **and** no Safety/Compliance/Boundary critical remains — still never READY) |

#### 2.1.1 Missing-information stage taxonomy (normative)

Classify each material missing-information item into exactly one stage:

| Stage | Meaning | Gate severity | Readiness effect |
| --- | --- | --- | --- |
| **DECISION_BLOCKING** | Prevents the **current** President/authority decision from being responsibly made | **Critical** → `CRITICAL_FACT_MISSING` | READY forbidden; normally **NOT_READY** |
| **EXECUTION_CONDITION** | Direction/decision can be made, but **execution** or **final approval/remittance** requires confirmation | **Warning** (e.g. `WARN_OPTIONAL_EVIDENCE_MISSING` and/or `WARN_STALE_OR_CURRENT_INFO`) — **not** Critical solely for this gap | Supports **CONDITIONAL**; do **not** auto-force NOT_READY |
| **CLOSURE_OR_EFFECTIVENESS_CONDITION** | Current direction is clear, but **closure** / effectiveness / horizontal verification remains | **Warning** (e.g. `WARN_SHALLOW_ROOT_CAUSE`, `WARN_OPTIONAL_EVIDENCE_MISSING`) — **not** Critical solely for this gap | Supports **CONDITIONAL** or Warning; **not** automatic NOT_READY |

**Evaluator question (mandatory):**  
Does this missing information block the **current decision**, or only **execution/closure**?

**Do not** classify all important missing information as Critical.

##### Classification guidance (non-exhaustive)

| Signal examples | Typical stage |
| --- | --- |
| Unknown whether a safety/manning emergency exists; principal choice of direction cannot be stated without the fact; “cannot decide until X” | **DECISION_BLOCKING** |
| Focused ClassNK / Class written confirmation of an already-proposed handling (GC02); current Company liquidity confirmation before final CTM remittance (GC04); payee/date for execution | **EXECUTION_CONDITION** |
| Root-cause quality evidence; horizontal check; effectiveness verification; corrective-action proof needed before Company **closure** (GC03) | **CLOSURE_OR_EFFECTIVENESS_CONDITION** |

##### Interaction with `blocksReadiness`

| Input hint | v1.1 treatment |
| --- | --- |
| `blocksReadiness: true` | **Hint only.** Re-classify by stage. If EXECUTION or CLOSURE → do **not** emit `CRITICAL_FACT_MISSING` for that item. |
| `blocksReadiness: false` / omitted | Still classify; usually Warning / optional. |
| Stage = DECISION_BLOCKING | Critical regardless of whether the model set `blocksReadiness`. |

##### Interaction with READY claims

| Situation | Gate behavior |
| --- | --- |
| CONDITIONAL brief + only EXECUTION / CLOSURE missings | `passed: true`; enforced readiness **CONDITIONAL**; Warnings as applicable |
| NOT_READY proposed **only** because of EXECUTION / CLOSURE missings (no other Critical) | Do **not** keep automatic NOT_READY; enforce **CONDITIONAL** |
| READY + EXECUTION_CONDITION that is material to final act (e.g. unconfirmed liquidity on finance case) | READY invalid: demote to **CONDITIONAL**; use existing Critical **`FINANCIAL_DEPENDENCY_UNRESOLVED`** when finance rules apply — **not** by mislabeling execution gaps as `CRITICAL_FACT_MISSING` unless truly decision-blocking |
| READY + DECISION_BLOCKING missing | `CRITICAL_FACT_MISSING`; READY invalid; normally NOT_READY |

---

## 3–6. Warnings, evaluation order, readiness interaction, override

Inherit Quality Gate Rules v1.0 §§3–6 with these adjustments:

### 3.2 `WARN_OPTIONAL_EVIDENCE_MISSING` (clarified)

Also covers **EXECUTION_CONDITION** and non-blocking **CLOSURE_OR_EFFECTIVENESS_CONDITION** missings that are not better covered by a more specific Warning (e.g. `WARN_SHALLOW_ROOT_CAUSE`, `WARN_STALE_OR_CURRENT_INFO`).

### 4. Evaluation order (insert)

After input sanity, **before** emitting `CRITICAL_FACT_MISSING`:

1. Classify each `missingInformation` item into a stage (§2.1.1).  
2. Emit Critical only for **DECISION_BLOCKING**.  
3. Emit Warnings for EXECUTION / CLOSURE stages (and optional missings).  
4. Continue with Critical gates 2.2–2.7 as in v1.0.  
5. Aggregate readiness (§5 / §2.1.1 READY interactions).  
6. Set **`evaluatedAt`** as system metadata (§10) — never trust model-supplied empty/invalid timestamps as semantic content.

### 5. Readiness interaction (additive)

| Condition | Allowed / enforced readiness | `passed` |
| --- | --- | --- |
| No Critical; **material** EXECUTION / CLOSURE conditions still unresolved (e.g. ClassNK confirm, liquidity before remittance, RC/effectiveness before closure) | Enforce **CONDITIONAL** (even if model claimed READY) | `true` |
| No Critical; only **ordinary non-material** Warnings (e.g. JP port/ETA optional detail) | **READY remains valid** — Warnings must **not** auto-downgrade a legitimate READY brief | `true` |
| DECISION_BLOCKING Critical present | NOT_READY (or CONDITIONAL only under v1.0 R3 caveats); never READY | `false` |
| Finance liquidity unconfirmed, direction clear, CONDITIONAL | **CONDITIONAL**; Warnings OK; Critical only if READY wrongly claimed (`FINANCIAL_DEPENDENCY_UNRESOLVED`) | per Critical rules |

Hard rule unchanged: any Critical → READY invalid.

**Normative clarification:** Execution/closure conditions may enforce CONDITIONAL when **materially unresolved**. Ordinary non-material warnings must **not** automatically downgrade a legitimately READY case.

---

## 7. Golden Case expectations (GC01–GC04) — Gate alignment

Golden Case Specification v1.0 expected readiness labels are **unchanged**. Gate v1.1 aligns **classification** so Gate does not contradict those labels via over-Critical missing-info.

### 7.1 GC01 — unchanged intent

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `READY` |
| Critical failures | **None** |
| Must not fire | `CRITICAL_FACT_MISSING` solely for JP port/ETA |

### 7.2 GC02 — FAIRWIND NK CMS

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` |
| ClassNK focused confirmation | **EXECUTION_CONDITION** (not DECISION_BLOCKING) |
| Critical failures | **None** if Class re-confirmation path + Tech Supt authority preserved |
| Must fire Critical if | “NK approved everything”; President makes technical judgment; boundary violated |

### 7.3 GC03 — ORBIT IA / Panama ASI

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` |
| Root Cause / horizontal check / effectiveness evidence | Primarily **CLOSURE_OR_EFFECTIVENESS_CONDITION** |
| Critical failures | **None** for a correct CONDITIONAL brief that challenges shallow RC and keeps technical boundary |
| Must fire Critical if | Close on photos; accept shallow RC as adequate for READY/closure |

### 7.4 GC04 — PLUTO LEADER CTM

| Expectation | Gate outcome |
| --- | --- |
| Readiness | `CONDITIONAL` at this stage (liquidity unconfirmed) |
| Current Company liquidity confirmation | **EXECUTION_CONDITION** for final CTM remittance |
| Critical failures | **None** while CONDITIONAL and Necessary≠Affordable preserved |
| Must fire Critical if | READY without liquidity; payment authorized; receipts treated as received; Necessary collapsed into Affordable |

---

## 8. Compatibility with Structured Output Schema v1.0

| Topic | Rule |
| --- | --- |
| Critical / Warning code enums | **Unchanged** — no Schema weaken |
| Authority / review-candidate / professional boundaries | **Unchanged** |
| `blocksReadiness` field | Remains in Schema as optional hint; **Gate v1.1 re-classifies** by stage |
| `qualityGate.evaluatedAt` | Schema still requires non-empty string; **value is system-injected** (§10), not model judgment |

---

## 9. Document control

| Item | Value |
| --- | --- |
| Rules version | **1.1** (**frozen**) |
| Prior version | Quality Gate Rules **v1.0** (history/regression only) |
| Machine implementation | `lib/mdd/quality-gate/evaluate-v1.1.ts` |
| Active callers | `propose`, Analyze API (`mode=llm`), Golden LLM evaluation pipeline |
| Change policy | Human-approved `v1.2+` only |

---

## 10. `evaluatedAt` ownership (normative)

| Rule | Detail |
| --- | --- |
| Owner | Application / Quality Gate evaluator |
| Nature | **Execution metadata**, not semantic LLM content |
| Behavior | Inject a valid ISO-8601 timestamp **deterministically** at evaluation (and, when preparing model JSON for Schema parse, overwrite/fill `qualityGate.evaluatedAt` before Zod) |
| Forbidden | Asking the LLM to invent runtime metadata; treating empty/null model `evaluatedAt` as a **semantic** failure of decision quality |
| Scope | Must **not** alter recommendation, readiness judgment, authorities, facts, learning, or review flags |

Helper: `injectQualityGateEvaluatedAt()` in `lib/mdd/quality-gate/evaluated-at.ts`.

---

**End of Quality Gate Rules v1.1**
