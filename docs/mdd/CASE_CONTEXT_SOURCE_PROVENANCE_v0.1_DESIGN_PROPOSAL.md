# Case Context Source Provenance v0.1 — Design Proposal Only

**Status:** DESIGN PROPOSAL — not implemented.  
**Date:** 2026-08-23  
**Accepted prerequisites (do not modify):** Decision Policy v0.2 · Pipeline v0.1.2 · System Prompt v1.0 · Canonical Schema v1.0 · Quality Gate Rules v1.1 · Golden Spec / Eval Rules  

**Evidence / context:** Policy v0.2 formally accepted. Live result retained GC01 Pass, GC03 Pass, GC04 D11 cleared, GC02 without new regression. Residual **GC04 D04** is classified as **`INPUT_CONTEXT_DEFICIENCY`**, not a Control-policy failure. AD-FINANCE-SHIPFUND correctly emitted `AUTHORITY_DOMAIN_UNRESOLVED` with org fallback disabled.

**Does not implement / does not run:** code changes · Golden expected outputs edits · org-default enablement · live LLM runs.

**Scope of this proposal:** Allow Case Envelope / Case Context to represent **who is the authoritative source/owner of material case facts** (especially financial source data), so Decision Control may resolve required authority domains from **provenance**, without guessing.

---

## 0. Positioning

| Concept | What it answers | Layer |
| --- | --- | --- |
| **Source Provenance** | Who authored / owns / vouches for a **fact** (evidence ownership) | Case Context / Envelope (input) |
| **Decision Authority** | Who must **decide / confirm** a duty in the structured output | Control + Schema `decisionAuthorities` |
| **Authority Domain** (Policy v0.2) | Which decision-authority **slot** must be present (e.g. `SHIP_FUND_SOURCE`) | Decision Policy (unchanged) |

**Normative separation:** Source Provenance describes **evidence ownership**. It is **not** Decision Authority by itself. Decision Control may use provenance as **one input** to authority-domain resolution (Case Context step), then upsert a concrete `{ authority, roleLabel }` only when that step succeeds.

Policy v0.2 resolver order for `SHIP_FUND_SOURCE` remains:

1. Domain required by AD-FINANCE-SHIPFUND  
2. Reuse existing covering authority  
3. **Case Context resolve** ← this proposal makes step 3 first-class and auditable  
4. Upsert if resolved  
5. `AUTHORITY_DOMAIN_UNRESOLVED` if not  
6. Optional org fallback (`ORG_DEFAULT_SHIP_FUND_OWNER`) — **not** enabled merely to pass Golden  

This document does **not** change that order or Policy v0.2 behavior; it proposes the **data** Case Context should carry so step 3 can succeed without regex-guessing from CDQ prose.

---

## A. Problem statement

### A.1 What is missing today

Case Envelope currently supports:

- `currentDecisionQuestion` (what decision / who decides / deferred)
- `authorityContext.domainOwners` (direct domain → `{authority, roleLabel}` map)
- `authorityContext.raciNotes` (free text)
- Finance numbers via Golden `financeSnapshot` / intake (`reportedShipFund`, etc.) **without** structured ownership

Numbers and narratives can exist while **no authoritative owner of those facts** is declared. AD-FINANCE-SHIPFUND then correctly leaves `SHIP_FUND_SOURCE` unresolved when Context and org fallback cannot name a role.

### A.2 What must not happen

| Anti-pattern | Why forbidden |
| --- | --- |
| Infer Master because “ships usually report Ship Fund via Master” | Maritime practice ≠ Case fact |
| Enable `ORG_DEFAULT_SHIP_FUND_OWNER=Master` to force Golden Pass | Org default is ops policy, not a test patch |
| Copy Spec **Expected Decision Authorities** into input as if it were provenance | Circular: expected output used to manufacture input that produces that output |
| Treat Source Provenance as automatic Decision Authority upsert without domain trigger | Collapses evidence ownership into decision RACI |

