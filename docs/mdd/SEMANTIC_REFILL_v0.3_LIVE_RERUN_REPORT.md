# Live Golden Rerun — Semantic Refill v0.3 (raw results)

**Executed:** 2026-08-23T11:29:36.602Z → 11:30:04.317Z  
**Models:** primary `gpt-4o-mini` · refill `gpt-4o-mini`  
**Flags:** `MDD_DECISION_CONTROL_V01=1` · `MDD_SEMANTIC_REFILL_V03=1`  
**Org defaults:** unset  
**Artifact:** `tmp/mdd-llm-golden-run-2026-08-23T11-29-36-602Z.json`  
**Baseline (Policy v0.2):** `tmp/mdd-llm-golden-run-2026-08-23T10-42-00-100Z.json`  

No post-run tuning.

Pipeline:

```text
Raw+CDQ → Primary LLM → Structural → Decision Control/Policy v0.2
  → Semantic Refill v0.3 (if triggered) → Gate v1.1 → Enforced Readiness
  → Canonical Assembly → Canonical Schema → Golden Eval
```

---

## vs Policy v0.2 (10:42Z)

| Case | Policy v0.2 | This Refill v0.3 run |
| --- | --- | --- |
| **GC01** | **Pass** | **Pass** (retained) |
| **GC02** | **Fail** D05, D10b · NSF | **Fail** D05, D10b · NSF **retained** (refill **triggered** then **rejected**) |
| **GC03** | **Pass** | **Pass** (retained) |
| **GC04** | **Fail** D04 only | **Fail** D04 only (retained class) |

---

## GC01

| Item | Result |
| --- | --- |
| Refill triggered | **No** |
| T1 `requiredNow` | raw `true` → controlled `true` |
| T2 prose defect | none (usable PD) |
| T3 NSF before | **false** |
| Original PD | `Approve postponing the planned Nansha Chief Mate change to Japan during Voy.071 in late September.` (`requiredNow=true`) |
| Refill output | — |
| Validator | — |
| Applied | **false** |
| Final PD | same as original |
| NSF after | **false** |
| Findings | `REVIEW_CANDIDATE_DEMOTED`, `UNSUPPORTED_MR_SUGGESTION`, `MR_EFFECTIVE_FILTERED`, `SPURIOUS_FINANCE_EXTENSION` |
| Gate | passed · criticals none · warnings: optional JP port/ETA; Inoy docs |
| Readiness | **READY** |
| Structural / Canonical | PASS / PASS |
| Golden | **Pass** · no failed dimensions |
| Primary latency | **8037 ms** |
| Refill latency | — |

---

## GC02

| Item | Result |
| --- | --- |
| Refill triggered | **Yes** |
| T1 | raw `requiredNow=false` → Control `true` → **T1 true** |
| T2 | **`not_required`** (`Not required at this stage.`) |
| T3 NSF before | **true** |
| Original PD | `Not required at this stage.` (`requiredNow=true` after Control) |
| Refill output | `Management must confirm the continuation of the current CMS handling plan, contingent upon a focused re-confirmation from ClassNK regarding the item scope and acceptance.` |
| Validator | **`rejected`** · codes: **`DEFERRED_AS_CURRENT`** |
| Applied | **false** (fail-closed) |
| Final PD | `Not required at this stage.` (unchanged) |
| NSF after | **true** (`NEEDS_SEMANTIC_FILL` kept) |
| Findings | `NEEDS_SEMANTIC_FILL`, `REVIEW_CANDIDATE_DEMOTED`, `UNSUPPORTED_MR_SUGGESTION`, `MR_EFFECTIVE_FILTERED`, `SPURIOUS_FINANCE_EXTENSION`, **`SEMANTIC_REFILL_REJECTED`** |
| Gate | passed · CONDITIONAL · warnings: ClassNK confirmation; open-up feasibility |
| Structural / Canonical | PASS / PASS |
| Golden | **Fail** · **D05** (`intent keywords not found`) · **D10b** (`expected true`) |
| Primary latency | **5824 ms** |
| Refill latency | **1081 ms** |

---

## GC03

| Item | Result |
| --- | --- |
| Refill triggered | **No** |
| T1 | raw/controlled `requiredNow=true` |
| T2 | none |
| T3 NSF before | **false** |
| Original / Final PD | `May Company close Internal Audit / Panama ASI items now, or must rectification, root-cause challenge, horizontal check, and effectiveness verification remain open?` |
| Applied | **false** |
| NSF after | **false** |
| Findings | (none) |
| Gate | passed · CONDITIONAL · warnings: ASI wording; photo packs; CR-5/6; root-cause challenge |
| Structural / Canonical | PASS / PASS |
| Golden | **Pass** · no failed dimensions |
| Primary latency | **7137 ms** |
| Refill latency | — |

---

## GC04

| Item | Result |
| --- | --- |
| Refill triggered | **No** |
| T1 | raw/controlled `requiredNow=true` |
| T2 | none |
| T3 NSF before | **false** |
| Original / Final PD | `Approve September CTM amount of USD40,000.` |
| Applied | **false** |
| NSF after | **false** |
| Findings | `AUTHORITY_DOMAIN_UNRESOLVED`, `UNSUPPORTED_MR_SUGGESTION`, `MR_EFFECTIVE_FILTERED` |
| Finance | **F1+F2+F3** |
| Gate | passed · CONDITIONAL · warnings: liquidity confirmation |
| Structural / Canonical | PASS / PASS |
| Golden | **Fail** · **D04 only** (`Authority structure incomplete vs Spec`) |
| Primary latency | **5551 ms** |
| Refill latency | — |

---

## Aggregate answers

| Question | Answer |
| --- | --- |
| GC01 Pass maintained? | **Yes** |
| GC03 Pass maintained? | **Yes** |
| GC02 D05 cleared? | **No** — refill triggered but **rejected** (`DEFERRED_AS_CURRENT`); original “Not required…” retained; D05 still Fail |
| GC02 D10b remains? | **Yes** (Fail `expected true`) |
| GC04 limited to classified D04? | **Yes** — Fail **D04 only** (same class as Policy v0.2; Ship Fund unresolved / input-grounding) |
| Unexpected refill on non-NSF cases? | **No** — only GC02 triggered |
| Primary vs refill latency | Primary: GC01 8037 / GC02 5824 / GC03 7137 / GC04 5551 ms. Refill (GC02 only): **1081 ms** |

---

## Latency summary

| Case | Primary LLM (ms) | Refill LLM (ms) |
| --- | --- | --- |
| GC01 | 8037 | — |
| GC02 | 5824 | 1081 |
| GC03 | 7137 | — |
| GC04 | 5551 | — |

---

## Stop

Raw results only. **No post-run tuning.**  
GC02 shows fail-closed Semantic Refill v0.3 behavior under live `gpt-4o-mini` (propose → `DEFERRED_AS_CURRENT` reject → NSF retained).
