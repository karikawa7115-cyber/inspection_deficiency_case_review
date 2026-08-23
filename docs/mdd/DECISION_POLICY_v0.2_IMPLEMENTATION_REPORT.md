# Decision Policy v0.2 — Implementation Report

**Status:** IMPLEMENTED  
**Date:** 2026-08-23  
**Live LLM Golden rerun:** **Not performed** (awaiting review)

**Implements:** Authority Domain Policy (AD-INSPECT-RC, AD-FINANCE-SHIPFUND) + Review Candidate B-guarded + Management Review hybrid Option 2  

**Does not modify:** Decision Pipeline v0.1.2 · System Prompt v1.0 · Structured Output Schema v1.0 · Quality Gate v1.1 · Golden Spec / Eval Rules · Semantic Refill

---

## 1. What shipped

### 1.1 Authority domains

| Rule | Domain | Module |
| --- | --- | --- |
| AD-INSPECT-RC | `RC_SMS_FOLLOWUP` | `authority-domains-v0.2.ts` |
| AD-FINANCE-SHIPFUND | `SHIP_FUND_SOURCE` | same |

**Resolver order (normative):**  
required → reuse if covered → Case Context / CDQ / `authorityContext.domainOwners` / RACI notes → upsert pending → else `AUTHORITY_DOMAIN_UNRESOLVED`.

**Org fallbacks** (`org-defaults.ts`):

- `ORG_DEFAULT_RC_SMS_OWNER=DP`
- `ORG_DEFAULT_SHIP_FUND_OWNER=Master`

Disabled unless explicitly configured (tests pass `orgDefaults: { null, null }`). Fallback use is audited.

No GC03 / ORBIT / GC04 / PLUTO / Golden-label branching.

### 1.2 Review Candidate B-guarded

| Change | Detail |
| --- | --- |
| Removed | R6b `managementReviewCandidate=true ⇒ reviewCandidate.flag=true` |
| Final flag | Control-owned both directions via generalized criteria (Repeat, High Risk, System Weakness, Fleet-wide, Ineffective CA, Knowledge Gap, Reporting Failure, External Signal) |
| Findings | `REVIEW_CANDIDATE_PROMOTED` / `REVIEW_CANDIDATE_DEMOTED` |
| Audit | `RC-B-GUARDED` with originalSuggestion, finalValue, policyCriteriaEvaluated, reason, controlVersion, at |

### 1.3 Management Review hybrid (Option 2)

| Layer | Behavior |
| --- | --- |
| LLM suggestion | Preserved in `originalLlmDraft.learning.managementReviewCandidate` |
| Assembled final | Policy-filtered; unsupported MR → assembled `false` |
| Findings | `UNSUPPORTED_MR_SUGGESTION`, `MR_EFFECTIVE_FILTERED` |
| Audit | `RC-MR-FILTER` with full change record |

Canonical satisfaction is by construction on the controlled/assembled draft — **not** by deleting the LLM suggestion from `originalLlmDraft`.

### 1.4 Case Envelope extension

Optional `authorityContext.domainOwners` / `raciNotes` on `CaseEnvelope` for authoritative role resolution (not Schema v1.0).

### 1.5 Upsert fix

Same authority **kind** may now carry **distinct** domain roleLabels (e.g. President Final acceptance + President RC/SMS follow-up). Idempotency keyed by stable id / exact roleLabel.

---

## 2. Explicitly deferred

- Eval D04 domain-equivalence  
- Semantic Refill / GC02 D05 / NSF / D10b  
- Live Golden rerun  
- Pipeline / Prompt / Schema / Gate / Spec edits  

---

## 3. Tests

New: `__tests__/mdd-decision-policy-v0.2.test.ts`

| Coverage | Status |
| --- | --- |
| AD-INSPECT-RC trigger / reuse / resolved upsert / unresolved | PASS |
| AD-FINANCE-SHIPFUND trigger / reuse / resolved upsert / unresolved | PASS |
| Org fallback off by default; on only when configured + audited | PASS |
| No Golden/vessel-specific authority insertion | PASS |
| Review false→true / true→false | PASS |
| LLM MR alone does not force Review | PASS |
| Original suggestions auditable; assembled Canonical OK | PASS |
| Idempotency | PASS |

Regressions (Control v0.1 / v0.1.1, Pipeline v0.1.2, Gate, Schema, Golden eval, Structured Outputs): **green**.

```text
Test Files  9 passed
Tests       78 passed
```

---

## 4. Key files

- `lib/mdd/decision-control/authority-domains-v0.2.ts` (new)
- `lib/mdd/decision-control/review-candidate-v0.2.ts` (new)
- `lib/mdd/decision-control/org-defaults.ts` (new)
- `lib/mdd/decision-control/apply-v0.1.ts` (wired)
- `lib/mdd/case-envelope/current-decision-question.ts` (`authorityContext`)
- `__tests__/mdd-decision-policy-v0.2.test.ts` (new)
- `docs/mdd/DECISION_POLICY_v0.2_IMPLEMENTATION_REPORT.md` (this file)

---

## 5. Expected effect on prior live residuals (not live-verified)

| Residual | Expected after v0.2 (with Context or org defaults as applicable) |
| --- | --- |
| GC03 D04 | Improves when RC domain resolves (Context or `ORG_DEFAULT_RC_SMS_OWNER=DP`) |
| GC04 D04 | Improves when Ship Fund domain resolves (Context or `ORG_DEFAULT_SHIP_FUND_OWNER=Master`) |
| GC04 D11 | Should clear: unsupported MR no longer forces Review=true |
| GC02 D05/D10b | Unchanged (deferred) |

Without org defaults and without `authorityContext`, domains may correctly emit `AUTHORITY_DOMAIN_UNRESOLVED` rather than inventing Golden roles.

---

## 6. Stop

Implementation complete. Deterministic tests green. **No live LLM rerun** until review.