### A.3 Desired outcome

MDD can answer, for material facts:

> This value for domain **X** was supplied / owned by **role R** (entity E), under verification status **S**, as of **T**, with reference **Ref**.

When domain **X** maps to a required Authority Domain (e.g. `SHIP_FUND_SOURCE`), Control may resolve the Case Context step from that provenance **without inventing** a role.

---

## B. Proposed provenance data model (v0.1)

### B.1 Placement

Prefer a first-class Case Envelope field (Case Context), **not** Canonical Schema v1.0 output:

```text
CaseEnvelope.sourceProvenance?: SourceProvenanceRecord[]
```

Optional companion (narrow, domain-keyed cache for Control):

```text
CaseEnvelope.authorityContext.factOwners?: Partial<Record<ProvenanceDomainId, SourceProvenanceRef>>
```

`authorityContext.domainOwners` (Policy v0.2) remains the **resolved decision-authority** override when product already knows the authority slot. Provenance is the **evidence-side** input that may *feed* that resolution—not a duplicate of `decisionAuthorities`.

### B.2 Conceptual fields (design-level)

| Field | Intent | Required? |
| --- | --- | --- |
| `factDomain` | Stable domain of the fact (not Golden ID) | **yes** |
| `sourceRole` | Role that owns / authored / vouches for the fact (e.g. Master, Finance, Class surveyor) | **yes** to be “authoritative”; may be null → incomplete |
| `sourceEntity` | Named vessel / office / agent / person when known | optional |
| `evidenceRef` | Document / report / message id or label (e.g. “Ship's Fund Report”) | recommended |
| `verificationStatus` | How trusted the fact is in this case | **yes** |
| `capturedAt` | When the evidence was captured / received into MDD | optional |
| `asOf` | Business effective time of the figure (balance date, etc.) | optional |
| `notes` | Free text; never sole resolution basis if `sourceRole` empty | optional |

Illustrative TypeScript shape (design only):

```ts
type ProvenanceDomainId =
  | "SHIP_FUND_SOURCE"
  | "VESSEL_CASH_CTM"
  | "COMPANY_LIQUIDITY"
  | "CLASS_CONFIRMATION"
  | "FLAG_INSTRUCTION"
  | "MANNING_DOCUMENTATION"
  | "TECHNICAL_ASSESSMENT"
  | "GENERIC_FACT";

type VerificationStatus =
  | "reported"      // stated in source document / message
  | "estimated"     // explicitly estimate / not posted
  | "derived"       // calculated from other facts
  | "confirmed"     // independently verified for this case
  | "unverified"    // present but not vouched
  | "missing";      // domain known needed; no fact yet

type SourceProvenanceRecord = {
  factDomain: ProvenanceDomainId;
  sourceRole: string | null;       // null = role not established
  sourceEntity?: string | null;
  evidenceRef?: string | null;
  verificationStatus: VerificationStatus;
  capturedAt?: string | null;      // ISO-8601
  asOf?: string | null;            // ISO-8601 or business date
  relatedFactKeys?: string[];      // e.g. ["reportedShipFund", "pendingExpenses"]
  notes?: string | null;
};
```

### B.3 Fact domain catalog (generalization beyond GC04)

| `factDomain` | Typical facts | Example source roles (illustrative only) |
| --- | --- | --- |
| `SHIP_FUND_SOURCE` | Carry forward, pending onboard expenses, ship-fund report balances | Master; vessel accounts; C/E if company SOP says so **and** Context says so |
| `VESSEL_CASH_CTM` | CTM request amounts, onboard cash need, delivery timing from vessel/agent | Master; agent; Ops |
| `COMPANY_LIQUIDITY` | Company USD position, remittance feasibility | Finance / Accounting |
| `CLASS_CONFIRMATION` | Class written acceptance / scope reply | Class society; Superintendent as recipient/owner of confirmation chain |
| `FLAG_INSTRUCTION` | Flag / ASI written instruction | Flag / Master as recipient of instruction pack |
| `MANNING_DOCUMENTATION` | Crew docs, travel readiness, manning certificates | Manning agent; Master; HR |
| `TECHNICAL_ASSESSMENT` | Tech judgment on handling / open-up feasibility | Superintendent / C/E |

Catalog is **open for extension**; Control only consumes domains it already maps to Authority Domains (today: primarily `SHIP_FUND_SOURCE` ↔ AD-FINANCE-SHIPFUND). Other domains prepare GC02-class / manning / Flag cases without Policy v0.2 edits in this design.

### B.4 Verification status rules (v0.1)

| Status | May resolve `sourceRole` into Authority Domain? |
| --- | --- |
| `reported` / `confirmed` | **Yes**, if `sourceRole` non-empty |
| `estimated` | **Yes** for ownership of the *estimate*, with audit note that figure is estimate |
| `derived` | **No** as primary owner of base evidence; point `relatedFactKeys` at underlying reported facts |
| `unverified` | Resolve only if product policy later allows; default **No** for funding domains |
| `missing` | Never resolves; may support missing-info UX later |

### B.5 What Provenance is not

- Not a substitute for Schema `facts.confirmedFacts` / `unverifiedFacts` (those remain LLM/canonical narrative).  
- Not automatic Gate Criticals.  
- Not org RACI for **decisions** (final CTM remains President/DP via CDQ / existing authorities).  
- Not a license to rewrite Golden **expected** authorities.

---

## C. Resolver interaction (Policy v0.2 unchanged)

### C.1 How Control should consume provenance (design contract)

For `SHIP_FUND_SOURCE` Case Context step (Policy step 3), preferred resolution sources in order:

```text
3a. authorityContext.domainOwners.SHIP_FUND_SOURCE
    (explicit decision-authority override — already implemented)
3b. sourceProvenance[] where factDomain ∈ {SHIP_FUND_SOURCE, VESSEL_CASH_CTM}
    and sourceRole is non-empty
    and verificationStatus ∈ {reported, confirmed, estimated}
3c. Existing CDQ / raciNotes heuristics (Policy v0.2 as today)
3d. (stop — unresolved; org fallback only if enabled)
```

**Upsert mapping when 3b hits:**

| Provenance `sourceRole` (normalized) | Upserted `authority` | Example `roleLabel` |
| --- | --- | --- |
| Master / vessel Master | `Master` | `Ship Fund data / vessel cash evidence` |
| Chief Engineer / C/E | `ChiefEngineer` (or product kind map) | same domain label family |
| Vessel accounts / ship’s fund clerk | product-mapped kind | same |
| Unknown / empty | — | do not upsert |

Label wording remains product-controlled to stay Eval-compatible **when** enrichment is legitimate; this design does **not** require Eval changes.

### C.2 Audit expectations

When provenance drives resolution:

- `source: "case_context"` (or finer: `"case_context_provenance"`)  
- Audit fields: `factDomain`, `evidenceRef`, `verificationStatus`, `asOf`  
- Finding: none on success; still `AUTHORITY_DOMAIN_UNRESOLVED` when role absent  

### C.3 Explicit non-goals for this interaction

- Do not change AD-FINANCE-SHIPFUND triggers.  
- Do not change Review Candidate / MR hybrid.  
- Do not treat Spec Expected Authorities as provenance.  
- Do not enable org Master default in this design.

---

## D. GC04 factual source diagnosis

### D.1 Where ship-fund figures originate (from existing fixtures)

| Figure / claim | Origin in current Golden input | Role named in input? |
| --- | --- | --- |
| Carry Forward **USD4,052.19** | Narrative: “Ship's Fund Report showed a reported Carry Forward…” + `financeSnapshot.reportedShipFund` | **No** |
| Nansha provision **~USD9,591.98** | Narrative: estimated purchase “had not yet been reflected” + `pendingExpenses` | **No** (status = estimate / unreflected) |
| Adjusted ≈ **-USD5,539.79** | Derived from above | N/A (derived) |
| Target closing **USD5,000**, standard/recovery CTM, vessel-required ≈ **39293**, recommend **40000** | Case rules / Phase 1 manual FinanceSnapshot | **No** owner of vessel-side requirement as a person/role |
| Company liquidity unconfirmed | Explicit missing / Gate EXECUTION_CONDITION | Finance implied for *liquidity*, not for Ship Fund report |
| CDQ `expectedDecider` | President/DP — **final CTM funding**, not Ship Fund data ownership | Wrong domain for `SHIP_FUND_SOURCE` |

**Document-level origin:** a named artifact **“Ship's Fund Report”** plus Phase 1 **manually supplied** FinanceSnapshot.  
**Role-level origin:** **not established** in `inputFactsText`, CDQ envelope, or `authorityContext`.

### D.2 What the Golden Spec says (and what that is)

Golden Spec GC04 **Expected Decision Authorities** includes:

> Ship Fund data / onboard requirement — Master / vessel report

Golden Spec **Expected Delegation** includes “Master Ship Fund…”.

These are **acceptance / expected-output** criteria for D04 and related dims. They are **not** Case Context Source Provenance on the input envelope. Using them to populate `sourceRole: "Master"` would:

1. Invent input from expected output, and  
2. Violate Policy v0.2’s rule against resolving Master “because Spec says Ship Fund data.”

### D.3 Classification (retained)

| Item | Classification |
| --- | --- |
| GC04 residual D04 after Policy v0.2 | **`INPUT_CONTEXT_DEFICIENCY`** |
| AD-FINANCE-SHIPFUND → `AUTHORITY_DOMAIN_UNRESOLVED` | **Correct Control behavior** |
| Enabling `ORG_DEFAULT_SHIP_FUND_OWNER=Master` to pass Golden | **Rejected** for this path |

---

## E. Can GC04 Golden input be legitimately enriched?

### E.1 Verdict

**No — not from existing source facts alone.**

Existing GC04 input establishes:

- **what** was reported (Ship's Fund Report figures), and  
- **that** FinanceSnapshot was manually supplied,

but does **not** establish **who** (Master / C/E / vessel accounts / other) is the authoritative owner of that report.

Therefore this design **must not** propose adding `sourceRole: "Master"` (or any other role) to the Golden input envelope/context under current fixtures.

### E.2 What would make enrichment legitimate later

Any **one** of the following, as a deliberate product/content decision (out of scope to implement now):

1. **Upstream case material** (email, Ship's Fund Report header, SMS form) that names the reporting role — then encode that as provenance on intake.  
2. **Golden Spec input-facts revision** that *adds* an explicit input statement (e.g. “Master-submitted Ship's Fund Report dated …”) — distinct from Expected Authorities.  
3. **Operator-declared Context** at analyze time (`sourceProvenance` or `domainOwners`) reflecting real case knowledge.

Until then, unresolved `SHIP_FUND_SOURCE` remains the honest Phase 1 result for GC04-shaped envelopes without Context.

### E.3 Optional non-role enrichment (still design-only; not required)

If product wants partial provenance without inventing a role:

```text
factDomain: SHIP_FUND_SOURCE
sourceRole: null
evidenceRef: "Ship's Fund Report"
verificationStatus: reported   // carry forward
+ separate record for pending Nansha provision with verificationStatus: estimated
```

This documents evidence lineage for UX/audit but **still must not** resolve AD-FINANCE-SHIPFUND (no `sourceRole`).

---

## F. Worked examples (generalization)

### F.1 Ship Fund (GC04-shaped) — incomplete vs complete

**Incomplete (current Golden shape):**

```text
SHIP_FUND_SOURCE · sourceRole=null · evidenceRef="Ship's Fund Report" · reported
→ Case Context step fails → AUTHORITY_DOMAIN_UNRESOLVED (correct)
```

**Complete (hypothetical legitimate intake):**

```text
SHIP_FUND_SOURCE · sourceRole=Master · sourceEntity="PLUTO LEADER" ·
evidenceRef="Ship's Fund Report" · reported · asOf=2026-08-..
→ Case Context resolves → upsert Master / Ship Fund data domain
```

### F.2 Class confirmation (GC02-shaped)

```text
CLASS_CONFIRMATION · sourceRole=ClassNK · evidenceRef="written scope reply" ·
verificationStatus=missing|unverified
→ feeds future domain resolution / missing-info; not Decision Authority alone
```

### F.3 Flag instruction (GC03-shaped)

```text
FLAG_INSTRUCTION · sourceRole=Panama ASI · evidenceRef="non-official observations letter" ·
verificationStatus=reported
→ evidence ownership of observation text; closure acceptance remains separate Decision Authority
```

### F.4 Manning documentation (GC01-shaped)

```text
MANNING_DOCUMENTATION · sourceRole=Manning agent · verificationStatus=unverified
→ documents readiness ownership; postponement decision remains President/DP via CDQ
```

---

## G. Out of scope / deferred

| Item | Status |
| --- | --- |
| Implementation of `sourceProvenance` on Envelope | Deferred pending approval |
| GC04 Golden input enrichment with Master | **Not legitimate** under current facts |
| Org default Master | Explicitly **not** proposed |
| Policy v0.2 / Pipeline / Prompt / Schema / Gate / Eval edits | Forbidden in this task |
| Semantic Refill / GC02 D05 | Unrelated |
| Eval D04 domain-equivalence | Still deferred (Policy G4) |
| Live LLM rerun | Not in this task |

---

## H. Approval questions

### H1. Introduce Case Context Source Provenance v0.1 as designed?

**Question:** Approve adding a Case Envelope `sourceProvenance[]` model (factDomain, sourceRole, sourceEntity, evidenceRef, verificationStatus, capturedAt/asOf) as the SSoT for **evidence ownership**, separate from Decision Authority?

**Recommended answer:** **APPROVE** (design).

**Rationale:** Makes Policy v0.2 Case Context step auditable and generalized; stops relying on CDQ prose heuristics alone.

---

### H2. Resolver contract: provenance feeds Policy step 3 only when `sourceRole` is present?

**Question:** Approve that Control may resolve `SHIP_FUND_SOURCE` from provenance **only** when `sourceRole` is non-empty and verificationStatus ∈ {reported, confirmed, estimated}; otherwise remain unresolved (no inference)?

**Recommended answer:** **APPROVE**.

---

### H3. GC04 enrichment verdict?

**Question:** Confirm that existing GC04 source facts **do not** establish a Ship Fund owner/source role, so Golden input **must not** be enriched with Master (or any invented role) solely to clear D04?

**Recommended answer:** **CONFIRM** — residual D04 stays `INPUT_CONTEXT_DEFICIENCY` until real provenance or an explicit Spec **input-fact** addition supplies a role.

---

### H4. Relationship to `authorityContext.domainOwners`?

**Question:** Keep `domainOwners` as an optional **direct decision-authority override**, and treat `sourceProvenance` as the preferred evidence-side input that may populate or justify that override—without collapsing the two concepts?

**Recommended answer:** **APPROVE** dual fields with clear precedence (domainOwners → provenance → CDQ/raci heuristics → org fallback).

---

### H5. Implementation timing?

**Question:** Defer implementation until this design is accepted; no live rerun and no Policy v0.2 changes in the implementation slice?

**Recommended answer:** **APPROVE** defer.

---

## I. Stop condition

This document stops at:

1. Proposed provenance data model  
2. Resolver interaction (Policy v0.2 unchanged)  
3. GC04 factual source diagnosis  
4. Verdict that GC04 Golden input **cannot** legitimately be role-enriched from current facts  
5. Approval questions H1–H5  

**No implementation. No live LLM run. Decision Policy v0.2 unchanged.**
