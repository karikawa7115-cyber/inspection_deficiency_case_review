# Graduation MVP Readiness Report

**Status:** MVP FREEZE for August 30 presentation  
**Baseline commit (pipeline stack):** `823afc6` (+ local live artifact accepted)  
**Accepted live MVP baseline:** `tmp/mdd-llm-golden-run-2026-08-23T11-29-36-602Z.json`  
  (Semantic Refill v0.3 live rerun · Control ON · Refill ON · `gpt-4o-mini` both)  
**Freeze rule:** Until presentation, **no** new architecture / Prompt / Schema / Gate / Policy / Semantic Refill / Golden Eval changes unless required to fix a **blocking** bug.  
**Do not tune Semantic Refill v0.3 further.**

**This document:** readiness only — **no implementation**.

---

## 1. Current architecture (frozen MVP stack)

```text
Case Envelope (title / vessel / pastedText / CDQ / optional financeSourceInput)
        │
        ▼
Primary LLM Draft          ← System Prompt v1.0 + Schema v1.0 (strict JSON)
        │
        ▼
Pre-Control Structural Zod
        │
        ▼
Decision Control v0.1 / v0.1.1  +  Decision Policy v0.2
  (authorities, NSF flag, Review B-guarded, MR hybrid, finance F0 annotate, …)
        │
        ▼
Semantic Refill v0.3 (optional flag)   ← PD text only; fail-closed
        │
        ▼
Quality Gate v1.1  →  Enforced Readiness (Gate-owned)
        │
        ▼
Canonical Assembly v0.1.2  →  Canonical Schema v1.0
        │
        ▼
Golden LLM Evaluation Rules v1.0
```

| Layer | Version | Ownership / note |
| --- | --- | --- |
| System Prompt | v1.0 frozen | LLM draft authorship |
| Structured Output Schema | v1.0 frozen | Canonical shape |
| Decision Control | v0.1 + v0.1.1 | Flag `MDD_DECISION_CONTROL_V01` |
| Decision Pipeline | v0.1.2 | Gate owns final QG + readiness |
| Decision Policy | v0.2 accepted | Authority domains + Review B-guarded |
| Semantic Refill | v0.3 accepted (MVP baseline) | Flag `MDD_SEMANTIC_REFILL_V03`; default OFF |
| Quality Gate | v1.1 active | v1.0 retained historical |
| Golden Spec / Eval | v1.0 frozen | Same CDQ envelopes |
| Source Provenance | v0.1 design only | **Not implemented** (deferred) |

**UI / runtime split (important for demo):**

| Surface | What it runs today |
| --- | --- |
| `/mdd` Decision Desk workspace | **Client heuristic** Analyze (`proposeFromHeuristics` + Gate v1.1 via `applyGateToBrief`) — localStorage cases |
| `/mdd/lab` Golden Case Lab | Heuristic vs Golden Spec structural accept |
| `POST /api/mdd/analyze?mode=llm` | Full LLM path **when** server routes exist |
| Production build | `next.config.ts` → **`output: "export"`** → **API routes unavailable** in static host |
| Live Golden validation | `npm run mdd:llm-golden` / `scripts/mdd-phase1-llm-golden-run.ts` |

---

## 2. Implemented features (graduation MVP)

| Feature | Status |
| --- | --- |
| Golden Cases GC01–GC04 + CDQ envelopes | Done |
| Heuristic Decision Desk UI (case list, workspace, confirmations, badges) | Done |
| Golden Lab (heuristic acceptance) | Done |
| LLM structured propose (Schema v1.0) | Done |
| Decision Control (CDQ, authorities, NSF annotate, readiness staging) | Done |
| Finance Gate activation F1∨F2∨F3; F0 spurious annotate | Done |
| Pipeline system-owned Gate/readiness + Canonical assembly | Done |
| Policy v0.2 AD-INSPECT-RC / AD-FINANCE-SHIPFUND | Done |
| Policy v0.2 Review B-guarded + MR hybrid (no R6b force) | Done |
| Semantic Refill v0.3 (bounded PD; fail-closed; audit) | Done |
| Live Golden script + reports | Done |
| Source Provenance intake model | Design only |
| DB / auth / multi-user | Out of scope (Phase constraint) |

