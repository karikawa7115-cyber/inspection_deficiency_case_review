# Live Golden Rerun — Raw Results

**Executed:** 2026-08-23T09:05:22.818Z → 09:05:59Z  
**Model:** `gpt-4o-mini` · **Flag:** `MDD_DECISION_CONTROL_V01=1`  
**Artifact:** `tmp/mdd-llm-golden-run-2026-08-23T09-05-22-818Z.json`  
**Baseline (Control v0.1):** `tmp/mdd-llm-golden-run-2026-08-23T08-15-01-073Z.json`  

No post-run tuning.

---

## vs prior Control v0.1 (08:15Z)

| Case | Prior Control v0.1 | This run |
| --- | --- | --- |
| GC01 | Schema✓ · Gate Critical `FINANCIAL_DEPENDENCY_UNRESOLVED` (spurious finance) · **CriticalFail** | Structural✓ · Control✓ · **Canonical✗** · Finance **F0** · **CriticalFail** (D00) |
| GC02 | Schema✓ · Gate✓ · **Fail** D05,D10b · NSF | Structural✓ · Canonical✓ · Gate✓ · **Fail** D05,D10b · NSF · Finance inactive |
| GC03 | Schema✓ · Gate✓ · **Fail** D04 | Structural✓ · Canonical✓ · Gate✓ · **Fail** D04,D05 · Finance inactive |
| GC04 | **Schema✗ before Control** · **CriticalFail** | Structural✓ · Control✓ · Canonical✓ · Gate✓ · Finance **F1+F2+F3** · **Fail** D04,D11 |

---

## GC01

| Item | Result |
| --- | --- |
| Structural | PASS |
| Control | applied; interventions R1 tags; R3 Manning Agent / Master / President; R9×2; R5 CONDITIONAL→READY; P1 finance |
| Findings | `SPURIOUS_FINANCE_EXTENSION` |
| Canonical | **FAIL** — READY invalid while LLM `qualityGate.criticalFailures` still has CRITICAL_FACT_MISSING entries |
| Finance | **F0** (reasons=[]; spurious LLM finance) |
| Quality Gate | not meaningfully evaluated (Canonical stop); enforced NOT_READY; criticals=[] |
| Readiness | CONDITIONAL → READY |
| Authorities | President/DP → + Manning Agent, Master, Final postponement approval |
| President Decision | requiredNow=true; “Approve postponement…Voy.071.”; **NSF=false** |
| Review Candidate | flag=true (raw & controlled) |
| Golden | **CriticalFail** · `CF_SCHEMA_INVALID` · **D00** |

## GC02

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Super/Class/President; R4 requiredNow; R9×3 |
| Findings | `NEEDS_SEMANTIC_FILL` |
| Finance | **inactive** |
| Quality Gate | passed; CONDITIONAL; 3× `WARN_OPTIONAL_EVIDENCE_MISSING` |
| Readiness | CONDITIONAL → CONDITIONAL |
| Authorities | Super + Class → + Technical assessment, Class acceptance, Final management confirmation |
| President Decision | “Not required at this stage.” · requiredNow false→**true** · **NSF=true** |
| Review Candidate | flag=true |
| Golden | **Fail** · **D05**, **D10b** |

## GC03

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Master/Tech/Flag/President; R9×3; R5 NOT_READY→CONDITIONAL |
| Findings | none |
| Finance | **inactive** |
| Quality Gate | passed; CONDITIONAL; EXECUTION_CONDITION + 3× shallow-RC warnings |
| Readiness | NOT_READY → CONDITIONAL |
| Authorities | President → + Onboard corrective, Technical verification, Flag/ASI, Final acceptance |
| President Decision | requiredNow=true; closure decision text; **NSF=false** |
| Review Candidate | flag=true |
| Golden | **Fail** · **D04**, **D05** |

## GC04

| Item | Result |
| --- | --- |
| Structural / Canonical | PASS / PASS |
| Control | R1; R3 Finance + President CTM; R9×1 |
| Findings | none |
| Finance | **F1+F2+F3** |
| Quality Gate | passed; enforced CONDITIONAL; 3× `WARN_STALE_OR_CURRENT_INFO` (no finance Critical) |
| Readiness | NOT_READY → NOT_READY (Gate enforced CONDITIONAL) |
| Authorities | President → + Company cash-position (Finance), Final CTM funding |
| President Decision | “Approve September CTM amount of USD40,000.” · requiredNow=true · **NSF=false** |
| Review Candidate | flag=true |
| Golden | **Fail** · **D04**, **D11** |
