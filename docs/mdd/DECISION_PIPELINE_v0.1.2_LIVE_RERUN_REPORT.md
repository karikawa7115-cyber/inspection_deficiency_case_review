# Live Golden Rerun — Decision Pipeline v0.1.2 (raw results)

**Executed:** 2026-08-23T10:18:25.728Z → 10:18:56Z  
**Model:** `gpt-4o-mini` · **Flag:** `MDD_DECISION_CONTROL_V01=1`  
**Artifact:** `tmp/mdd-llm-golden-run-2026-08-23T10-18-25-728Z.json`  
**Baseline (v0.1.1):** `tmp/mdd-llm-golden-run-2026-08-23T09-05-22-818Z.json`  

No post-run tuning.

---

## vs prior v0.1.1 (09:05Z)

| Case | v0.1.1 | This v0.1.2 run |
| --- | --- | --- |
| **GC01** | Structural✓ · Canonical✗ · Golden **CriticalFail** (D00) · Finance F0 | Structural✓ · Canonical✓ · Gate✓ READY · Golden **Pass** · Finance F0 |
| **GC02** | Canonical✓ · Gate✓ · **Fail** D05,D10b · NSF | Same pattern: **Fail** D05,D10b · NSF · Finance inactive |
| **GC03** | Canonical✓ · Gate✓ · **Fail** D04,D05 | **Fail** D04 only (D05 cleared this sample) · Finance inactive |
| **GC04** | Canonical✓ · Gate✓ · **Fail** D04,D11 · F1+F2+F3 | Same: **Fail** D04,D11 · F1+F2+F3 |

---

## GC01

| Item | Result |
| --- | --- |
| Structural | PASS |
| Control | R1; R3×3 Manning/Master/President; R9×2; R5 CONDITIONAL→READY; P1 finance |
| Findings | `SPURIOUS_FINANCE_EXTENSION` |
| Gate findings | passed; criticals=[]; 2× `WARN_OPTIONAL_EVIDENCE_MISSING` (JP port/ETA; Inoy docs) |
| Assembled final qualityGate | passed=true; criticalFailures=[]; same warnings (Gate-owned) |
| Original LLM qualityGate | passed=false; 2× `CRITICAL_FACT_MISSING` (retained for audit only) |
| Readiness raw→control→final | CONDITIONAL → READY → **READY** |
| Canonical | **PASS** |
| Finance | **F0** |
| Authorities | President → + Manning Agent, Master, Final postponement approval |
| President Decision | requiredNow=true; approve Japan postponement; **NSF=false** |
| Review Candidate | flag=**false** |
| Golden | **Pass** · no failed dimensions |

---

## GC02

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Super/Class/President; R4 requiredNow; R9 |
| Findings | `NEEDS_SEMANTIC_FILL` |
| Gate | passed; CONDITIONAL; 1× EXECUTION_CONDITION warning |
| Assembled QG | Gate-owned (LLM had CRITICAL_FACT_MISSING — discarded as final) |
| Finance | **inactive** |
| Readiness | CONDITIONAL → CONDITIONAL → CONDITIONAL |
| Authorities | Super+Class → + Technical assessment, Class acceptance, Final management confirmation |
| President Decision | “Not required at this stage.” · requiredNow false→**true** · **NSF=true** |
| Review Candidate | flag=true |
| Golden | **Fail** · **D05**, **D10b** |

---

## GC03

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Master/Tech/Flag/President; R9×3; R5 NOT_READY→CONDITIONAL |
| Findings | none |
| Gate | passed; CONDITIONAL; EXECUTION_CONDITION + 3× shallow-RC warnings |
| Finance | **inactive** |
| Readiness | NOT_READY → CONDITIONAL → CONDITIONAL |
| Authorities | President → + Onboard corrective, Technical verification, Flag/ASI, Final acceptance |
| President Decision | requiredNow=true; closure question including root-cause/horizontal/effectiveness; **NSF=false** |
| Review Candidate | flag=true |
| Golden | **Fail** · **D04** only |

---

## GC04

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Finance + President CTM (+ interventions as recorded) |
| Findings | none |
| Gate | passed; enforced CONDITIONAL; liquidity / stale-info warnings |
| Finance | **F1+F2+F3** |
| Readiness | NOT_READY → NOT_READY → **CONDITIONAL** (Gate-owned) |
| Authorities | President → + Company cash-position, Final CTM funding (Ship Fund data still absent → D04) |
| President Decision | CTM approval prose; requiredNow=true; **NSF=false** |
| Review Candidate | flag=**true** (Spec expects no → D11) |
| Golden | **Fail** · **D04**, **D11** |

---

## Aggregate

| Metric | v0.1.1 | v0.1.2 this run |
| --- | --- | --- |
| Canonical all pass | 3/4 | **4/4** |
| Golden Pass | 0 | **1 (GC01)** |
| Golden Fail | GC02–GC04 | GC02–GC04 |
| Golden CriticalFail | GC01 | **0** |