---

## 3. Golden Case results (accepted MVP baseline)

**Run:** 2026-08-23T11:29:36Z · Control ON · Refill ON · `gpt-4o-mini`  
**Report:** `docs/mdd/SEMANTIC_REFILL_v0.3_LIVE_RERUN_REPORT.md`

| Case | Golden | Failed dims | Notes |
| --- | --- | --- | --- |
| **GC01** | **Pass** | — | Pass maintained |
| **GC02** | **Fail** | **D05**, **D10b** | Refill **triggered** then **rejected** fail-closed (`DEFERRED_AS_CURRENT`); NSF retained |
| **GC03** | **Pass** | — | Pass maintained (Policy v0.2 D04 cleared) |
| **GC04** | **Fail** | **D04 only** | Classified **`INPUT_CONTEXT_DEFICIENCY` / `GOLDEN_EXPECTATION_NOT_INPUT_GROUNDED`** |

**Accepted known limitations (do not “fix” for MVP):**

1. GC02 D05 / NSF residual after safe refill reject  
2. GC02 D10b (`knowledgeUpdateCandidate`)  
3. GC04 D04 Ship Fund domain without authoritative provenance / no org Master default  

---

## 4. Demo flow (GC01–GC04) — recommended for Aug 30

### 4.1 Story arc (≈5–8 minutes)

| Step | Show | Say |
| --- | --- | --- |
| 1 | Architecture slide / one diagram | Envelope + CDQ → LLM → Control/Policy → optional Refill → Gate-owned readiness → Golden |
| 2 | `/mdd` | Decision Desk: load Golden cases; President 30-second brief (heuristic Analyze is OK for UI demo) |
| 3 | GC01 | Clean manning postponement → READY path; President decides postponement |
| 4 | GC03 | Inspection non-closure; RC/SMS authority domain (Policy); Review retention |
| 5 | GC04 | Necessary ≠ Affordable; CONDITIONAL; liquidity EXECUTION_CONDITION; **honest** missing Ship Fund authority without inventing Master |
| 6 | GC02 | Technical Class handling; show **fail-closed Refill** narrative from live report (triggered → rejected → NSF kept) — integrity over polish |
| 7 | Close | Known limits are **classified**, not hidden; Post-Graduation path listed |

### 4.2 Per-case demo cues

| Case | Demo emphasis | Expected honest outcome |
| --- | --- | --- |
| **GC01** | CDQ “postpone?”; authorities Manning/Master/President; READY | Pass |
| **GC02** | Class re-confirm; President ≠ Class interpreter; Refill fail-closed | Fail D05/D10b **accepted** |
| **GC03** | Do not close on photos; RC/SMS follow-up domain; Review true | Pass |
| **GC04** | Vessel need vs liquidity; CONDITIONAL; D04 = input grounding | Fail D04 **accepted** |

### 4.3 What **not** to claim live in UI

- Do **not** claim the static Decision Desk Analyze button runs Control + Semantic Refill + live LLM (it runs **heuristics** today).  
- Live pipeline proof = **script artifact / reports** (or `next dev` + API if you deliberately demo server mode — see §6).

---

## 5. Remaining items — classification

### BLOCKER BEFORE PRESENTATION

| ID | Item | Why |
| --- | --- | --- |
| **B1** | **Decide and rehearse the demo path** (static UI heuristics + offline Golden reports **vs** local `next dev` LLM) | Static export has **no** `/api/mdd/analyze`; UI Analyze is heuristic. Ambiguity here can break live presentation. |
| **B2** | **Presentation host / URL smoke-check** for `/mdd` and `/mdd/lab` (load GC01–GC04, Analyze, badges) by **Aug 29** | Runtime failure on demo day is blocking; code freeze does not remove ops check. |
| **B3** | **API key / env for any live LLM segment** (if demo plan includes `mdd:llm-golden` or `mode=llm`) | Missing key = failed live segment. If demo is heuristic-only, mark B3 N/A and stick to that plan. |
| **B4** | **One-page talk track** that states GC02/GC04 limitations as **accepted** (not bugs) | Prevents mid-demo “why Fail?” derailment. |

