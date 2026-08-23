# MDD Structured Output Schema v1.0

**Status:** **Frozen** — human-readable SSoT (clarifications of 23 Aug 2026 incorporated).  
**Machine-readable implementation:** `lib/mdd/schema/structured-output-v1.ts`  
**Scope:** Engine / LLM **structured output only** (Decision Preparation payload).  
**Out of scope:** Production LLM connection, UI rewrite, Case Status workflow redesign.

**Upstream SSoT (must not contradict):**

- `docs/mdd/SYSTEM_PROMPT_v1.0.md` (frozen)
- `docs/mdd/GOLDEN_CASE_SPECIFICATION_v1.0.md` (frozen)
- Phase 1 domain model: `lib/mdd/types.ts` (compatibility target; see §7)

**Versioning rule:** Schema changes require `v1.1+` and human approval. AI must not silently reshape fields.

---

## 1. Schema overview

### 1.1 Purpose

`MddStructuredOutput` is the **canonical Decision Brief payload** produced by Analyze (heuristic today; LLM later). It preserves System Prompt decision structure and Golden Case acceptance dimensions.

It is **not** the full case record. Case Status, intake text, human confirmation flags, and timestamps live on the **Case envelope** (outside this schema, or in a thin wrapper).

### 1.2 Layering

```
┌─────────────────────────────────────────────────────────┐
│ Case envelope (persistence / UI workflow)               │
│  id, status, pastedText, humanConfirmed*, closedAt…     │
└───────────────────────────┬─────────────────────────────┘
                            │ embeds / attaches
┌───────────────────────────▼─────────────────────────────┐
│ MddStructuredOutput v1.0  ← THIS SCHEMA                 │
│  classification + executive + facts + gate + extensions │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Internal data vs UI prose

| Layer | Role | Examples |
| --- | --- | --- |
| **Structured (canonical)** | Machine-validated decision structure; Golden Lab acceptance | `primaryCaseType`, `decisionReadiness`, `decisionAuthorities[]`, `qualityGate`, `reviewCandidate`, fact classifications, extension flags |
| **UI prose (display)** | Human-readable sentences for President 30-second view | `recommendation.text`, `presidentDecision.text`, `why.text`, `nextActions[].text` |
| **Debug only (non-canonical)** | Optional diagnostics; **never** acceptance SSoT | `debug.engineNotes`, `debug.rawModelTrace` |

**Rule:** If structured field and prose disagree, **structured wins** for readiness / type / gate / authorities / reviewCandidate. Prose must not invent authorities, readiness, or closed-compliance claims absent from structured data.

### 1.4 Top-level shape

```
MddStructuredOutput
├── schemaVersion: "1.0"
├── primaryCaseType          (required enum)
├── tags                     (required array; may be empty)
├── executive                (required — 30-second order)
│   ├── recommendation
│   ├── presidentDecision
│   ├── decisionReadiness
│   ├── decisionAuthorities[]
│   ├── why
│   └── nextActions[]
├── facts                    (required)
│   ├── confirmed[]
│   ├── unverified[]
│   ├── assumptions[]
│   └── missingInformation[]   ← Who / What / Evidence required per item
├── risks[]                  (required array; may be empty — do not invent)
├── options[]                (required array; may be empty — do not invent)
├── professionalBoundaries[] (required array; may be empty — do not invent)
├── qualityGate              (required)
├── reviewCandidate          (required record/flag — NOT Case Status)
├── learning                 (required object; flags may be false)
├── finance?                 (optional extension — omit when N/A)
├── inspectionIsm?           (optional extension — omit when N/A)
└── debug?                   (optional; non-canonical)
```

**No `rawAiPayload` as primary.** Optional `debug` may hold traces, but acceptance and UI must bind to named fields above.

---

## 2. Field definitions

### 2.1 Root

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `"1.0"` | Schema identity. Reject unknown versions. |
| `primaryCaseType` | `CaseType` | Exactly one Primary Type (principal decision). |
| `tags` | `string[]` | Secondary dimensions only; never replace Primary Type. |
| `executive` | `ExecutiveDecision` | System Prompt OUTPUT order 1–6. |
| `facts` | `FactBundle` | Fact discipline buckets. |
| `risks` | `string[]` | Material risks (short statements). **May be `[]`.** Do not invent filler risks. |
| `options` | `OptionItem[]` | Genuine alternatives only. **May be `[]`.** Do not invent artificial options. |
| `professionalBoundaries` | `ProfessionalBoundaryItem[]` | Specialist limits / escalation. **May be `[]`.** Do not invent boundaries. |
| `qualityGate` | `QualityGate` | Critical failures + warnings + pass. |
| `reviewCandidate` | `ReviewCandidate` | Flag/record; independent of Case Status. |
| `learning` | `ManagementLearning` | CA/PA/EV/Horizontal/IA/MR/Knowledge flags. |
| `finance` | `FinanceExtension?` | Optional; Finance cases / CTM-like. |
| `inspectionIsm` | `InspectionIsmExtension?` | Optional; Inspection/ISM learning depth. |
| `debug` | `DebugExtension?` | Non-canonical. |

### 2.2 `executive` (UI prose + structured readiness/authorities)

| Field | Type | Description |
| --- | --- | --- |
| `recommendation` | `ProseBlock` | Supported direction; may reference options. |
| `presidentDecision` | `PresidentDecisionBlock` | What President must decide **now**, or explicit not-required. |
| `decisionReadiness` | `DecisionReadiness` | `READY` \| `CONDITIONAL` \| `NOT_READY` only. |
| `decisionAuthorities` | `DecisionAuthorityItem[]` | **Multiple** role→authority pairs. Min 1. |
| `why` | `ProseBlock` | Short rationale for readiness + direction. |
| `nextActions` | `NextActionItem[]` | Who / What / due or trigger. |

#### `ProseBlock`

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Display prose (non-empty when block required). |
| `intentKeys` | `string[]?` | Optional stable tokens for Golden acceptance (not shown to President). |

#### `PresidentDecisionBlock` extends prose

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | President-facing decision statement. |
| `requiredNow` | `boolean` | `false` ⇒ must use not-required phrasing. |
| `intentKeys` | `string[]?` | Optional acceptance tokens. |

When `requiredNow === false`, `text` MUST be semantically:  
`"President Decision: Not required at this stage."` (exact or approved equivalent).

#### `DecisionAuthorityItem`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable within output. |
| `roleLabel` | `string` | Work / responsibility label (e.g. “Root cause / SMS follow-up”). |
| `authority` | `AuthorityKind` | Enum role (see §4). Prefer enum; avoid free text. |
| `authorityDetail` | `string?` | Optional qualifier (e.g. “CSI”, “Tech Supt Haruyama”). |
| `notes` | `string?` | Boundary notes for that pair. |
| `status` | `AuthorityItemStatus` | `pending` \| `confirmed` \| `not_required`. |

**Separation:** Readiness ≠ Authority. Authorities list who owns which slice; readiness is whether President decision is supportable.

#### `NextActionItem`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable within output. |
| `who` | `string` | Owner / role. |
| `what` | `string` | Action text. |
| `dueOrTrigger` | `string?` | Due date **or** trigger (e.g. “before remittance date”). |
| `status` | `ActionStatus` | `open` \| `done`. |

### 2.3 `facts`

| Field | Type | Description |
| --- | --- | --- |
| `confirmed` | `FactItem[]` | Confirmed Fact. |
| `unverified` | `FactItem[]` | Reported but Unverified. |
| `assumptions` | `FactItem[]` | Labeled assumptions / hypotheses. |
| `missingInformation` | `MissingInformationItem[]` | Missing; **Who / What / Evidence required**. |

#### `FactItem` (confirmed / unverified / assumption)

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable within output. |
| `text` | `string` | Fact statement. |
| `classification` | fixed by parent array | Implied by bucket; may be echoed for clarity. |
| `hypothesis` | `boolean?` | `true` for analytical hypothesis (must not be treated as confirmed system weakness). |

#### `MissingInformationItem` (**stricter**)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes | Stable id. |
| `text` | `string` | yes | Short label of the gap. |
| `who` | `string` | **yes** | Who must confirm. |
| `what` | `string` | **yes** | What must be confirmed. |
| `evidenceRequired` | `string` | **yes** | Evidence required. |
| `blocksReadiness` | `boolean?` | no | If true, contributes to NOT_READY / critical missing. |

### 2.4 `professionalBoundaries`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable id. |
| `domain` | `ProfessionalBoundaryDomain` | Class / Flag / Master / Superintendent / Medical / Legal / Other. |
| `issue` | `string` | What must not be substituted. |
| `evidenceNeeded` | `string?` | |
| `questionForAuthority` | `string?` | |
| `responsibleAuthority` | `AuthorityKind` \| `string` | |
| `escalationPath` | `string?` | |

### 2.5 `qualityGate`

| Field | Type | Description |
| --- | --- | --- |
| `passed` | `boolean` | `false` if any critical failure. |
| `criticalFailures` | `GateFinding[]` | Explicit critical failures (System Prompt list). |
| `warnings` | `GateFinding[]` | Non-blocking warnings. |
| `evaluatedAt` | `string` | ISO-8601. |

#### `GateFinding`

| Field | Type | Description |
| --- | --- | --- |
| `code` | `QualityGateCode` | Stable machine code (§4). |
| `message` | `string` | Human-readable. |
| `relatedFieldPaths` | `string[]?` | Optional JSON-pointer-like paths. |

### 2.5.1 `decisionReadiness` ↔ `qualityGate` consistency (normative)

| Rule | Statement |
| --- | --- |
| **R1** | `qualityGate.passed` MUST equal `(criticalFailures.length === 0)`. |
| **R2** | If `criticalFailures.length > 0`, then `executive.decisionReadiness === "READY"` is **invalid**. |
| **R3** | With critical failures, readiness MUST be `NOT_READY` or `CONDITIONAL` only when remaining issues are confirmations/conditions that do **not** include unresolved Safety/Compliance/Boundary criticals that the gate codes as blocking READY; in all cases **READY is forbidden**. |
| **R4** | If `decisionReadiness === "READY"`, then `criticalFailures` MUST be `[]` and `passed === true`. |

### 2.6 `reviewCandidate` (flag/record — **not** Case Status)

| Field | Type | Description |
| --- | --- | --- |
| `flag` | `boolean` | Proposal to place the Case on the **Review Candidate path**. |
| `reason` | `string?` | Why flagged (or why not, optional). |
| `retainAfterClose` | `boolean` | Default `true` when `flag === true` (GC03). |
| `monitorOnly` | `boolean?` | Soft “monitor” without committing the Review Candidate path (GC02). |

**Forbidden:** Encoding review as `CaseStatus`. Case Status remains workflow-only (`NEW`, `ANALYZING`, …).

### 2.7 `learning` (always present; cheap defaults)

`learning` is the **analytical evaluation** of management-learning relevance (CA/PA/EV/Horizontal/IA/MR/Knowledge).  
It is **not** the workflow flag that puts a case on the Review Candidate path.

| Field | Type | Description |
| --- | --- | --- |
| `correctiveAction` | `boolean` | |
| `preventiveAction` | `boolean` | |
| `effectivenessVerification` | `boolean` | |
| `horizontalCheck` | `boolean` | |
| `fleetWideRelevance` | `FleetWideRelevance` | `yes` \| `possible` \| `no` |
| `internalAuditCandidate` | `boolean` | Analytical IA relevance. |
| `managementReviewCandidate` | `boolean` | Analytical MR relevance. |
| `knowledgeUpdateCandidate` | `boolean` | |
| `notes` | `string?` | Secondary prose. |

Ordinary one-off cases: keep flags false / `fleetWideRelevance: "no"`; do not over-escalate.

#### 2.7.1 Consistency: `learning` ↔ `reviewCandidate`

| Concept | Meaning |
| --- | --- |
| `learning` | Analytical evaluation of management-learning relevance. |
| `reviewCandidate` | Proposal/flag to place the Case into the Review Candidate path. |

**Normative consistency:**

1. If `learning.managementReviewCandidate === true`, then `reviewCandidate.flag` MUST normally be `true`.
2. Soft **MONITOR** (e.g. GC02 `monitorOnly: true` without hard MR) MAY keep `reviewCandidate.flag === false` even when light learning interest exists.
3. `reviewCandidate.flag === true` does **not** require every learning boolean to be true.
4. `internalAuditCandidate` alone does not force `reviewCandidate.flag` (may still recommend flag when IA+system learning warrant it).
5. Never encode either concept as Case Status.

### 2.8 Optional `finance` extension

Present only when finance judgment is material (typically `FINANCE_COMMERCIAL`). **Must not** appear as required base fields.

| Field | Type | Description |
| --- | --- | --- |
| `vesselOperationalRequirement` | `MoneyView?` | Necessary (vessel/ops side). Prefer `origin: "derived"` when calculated. |
| `companyFinancialFeasibility` | `FeasibilityView?` | Affordable (company side). |
| `separationPreserved` | `boolean` | Must be `true` when finance extension present (Necessary ≠ Affordable). |
| `sourceFacts` | `FinanceSourceFacts?` | **Input / reported / stated** figures only. |
| `derivedValues` | `FinanceDerivedValues?` | **Calculated** figures only. |
| `snapshot` | `FinanceSnapshot?` | Legacy flat mirror for Phase 1 intake compatibility; if used with source/derived, must not contradict them. |
| `hardDependencies` | `string[]?` | e.g. CSI after Miyuki confirmation. |
| `doNotAuthorizePayment` | `boolean` | Always `true` in Phase 1 outputs. |
| `forecastsLabeledAsNonAccounting` | `boolean` | Always `true` when forecasts referenced. |

#### Source vs derived (normative)

| Kind | Examples | Allowed in `facts.confirmed`? |
| --- | --- | --- |
| **Source / input** | Reported Ship Fund carry forward; pending provision amount as reported; stated Standard/Recovery CTM; stated target closing; stated liquidity note | Yes, when truly confirmed inputs |
| **Derived / calculated** | Adjusted balance from reported − pending; vessel-required ≈ to hit target; scenario projections | **No** — place under `finance.derivedValues` (and/or labeled assumption). Never as Confirmed Fact |

#### `MoneyView`

| Field | Type |
| --- | --- |
| `amount` | `number?` |
| `currency` | `string` (default `"USD"`) |
| `label` | `string` |
| `asOf` | `string?` |
| `origin` | `"source"` \| `"derived"` | Required when `amount` is present. |

#### `FeasibilityView`

| Field | Type |
| --- | --- |
| `liquidityConfirmed` | `boolean` |
| `note` | `string?` |
| `blockingIfUnconfirmed` | `boolean` |

#### `FinanceSourceFacts` (input)

Optional: `reportedShipFund`, `pendingExpenses`, `targetClosing`, `standardCtm`, `recoveryCtm`, `companyLiquidityNote`, `companyLiquidityConfirmed`, `asOfDate`, `notes`.

#### `FinanceDerivedValues` (calculated)

Optional: `adjustedBalance`, `vesselRequiredApprox`, `recommendedCtm`, `scenarioNotes` (projections). Each numeric SHOULD be clearly derived; none may be copied into `facts.confirmed`.

#### `FinanceSnapshot` (Phase 1 compatibility mirror)

Flat optional fields matching today’s intake: `reportedShipFund`, `pendingExpenses`, `adjustedBalance`, `targetClosing`, `standardCtm`, `recoveryCtm`, `vesselRequiredApprox`, `recommendedCtm`, `companyLiquidityNote`, `companyLiquidityConfirmed`, `asOfDate`, `notes`. Prefer populating `sourceFacts` + `derivedValues` going forward.

### 2.9 Optional `inspectionIsm` extension

Use for Inspection / Compliance / ISM **depth** without a separate workflow. Omit when irrelevant.

| Field | Type | Description |
| --- | --- | --- |
| `rootCauseChallengeRequired` | `boolean` | Challenge shallow RC. |
| `shallowRootCauseRejected` | `boolean?` | Explicit rejection of “human error” etc. without Person→Procedure→Trigger→Verification→Failure Point. |
| `horizontalCheckExpected` | `boolean` | |
| `effectivenessVerificationExpected` | `boolean` | |
| `photoAloneInsufficient` | `boolean` | Do not close on photos alone. |
| `systemWeaknessHypothesis` | `string?` | Hypothesis text; must not be copied into `facts.confirmed`. |
| `personProcedureChain` | `string?` | Optional structured RC lens note. |

### 2.10 Optional `debug` (non-canonical)

| Field | Type | Description |
| --- | --- | --- |
| `engine` | `"heuristic"` \| `"llm"` \| `string` | |
| `engineNotes` | `string?` | |
| `rawModelTrace` | `unknown?` | **Never** primary SSoT; strip in Golden acceptance. |

### 2.11 Case envelope fields **outside** this schema

Kept on `MddCase` (or equivalent), not inside structured output:

- `id`, `title`, `vessel`, `status` (Case Status)
- `pastedText`, `contextPack`, intake `financeSnapshot` (source input)
- Human confirmation: `primaryCaseTypeConfirmed`, `tagsConfirmed`, `recommendationConfirmed`, `presidentDecisionConfirmed`, `reviewCandidateConfirmed`
- `goldenCaseId`, `createdAt`, `updatedAt`, `closedAt`

Analyze maps **into** `MddStructuredOutput`; UI confirmation updates the envelope.

---

## 3. Required vs optional

### 3.1 Always required (base)

- `schemaVersion`
- `primaryCaseType`
- `tags` (array; may be `[]`)
- `executive` and all six children (`recommendation`, `presidentDecision`, `decisionReadiness`, `decisionAuthorities` (≥1), `why`, `nextActions` (array; may be `[]` only if President Decision not required **and** no open work — prefer ≥1 when work remains)
- `facts` (all four arrays present; may be empty except when gate/readiness demands missing items)
- `risks`, `options`, `professionalBoundaries` (arrays **present**; **may be empty**; **do not invent** content to fill them)
- `qualityGate` (`passed`, `criticalFailures`, `warnings`, `evaluatedAt`)
- `reviewCandidate` (`flag`, `retainAfterClose`)
- `learning` (all boolean/enum flags)

### 3.2 Conditionally required

| Condition | Requirement |
| --- | --- |
| Any material gap | corresponding `missingInformation[]` items with **who / what / evidenceRequired** |
| `decisionReadiness === "NOT_READY"` | ≥1 critical failure **or** ≥1 `missingInformation` with `blocksReadiness: true` (or equivalent critical code) |
| `presidentDecision.requiredNow === false` | not-required text |
| Specialist judgment in play | Prefer ≥1 `professionalBoundaries[]`; if none apply, leave `[]` — do not invent |
| Genuine alternatives exist | Prefer non-empty `options[]`; if compliance leaves no meaningful choice, leave `[]` — do not invent |
| Finance material | `finance` present; `separationPreserved === true` |
| Inspection/ISM depth | `inspectionIsm` present when IA/ASI/RC/horizontal themes apply (GC03) |

### 3.3 Optional

- `finance`, `inspectionIsm`, `debug`
- prose `intentKeys`
- most `?` fields in extensions
- `authorityDetail`, `notes`, `dueOrTrigger`, `hypothesis`, `monitorOnly`, `reason`

---

## 4. Enum definitions

### 4.1 `CaseType`

`OPERATIONAL` | `TECHNICAL` | `CREW_MANNING` | `FINANCE_COMMERCIAL` | `INSPECTION_COMPLIANCE` | `ISM_MANAGEMENT`

### 4.2 `DecisionReadiness`

`READY` | `CONDITIONAL` | `NOT_READY`

### 4.3 `AuthorityKind`

`President/DP` | `Superintendent` | `Master` | `Owner` | `Manning Agent` | `Class` | `Flag Administration` | `Finance/Accounting` | `External Authority` | `Other`

### 4.4 `AuthorityItemStatus`

`pending` | `confirmed` | `not_required`

### 4.5 `ActionStatus`

`open` | `done`

### 4.6 `FleetWideRelevance`

`yes` | `possible` | `no`

### 4.7 `ProfessionalBoundaryDomain`

`Class` | `Flag` | `Master` | `Superintendent` | `Medical` | `Legal` | `Other`

### 4.8 `QualityGateCode` (critical / warning)

**Critical (System Prompt):**

| Code | Meaning |
| --- | --- |
| `CRITICAL_FACT_MISSING` | Critical material fact missing |
| `SAFETY_OR_COMPLIANCE_UNRESOLVED` | Safety or Compliance unresolved |
| `DECISION_AUTHORITY_UNCLEAR` | Decision Authority unclear |
| `PROFESSIONAL_BOUNDARY_VIOLATION` | Professional Boundary violation |
| `RECOMMENDATION_UNSUPPORTED` | Recommendation unsupported |
| `FINANCIAL_DEPENDENCY_UNRESOLVED` | Required financial dependency unresolved |
| `FACT_RECOMMENDATION_CONTRADICTION` | Material contradiction between facts and recommendation |

**Warnings (non-exhaustive; extensible with `WARN_*` prefix):**

| Code | Meaning |
| --- | --- |
| `WARN_SHALLOW_ROOT_CAUSE` | Shallow RC language present |
| `WARN_HYPOTHESIS_AS_FACT_RISK` | Hypothesis may be overstated |
| `WARN_OPTIONAL_DETAIL_MISSING` | Non-blocking missing detail |
| `WARN_MONITOR_REVIEW` | Soft review/monitor suggested |

### 4.9 `schemaVersion`

`"1.0"` only for this document.

### 4.10 Case Status (envelope only — **not** in structured output)

`NEW` | `ANALYZING` | `WAITING_FOR_INFORMATION` | `DECISION_REQUIRED` | `ACTION_IN_PROGRESS` | `MONITORING` | `CLOSED`

---

## 5. Example JSON

### 5.1 Non-Finance — GC03-shaped (`INSPECTION_COMPLIANCE`)

```json
{
  "schemaVersion": "1.0",
  "primaryCaseType": "INSPECTION_COMPLIANCE",
  "tags": [
    "orbit",
    "panama_flag",
    "recordkeeping",
    "document_control",
    "root_cause_required",
    "horizontal_check",
    "effectiveness_verification",
    "system_weakness",
    "internal_audit_candidate",
    "management_review_candidate"
  ],
  "executive": {
    "recommendation": {
      "text": "Immediately rectify all Internal Audit and Panama ASI items with evidence. In parallel, challenge shallow root causes, run horizontal checks, set preventive actions, verify effectiveness, and escalate electrical items to Technical Superintendent.",
      "intentKeys": ["rectify", "root_cause", "horizontal", "effectiveness"]
    },
    "presidentDecision": {
      "requiredNow": true,
      "text": "Do not treat the case as closed merely because individual items were corrected or photographs submitted. Require immediate rectification plus deeper root-cause review, horizontal checks, and effectiveness verification for recurring or system-type weaknesses.",
      "intentKeys": ["not_closed_on_photos", "root_cause", "horizontal"]
    },
    "decisionReadiness": "CONDITIONAL",
    "decisionAuthorities": [
      {
        "id": "auth_1",
        "roleLabel": "Onboard corrective execution",
        "authority": "Master",
        "status": "pending"
      },
      {
        "id": "auth_2",
        "roleLabel": "Technical verification of electrical earth fault and technical defects",
        "authority": "Superintendent",
        "status": "pending"
      },
      {
        "id": "auth_3",
        "roleLabel": "Root cause / SMS / audit follow-up",
        "authority": "President/DP",
        "status": "pending"
      },
      {
        "id": "auth_4",
        "roleLabel": "Final acceptance of Company closure / management follow-up",
        "authority": "President/DP",
        "status": "pending"
      }
    ],
    "why": {
      "text": "Immediate corrective direction is clear, but closure is not ready until root-cause quality, horizontal-check results, and evidence are verified."
    },
    "nextActions": [
      {
        "id": "act_1",
        "who": "Master",
        "what": "Complete immediate rectifications with before/after evidence.",
        "dueOrTrigger": "before evidence submission to Flag/Company",
        "status": "open"
      },
      {
        "id": "act_2",
        "who": "Company/DP",
        "what": "Challenge CR-5 root causes; open horizontal checks.",
        "status": "open"
      },
      {
        "id": "act_3",
        "who": "Technical Superintendent",
        "what": "Escalate earth fault for technical verification.",
        "status": "open"
      }
    ]
  },
  "facts": {
    "confirmed": [
      {
        "id": "f_c1",
        "text": "Company Internal Audit on 18 Aug 2026 recorded CR-4 deficiencies onboard ORBIT.",
        "classification": "confirmed"
      },
      {
        "id": "f_c2",
        "text": "Panama ASI issued non-official deficiencies/observations requesting prompt rectification and before/after evidence.",
        "classification": "confirmed"
      }
    ],
    "unverified": [
      {
        "id": "f_u1",
        "text": "Vessel-stated CR-5 causes and CR-6 corrections are not yet proven effective.",
        "classification": "unverified"
      }
    ],
    "assumptions": [
      {
        "id": "f_a1",
        "text": "Combined IA + ASI signals may indicate broader system weakness.",
        "classification": "assumption",
        "hypothesis": true
      }
    ],
    "missingInformation": [
      {
        "id": "f_m1",
        "text": "Work/Rest Hours evidence sample",
        "who": "Master / C/E",
        "what": "Representative Work/Rest records covering bunkering remarks practice",
        "evidenceRequired": "Signed Work/Rest extracts",
        "blocksReadiness": false
      },
      {
        "id": "f_m2",
        "text": "Earth fault technical closure",
        "who": "Technical Superintendent",
        "what": "Technical verification that earth fault is cleared",
        "evidenceRequired": "Tech Supt confirmation (not photos alone)",
        "blocksReadiness": true
      }
    ]
  },
  "risks": [
    "Premature closure on photographs",
    "Recurrence if shallow root causes accepted"
  ],
  "options": [
    {
      "id": "opt_1",
      "title": "Rectify + system follow-up",
      "summary": "Immediate correction with evidence plus RC/horizontal/effectiveness."
    },
    {
      "id": "opt_2",
      "title": "Rectify only",
      "summary": "Close on item correction alone — rejected for system-type items."
    }
  ],
  "professionalBoundaries": [
    {
      "id": "pb_1",
      "domain": "Superintendent",
      "issue": "Do not declare electrical/earth-fault closed from photographs alone.",
      "responsibleAuthority": "Superintendent",
      "escalationPath": "Master evidence → Tech Supt verification → Company closure acceptance"
    }
  ],
  "qualityGate": {
    "passed": true,
    "criticalFailures": [],
    "warnings": [
      {
        "code": "WARN_SHALLOW_ROOT_CAUSE",
        "message": "CR-5 language must be challenged before closure."
      }
    ],
    "evaluatedAt": "2026-08-23T00:00:00.000Z"
  },
  "reviewCandidate": {
    "flag": true,
    "reason": "Combined IA + ASI system-learning signal",
    "retainAfterClose": true
  },
  "learning": {
    "correctiveAction": true,
    "preventiveAction": true,
    "effectivenessVerification": true,
    "horizontalCheck": true,
    "fleetWideRelevance": "possible",
    "internalAuditCandidate": true,
    "managementReviewCandidate": true,
    "knowledgeUpdateCandidate": true,
    "notes": "Significant management learning expected from combined IA + ASI signals."
  },
  "inspectionIsm": {
    "rootCauseChallengeRequired": true,
    "shallowRootCauseRejected": true,
    "horizontalCheckExpected": true,
    "effectivenessVerificationExpected": true,
    "photoAloneInsufficient": true,
    "systemWeaknessHypothesis": "Possible recurring document-control / verification weakness across IA and ASI themes.",
    "personProcedureChain": "Person → Procedure → Trigger → Verification → Failure Point"
  }
}
```

### 5.2 Finance — GC04-shaped (`FINANCE_COMMERCIAL`)

```json
{
  "schemaVersion": "1.0",
  "primaryCaseType": "FINANCE_COMMERCIAL",
  "tags": [
    "pluto_leader",
    "financial_risk",
    "owner_interest",
    "ctm",
    "ship_fund",
    "company_liquidity"
  ],
  "executive": {
    "recommendation": {
      "text": "Vessel-side requirement to restore projected closing toward USD5,000 is approximately USD39,293; USD40,000 is the appropriate vessel-side operational recommendation. Final remittance remains subject to Company USD liquidity. Necessary ≠ Affordable — keep judgments separate. Do not remit CSI before Miyuki Kisen receipt confirmation.",
      "intentKeys": ["39293", "40000", "necessary_ne_affordable", "liquidity"]
    },
    "presidentDecision": {
      "requiredNow": true,
      "text": "Determine/approve the September CTM amount after comparing vessel requirement (~USD39,293) with Company USD liquidity. On currently supplied vessel-side figures, USD40,000 is preferred operationally, subject to liquidity.",
      "intentKeys": ["approve_ctm", "liquidity_subject"]
    },
    "decisionReadiness": "CONDITIONAL",
    "decisionAuthorities": [
      {
        "id": "auth_1",
        "roleLabel": "Ship Fund data / onboard requirement input",
        "authority": "Master",
        "status": "pending"
      },
      {
        "id": "auth_2",
        "roleLabel": "Company cash-position confirmation",
        "authority": "Finance/Accounting",
        "status": "pending"
      },
      {
        "id": "auth_3",
        "roleLabel": "Final CTM funding decision",
        "authority": "President/DP",
        "status": "pending"
      }
    ],
    "why": {
      "text": "Vessel-side requirement is sufficiently clear, but final approval requires current Company liquidity confirmation near the remittance date."
    },
    "nextActions": [
      {
        "id": "act_1",
        "who": "Finance/Accounting",
        "what": "Confirm Company USD liquidity near remittance date.",
        "dueOrTrigger": "near September CTM remittance date",
        "status": "open"
      },
      {
        "id": "act_2",
        "who": "President/DP",
        "what": "Approve final September CTM amount.",
        "dueOrTrigger": "after liquidity confirmation",
        "status": "open"
      }
    ]
  },
  "facts": {
    "confirmed": [
      {
        "id": "f_c1",
        "text": "Reported Ship Fund carry forward USD4,052.19.",
        "classification": "confirmed"
      },
      {
        "id": "f_c2",
        "text": "Pending Nansha provision reported ≈ USD9,591.98 (not yet reflected in carry forward).",
        "classification": "confirmed"
      },
      {
        "id": "f_c3",
        "text": "Target closing USD5,000; Standard CTM USD35,000; Recovery CTM USD40,000 (stated inputs).",
        "classification": "confirmed"
      }
    ],
    "unverified": [],
    "assumptions": [
      {
        "id": "f_a1",
        "text": "Reference projection scenarios (32k/35k/40k) are planning aids, not accounting facts.",
        "classification": "assumption",
        "hypothesis": false
      }
    ],
    "missingInformation": [
      {
        "id": "f_m1",
        "text": "Company USD liquidity at remittance",
        "who": "Finance/Accounting",
        "what": "Confirmed SMBC USD liquidity sufficient for selected CTM without endangering critical obligations",
        "evidenceRequired": "Current cash position confirmation near remittance date",
        "blocksReadiness": true
      },
      {
        "id": "f_m2",
        "text": "Final CTM delivery date / payee",
        "who": "Vessel / Agent",
        "what": "Exact Japanese port ETA and payee details when known",
        "evidenceRequired": "Schedule/agent advice",
        "blocksReadiness": false
      }
    ]
  },
  "risks": [
    "Ship Fund remains negative if CTM deferred",
    "Critical obligations endangered if CTM over-prioritized vs liquidity"
  ],
  "options": [
    {
      "id": "opt_1",
      "title": "CTM USD40,000",
      "summary": "Preferred vessel-side recovery toward USD5,000 target, if liquidity allows."
    },
    {
      "id": "opt_2",
      "title": "Lower CTM / deferred recovery",
      "summary": "If USD40,000 endangers critical obligations, select lower amount and defer deficit recovery."
    }
  ],
  "professionalBoundaries": [
    {
      "id": "pb_1",
      "domain": "Other",
      "issue": "Do not authorize bank transfers or treat forecasts as posted accounting facts.",
      "responsibleAuthority": "Finance/Accounting",
      "escalationPath": "Finance confirms → President approves amount only"
    }
  ],
  "qualityGate": {
    "passed": true,
    "criticalFailures": [],
    "warnings": [
      {
        "code": "WARN_OPTIONAL_DETAIL_MISSING",
        "message": "Company liquidity still unconfirmed; readiness remains CONDITIONAL."
      }
    ],
    "evaluatedAt": "2026-08-23T00:00:00.000Z"
  },
  "reviewCandidate": {
    "flag": false,
    "retainAfterClose": false
  },
  "learning": {
    "correctiveAction": false,
    "preventiveAction": false,
    "effectivenessVerification": false,
    "horizontalCheck": false,
    "fleetWideRelevance": "no",
    "internalAuditCandidate": false,
    "managementReviewCandidate": false,
    "knowledgeUpdateCandidate": true,
    "notes": "Compare actual CTM/Ship Fund result with forecast later. No automatic IA/MR merely because Ship Fund temporarily went negative."
  },
  "finance": {
    "separationPreserved": true,
    "doNotAuthorizePayment": true,
    "forecastsLabeledAsNonAccounting": true,
    "vesselOperationalRequirement": {
      "amount": 39293,
      "currency": "USD",
      "label": "Approx. vessel-side requirement to reach USD5,000 target",
      "origin": "derived"
    },
    "companyFinancialFeasibility": {
      "liquidityConfirmed": false,
      "note": "Company cash-flow needs take priority over accelerating Ship Fund recovery.",
      "blockingIfUnconfirmed": true
    },
    "sourceFacts": {
      "reportedShipFund": 4052.19,
      "pendingExpenses": 9591.98,
      "targetClosing": 5000,
      "standardCtm": 35000,
      "recoveryCtm": 40000,
      "companyLiquidityConfirmed": false
    },
    "derivedValues": {
      "adjustedBalance": -5539.79,
      "vesselRequiredApprox": 39293,
      "recommendedCtm": 40000,
      "scenarioNotes": "Reference projections 32k/35k/40k are planning aids, not accounting facts."
    },
    "hardDependencies": [
      "Do not remit CSI before Miyuki Kisen receipt confirmation"
    ]
  }
}
```

---

## 6. Validation rules

### 6.1 Structural

1. `schemaVersion === "1.0"`.
2. `primaryCaseType` ∈ CaseType enum (exactly one).
3. `decisionReadiness` ∈ {READY, CONDITIONAL, NOT_READY}.
4. `executive.decisionAuthorities.length >= 1`.
5. Every `missingInformation[]` item has non-empty `who`, `what`, `evidenceRequired`.
6. `qualityGate.passed === (criticalFailures.length === 0)`.
7. Arrays listed in §3.1 must be present (may be empty where allowed).

### 6.2 Semantic / Quality Gate / consistency

8. **READY ↔ criticalFailures (hard):** If `criticalFailures.length > 0`, then `executive.decisionReadiness === "READY"` is invalid. (§2.5.1 R2–R4)
9. If `decisionReadiness === "READY"`, then `criticalFailures` MUST be empty and `passed === true`.
10. Code `PROFESSIONAL_BOUNDARY_VIOLATION` → cannot be READY; typically NOT_READY.
11. Code `FINANCIAL_DEPENDENCY_UNRESOLVED` when liquidity required and unconfirmed → not READY (GC04 CONDITIONAL allowed if direction clear).
12. `recommendation` must not invent Safety emergency absent from `facts.confirmed` / input.
13. `options` / `risks` / `professionalBoundaries` must not be padded with invented filler merely to look non-empty.
14. If `finance` present → `separationPreserved === true` and `doNotAuthorizePayment === true`.
15. Derived finance values (`finance.derivedValues`, `MoneyView.origin === "derived"`) MUST NOT appear as `facts.confirmed`.
16. Hypothesis (`facts.assumptions[].hypothesis === true` or `inspectionIsm.systemWeaknessHypothesis`) MUST NOT be duplicated into `facts.confirmed`.
17. If `learning.managementReviewCandidate === true`, then `reviewCandidate.flag` MUST normally be `true` (MONITOR soft-path may keep `flag: false` with `monitorOnly: true`).
18. `reviewCandidate.flag` must not be mirrored as Case Status.
19. Tags must not override Primary Type (e.g. GC02: `inspection_compliance` tag OK; Primary remains `TECHNICAL`).
20. President must not be sole authority for purely delegable routine work when other authorities exist (Golden NG patterns).

### 6.3 Golden Lab acceptance mapping

Acceptance continues to evaluate **structure**, not exact prose:

`Case Type → Fact Separation → Missing Information → Authorities → Recommendation Boundary → President Decision → Readiness → Delegation → Professional Boundary → Management Learning / Review Flag`

Optional `intentKeys` may assist automated checks but are not required for human acceptance.

### 6.4 Forbidden

- Using `debug.rawModelTrace` / any free-form blob as acceptance source.
- Finance fields on the base object (must live under `finance`).
- Separate Inspection “workflow” object replacing `executive` (use `inspectionIsm` extension only).
- Encoding Review Candidate as status enum values.

---

## 7. Compatibility notes with Phase 1 domain model (`lib/mdd/types.ts`)

| Schema v1.0 | Phase 1 today | Mapping notes |
| --- | --- | --- |
| `MddStructuredOutput` | `DecisionBrief` + proposal head | Closest to `AnalyzeProposal` (`primaryCaseType`, `tags`, `brief`) |
| `executive.*` prose | `recommendation`, `presidentDecision`, `why` strings | Wrap as `{ text }` (additive); UI can keep reading `.text` |
| `executive.decisionReadiness` | `brief.decisionReadiness` | Identical enums |
| `executive.decisionAuthorities` | `DecisionAuthorityItem[]` | Add optional `authorityDetail`; keep `roleLabel` / `authority` / `status` |
| `executive.nextActions` | `ActionItem` (`text`, `owner`, `dueDate`) | Rename conceptually to `who`/`what`/`dueOrTrigger`; migrate with adapter |
| `facts.*` | `confirmedFacts`, `unverifiedFacts`, `assumptions`, `missingInformation` | Nest under `facts`; **require** who/what/evidence on missing |
| `qualityGate` | `QualityGateResult` | Upgrade `string[]` failures/warnings → `GateFinding[]` with `code` |
| `reviewCandidate` | `MddCase.reviewCandidateFlag` (+ confirmed) | Move flag into structured record; keep confirmation on Case envelope |
| `learning` | `ManagementLearning` | Compatible; already boolean/enum |
| `finance` | `MddCase.financeSnapshot` + prose | Snapshot remains intake and/or extension; separation flags are new |
| `inspectionIsm` | Partially in `learning.notes` / tags | New optional extension; no Phase 1 breaking require |
| `professionalBoundaries[]` | Mostly prose in learning notes | New structured array; Phase 1 can continue notes until adapter |
| `options` / `risks` | `options`, `risks` | Compatible |
| `delegation` | `DelegationItem[]` on brief | Prefer `nextActions` as canonical Who/What/due; treat old `delegation` as deprecated alias |
| Case Status | `MddCase.status` | Remains envelope-only; unchanged |
| Human confirmation booleans | on `MddCase` | Remain outside structured output |
| `schemaVersion` | absent | Add on adopt |
| `rawAiPayload` | absent | Keep absent as primary |

### 7.1 Adoption stance

1. **Human-readable SSoT:** this document (frozen).
2. **Machine-readable SSoT:** `lib/mdd/schema/structured-output-v1.ts` (Zod + types + `parseMddStructuredOutput`).
3. Phase 1 heuristic UI may continue using `DecisionBrief` until an adapter maps to/from Schema v1.0.
4. Production LLM remains disconnected; when connected later, LLM JSON MUST validate against Schema v1.0.

### 7.2 Explicit non-goals of Schema v1.0 (this freeze)

- Does not redefine Golden expected results.
- Does not change System Prompt text.
- Does not connect production LLM.
- Does not require immediate UI rewrite off `DecisionBrief`.

---

## 8. Document control

| Item | Value |
| --- | --- |
| Schema version | **1.0** (frozen) |
| Depends on | System Prompt v1.0, Golden Case Specification v1.0 |
| Machine implementation | `lib/mdd/schema/structured-output-v1.ts` |
| Change policy | Human-approved bump only (`v1.1+`) |

**End of Structured Output Schema v1.0**
