# Live Golden Rerun — Decision Policy v0.2 (raw results)

**Executed:** 2026-08-23T10:42:00.100Z → 10:42:34Z  
**Model:** `gpt-4o-mini` · **Flag:** `MDD_DECISION_CONTROL_V01=1`  
**Org defaults:** **not set** (`ORG_DEFAULT_*` unset)  
**Artifact:** `tmp/mdd-llm-golden-run-2026-08-23T10-42-00-100Z.json`  
**Baseline (Pipeline v0.1.2):** `tmp/mdd-llm-golden-run-2026-08-23T10-18-25-728Z.json`  

No post-run tuning.

---

## vs prior v0.1.2 (10:18Z)

| Case | v0.1.2 | This Policy v0.2 run |
| --- | --- | --- |
| **GC01** | **Pass** | **Pass** (retained) |
| **GC02** | **Fail** D05, D10b | **Fail** D05, D10b (unchanged class) |
| **GC03** | **Fail** D04 | **Pass** (D04 cleared) |
| **GC04** | **Fail** D04, D11 | **Fail** D04 only (**D11 cleared**) |

---

## GC01

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1/R3/R9/R5 (standard manning); no AD domain; no RC-B findings |
| Authority Domain | none |
| Review B-guarded | flag false→false; MR raw=false → final false |
| Gate | passed; READY; execution-condition warnings as applicable |
| Readiness | CONDITIONAL → READY → **READY** |
| Authorities | + Manning Agent, Master, Final postponement |
| Golden | **Pass** · no failed dimensions |

---

## GC02

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Findings | `NEEDS_SEMANTIC_FILL`; `REVIEW_CANDIDATE_DEMOTED`; `UNSUPPORTED_MR_SUGGESTION`; `MR_EFFECTIVE_FILTERED` |
| Review B-guarded | raw flag=true → **false**; MR raw=true → assembled **false** (audited) |
| Gate | passed; CONDITIONAL |
| Golden | **Fail** · **D05**, **D10b** only |

---

## GC03 — D04 attention

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Authority Domain | **AD-INSPECT-RC** upsert: `Root cause / SMS / CAPA follow-up` (President/DP) via **case_context** |
| Review B-guarded | flag stays **true** (retention criteria met); MR raw=true → final true |
| Authorities after Control | Master · Tech · Flag · Final acceptance · **+ RC/SMS follow-up** |
| Gate | passed; CONDITIONAL |
| Golden | **Pass** · D04 cleared |

---

## GC04 — D04 / D11 attention

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Finance | **F1+F2+F3** |
| Authority Domain | **AD-FINANCE-SHIPFUND** → `AUTHORITY_DOMAIN_UNRESOLVED` (no Case Context Master/ship-fund owner; org fallback off) |
| Authorities after Control | cash-position · Final CTM funding · **no Ship Fund domain** |
| Review B-guarded | raw flag=true → **false**; MR raw=true → assembled **false** |
| Findings | `AUTHORITY_DOMAIN_UNRESOLVED`; `REVIEW_CANDIDATE_DEMOTED`; `UNSUPPORTED_MR_SUGGESTION`; `MR_EFFECTIVE_FILTERED` |
| Gate | passed; CONDITIONAL |
| Golden | **Fail** · **D04 only** · **D11 cleared** |

---

## Aggregate

| Metric | v0.1.2 | Policy v0.2 |
| --- | --- | --- |
| Golden Pass | GC01 | **GC01, GC03** |
| Golden Fail | GC02, GC03, GC04 | GC02, GC04 |
| CriticalFail | 0 | 0 |
| GC03 D04 | Fail | **cleared** |
| GC04 D11 | Fail | **cleared** |
| GC04 D04 | Fail | **remains** (Ship Fund unresolved without Context/org default) |
| GC02 residual | D05/D10b | D05/D10b |
| GC01 | Pass | Pass |