> **Not automatic blockers:** GC02 D05/D10b Fail, GC04 D04 Fail, Refill reject — already **accepted MVP baseline**. Do not treat as pre-presentation defects to “fix.”

### NICE TO HAVE (before Aug 30 only if zero risk)

| ID | Item |
| --- | --- |
| **N1** | Slide: pipeline diagram + flag names (`MDD_DECISION_CONTROL_V01`, `MDD_SEMANTIC_REFILL_V03`) |
| **N2** | Slide: GC02 fail-closed Refill quote + `DEFERRED_AS_CURRENT` as integrity example |
| **N3** | Printed or PDF copy of live rerun summary table (offline backup if Wi‑Fi fails) |
| **N4** | Short “heuristic UI vs live LLM script” footnote on architecture slide |

### POST-GRADUATION (v1.1+)

| ID | Item |
| --- | --- |
| **P1** | Source Provenance v0.1 implementation (Case Context evidence ownership) |
| **P2** | Legitimate GC04 Ship Fund grounding (input provenance — **not** org-default Master for Golden) |
| **P3** | Semantic Refill validator/prompt refinement for `DEFERRED_AS_CURRENT` false positives (GC02 D05) — **frozen for MVP** |
| **P4** | Knowledge Update / D10b policy (out of Refill v0.3 scope) |
| **P5** | Wire Decision Desk UI to full LLM → Control → Refill → Gate path |
| **P6** | Non-static hosting (or hybrid) so API routes work in production |
| **P7** | Eval D04 domain-equivalence (vs brittle label substring) |
| **P8** | Stronger refill-only model experiment (only after mini baseline) |
| **P9** | DB persistence / auth / multi-user |
| **P10** | Auto 30/60/90 finance forecast (explicitly Phase 1 out of scope) |

---

## 6. Blocking UI / runtime issues before August 29

| Issue | Severity | Guidance |
| --- | --- | --- |
| **Static export disables API routes** (`output: "export"`) | **BLOCKER if** live LLM-in-browser is required; **else N/A** | Prefer demo: UI heuristics + offline Golden reports. Changing `output` is an architecture/deploy change — avoid unless B1 forces it and leadership approves as bugfix. |
| **Workspace Analyze = heuristics only** | Same as above | Do not surprise audience. |
| **localStorage-only cases** | Low for single-laptop demo | Refresh/clear storage can empty list — rehearse “Load Golden Case” buttons. |
| **LLM latency / quota** | **BLOCKER if** live script on stage | Pre-run artifact + screenshots as backup. |
| **Heuristic vs live Golden mismatch** | Communication risk | Lab/heuristic Pass ≠ live LLM Golden Pass for GC02/GC04 — say so. |

**Recommended freeze decision for Aug 30:**  
**Primary demo = Decision Desk UI (heuristic) + accepted live-run slides/PDF.**  
Treat full live LLM on stage as optional backup only if B1–B3 are green by Aug 29.

---

## 7. Explicitly deferred to Post-Graduation v1.1

All **P1–P10** above, plus:

- Any further Semantic Refill v0.3 tuning  
- Org default `ORG_DEFAULT_SHIP_FUND_OWNER=Master` to force GC04 Pass  
- Inventing GC04 Master provenance without input facts  
- Prompt / Schema / Gate / Policy / Eval version bumps  

---

## 8. Freeze checklist (ops, not code)

| By | Action | Class |
| --- | --- | --- |
| Now | Architecture freeze as stated | — |
| Aug 29 | B1 demo-path decision locked | BLOCKER |
| Aug 29 | B2 URL/UI smoke-check | BLOCKER |
| Aug 29 | B3 env only if live LLM segment planned | BLOCKER / N/A |
| Aug 29 | B4 talk track for known Fail dims | BLOCKER |
| Aug 30 | Present with accepted limitations | — |

---

## 9. Stop

Readiness report only. **No implementation in this task.**  
Semantic Refill v0.3 **not** to be tuned further under Graduation MVP Freeze.
