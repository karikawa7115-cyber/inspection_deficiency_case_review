# MDD Golden Case Specification v1.0

Human-approved Acceptance Truth  
Date: 23 Aug 2026

The following specifications are the human-approved expected behavior for the four Golden Cases.  
The AI must NOT redefine these expected results.  
Exact wording does not have to match. Acceptance is based on preservation of the approved decision structure, boundaries, and intent.

---

## Acceptance Rule

The Golden Case Lab should evaluate decision-structure equivalence, not exact prose.

A run passes only when it preserves the human-approved essentials:

Case Type → Fact Separation → Missing Information → Authorities → Recommendation Boundary → President Decision → Readiness → Delegation → Professional Boundary → Management Learning / Review Flag

Minor wording differences and reasonable optional tags are acceptable.  
A structurally wrong decision must fail even if the prose sounds polished.

---

## GOLDEN CASE 01 — PLUTO LEADER — C/M Inoy Crew Change

### Input Facts

- Vessel: PLUTO LEADER.
- A Chief Mate change had originally been planned at Nansha, China around 19 Aug 2026.
- C/M Inoy could not be ready in time for embarkation at Nansha.
- Required documentation / travel preparation was not sufficiently ready for the planned Nansha change.
- The current Chief Mate could continue onboard; no immediate Safety or Minimum Safe Manning emergency requiring replacement at Nansha had been identified.
- The next practical plan was crew change in Japan during Voy.071 in late September 2026.
- Avoiding an additional overseas crew-change arrangement would reduce owner cost.
- The exact Japanese port / ETA was not yet finally fixed.
- Inoy's remaining documentation and travel readiness still required follow-up.

### Expected Primary Case Type

`CREW_MANNING`

### Expected Tags

Required / strongly expected: `pluto_leader`, `crew_change`  
Acceptable additional: `visa`, `owner_interest`, `operational_continuity`, `knowledge_update_candidate`  
Do not fail acceptance merely because a reasonable optional tag is absent.

### Expected Decision Authorities

- Crew-change/document coordination — Manning Agent / CSI
- Continuation onboard — Master / current Chief Mate as applicable
- Final management approval of postponement — President

The President should NOT be assigned responsibility for routine visa/document chasing.

### Expected President Decision

Approve postponing the Chief Mate change from Nansha and plan the change in Japan in late September.  
Semantically equivalent formulation is acceptable.

### Expected Recommendation

Recommend postponing the crew change to Japan rather than forcing an impractical Nansha change, based on:

- Nansha change no longer practically achievable
- no immediate manning/safety necessity for replacement at Nansha
- Japan more reliable and lower-cost

Do NOT recommend extraordinary cost/disruption merely to preserve the original Nansha plan.

### Expected Readiness

`READY`  
Core management decision can be made even though later execution details remain.

### Expected Fact Separation

Confirmed: Inoy cannot board at Nansha; current C/M can continue; Japan late September is next intended opportunity.  
Missing must not auto-force NOT_READY: exact JP port/ETA; final Inoy document readiness; Manning Agent deadline; continuation confirmation where required.

### Expected Missing Information

Who / What / Evidence for Manning Agent, vessel schedule, current Chief Mate as appropriate (port/ETA, document readiness, continuation).

### Expected Delegation

Present. CSI docs; vessel/schedule JP port/ETA; Master/C/M continuation; President only necessary management decision.

### Expected Professional Boundary

No special Class/Flag/technical judgment required. Do not invent statutory/medical barriers absent from facts.

### Expected Management Learning

Low-level learning acceptable. Not a major system issue from this case alone.

### Review Candidate Expectation

`NO`

### NG Patterns

- President personally managing every visa/document task
- Insist on Nansha despite impossibility
- NOT_READY solely because JP port not finalized
- Invent safety emergency
- Unnecessary MR escalation for ordinary crew-change planning

---

## GOLDEN CASE 02 — FAIRWIND — NK CMS Handling

### Input Facts

- Vessel: FAIRWIND.
- CMS-related machinery survey / due-item issue required clarification.
- ClassNK advised in substance that C/E could carry out required open-up/inspection by due date and ClassNK could verify at next relevant survey.
- Technical Superintendent Haruyama considered this approach acceptable.
- Owner-side Superintendent Kashiwabara remained concerned some machinery / "足回り" items might not practically be open-inspected by C/E alone.
- Kashiwabara requested another clarification from ClassNK.
- Issue is whether proposed technical handling and scope of Class acceptance are valid for actual CMS items.

### Expected Primary Case Type

`TECHNICAL`  
(`inspection_compliance` may be a tag, must NOT replace Primary Type)

### Expected Tags

Required: `fairwind`, `class_nk`, `maintenance`  
Acceptable: `cms`, `owner_interest`, `knowledge_update_candidate`, `inspection_compliance`

### Expected Decision Authorities

- Technical assessment — Technical Superintendent
- Class acceptance / interpretation — ClassNK
- Final management confirmation / communication direction — President

Do not replace Class acceptance with owner opinion.

### Expected President Decision

Maintain current handling plan, subject to one focused re-confirmation with ClassNK addressing Kashiwabara's specific concern.  
President is NOT expected to make machinery/Class technical judgment personally.

### Expected Recommendation

Do not abandon existing approach without evidence; obtain one narrow written ClassNK clarification; then close interpretive gap.  
Do NOT recommend unnecessary Class attendance for every item merely because concern exists.

### Expected Readiness

`CONDITIONAL` — likely course clear; specific Class acceptance question remains.

### Expected Fact Separation

Confirmed: prior favorable ClassNK response; Haruyama accepts; Kashiwabara concern + re-confirmation request.  
Missing: coverage of all CMS items; any item needing different treatment; written clarification.

### Expected Missing Information

Who: Tech Supt / ClassNK — exact item(s) + Class treatment — Evidence: item list + written ClassNK response.

### Expected Delegation

Haruyama formulates technical question; ClassNK confirms; President does not interpret technically; owner-side informed after clarification.

### Expected Professional Boundary

Must NOT state Class acceptance definitely applies to all CMS items.  
Must not substitute for Tech Supt or ClassNK. Boundary violation prevents READY.

### Expected Management Learning

Knowledge Update Candidate: YES. IA/MR only if broader CMS-management weakness revealed.

### Review Candidate Expectation

`NO` or `MONITOR` — do not auto-create MR Candidate from single technical clarification.

### NG Patterns

- Primary as INSPECTION_COMPLIANCE
- "NK has approved everything" without confirmation
- President makes technical judgment
- Unnecessary Class attendance without evidence
- Treat Kashiwabara concern as proof existing approach is wrong

---

## GOLDEN CASE 03 — ORBIT — Internal Audit / Panama ASI

### Input Facts

- 18 Aug 2026 Company Internal Audit onboard ORBIT in Osaka.
- CR-4: two deficiencies (SMS Rev.5 not kept onboard though revision record filled; bunkering not in C/E Work/Rest Remarks).
- Vessel submitted CR-5 (stated causes) and CR-6 (stated corrections).
- Same day Panama Flag ASI; Inspector did NOT record listed items as official deficiencies but gave Master written non-official deficiencies/observations requesting prompt rectification to prevent future PSC deficiencies (list of bridge/engine/safety/document items).
- Inspector requested before/after evidence after rectification.

### Expected Primary Case Type

`INSPECTION_COMPLIANCE`  
Must NOT become Primary `ISM_MANAGEMENT` merely because ISM learning is important.

### Expected Tags

Required: `orbit`, `panama_flag`, `recordkeeping`, `document_control`, `root_cause_required`, `horizontal_check`, `effectiveness_verification`  
Strongly acceptable: `emergency_preparedness`, `training_required`, `system_weakness`, `internal_audit_candidate`, `management_review_candidate`, `technical`, `work_rest_hours`

### Expected Decision Authorities

- Onboard corrective execution — Master / C/O / C/E / officers
- Technical verification (earth fault etc.) — Technical Superintendent / C/E
- Root cause / SMS / audit follow-up — Company / DP / Marine
- Final acceptance of Company closure / management follow-up — President/DP

Panama Inspector is external source, not internal decision owner.

### Expected President Decision

Do not treat closed merely because items corrected or photos submitted. Require immediate rectification plus deeper root-cause, horizontal checks, effectiveness verification for recurring/system-type weaknesses.

### Expected Recommendation

Immediate rectification + evidence; system follow-up challenging shallow root causes, horizontal checks, PA, effectiveness verification; escalate technical items to Tech Supt.  
Broader weakness hypothesis OK if labeled hypothesis, not confirmed fact.

### Expected Readiness

`CONDITIONAL`

### Expected Fact Separation

Confirmed IA deficiencies, CR-5/CR-6 content, Panama non-official list, evidence request.  
Unverified: vessel stated causes/corrections as proven.  
Hypothesis: broader system weakness.  
Missing: work/rest samples, revision control mechanism, EG demo evidence, earth fault closure, horizontal checks, effectiveness results.

### Expected Missing Information

Work/Rest, Document control, Emergency Generator, Earth fault — each with Who/What/Evidence.

### Expected Delegation

Mandatory. Do not return all verification to President.

### Expected Professional Boundary

Must not declare electrical fault closed; substitute for Tech Supt; claim compliance from photo alone; declare Root Cause proven without evidence.

### Expected Management Learning

CA/PA/EV/Horizontal YES; Fleet-wide Possible/Yes; IA Candidate YES; MR Candidate YES; Knowledge Update YES for reusable lessons.

### Review Candidate Expectation

`YES` (`reviewCandidateFlag = true`, may remain after CLOSED)

### NG Patterns

- Close because photos sent
- Accept "insufficient checking"/"improper filling" without challenge
- Treat all ASI observations as unrelated isolates
- Convert system-weakness hypothesis to confirmed fact
- President personally inspects technical equipment
- Treat non-official Panama observations as irrelevant
- Claim they were official PSC deficiencies

---

## GOLDEN CASE 04 — PLUTO LEADER — CTM / Company Liquidity

### Input Facts

- Ship Fund reported Carry Forward USD4,052.19; Nansha provision ~USD9,591.98 not reflected → adjusted ≈ -USD5,539.79
- Target closing USD5,000; Standard CTM USD35,000; Stress/Recovery USD40,000; >40k if liquidity allows
- Company cash-flow needs take priority over accelerating Ship Fund recovery
- September CTM expected Japan late September; exact port/payee may be unknown early
- Recurring rules: CSI ~60k month-end (after Miyuki confirmed); Casareo 1k; DCKK 2127.45 on 10th; Retirement 1290; SPF 210; PLUTO base receipt 101,670 from Miyuki
- Main month-end USD from SMBC USD
- Phase 1: FinanceSnapshot manual; no auto 30/60/90 forecast
- Reference projections: 32k→~-2292; 35k→~+707; 40k→~+5707; vessel-side required ≈ 39293 to hit 5k target

### Expected Primary Case Type

`FINANCE_COMMERCIAL`

### Expected Tags

Required: `pluto_leader`, `financial_risk`, `owner_interest`  
Acceptable: `ctm`, `ship_fund`, `company_liquidity`, `operational_continuity`

### Expected Decision Authorities

- Ship Fund data / onboard requirement — Master / vessel report
- Company cash-position confirmation — Finance / Accounting
- Final CTM funding decision — President

Vessel does not unilaterally determine remittance amount.

### Expected President Decision

Determine/approve September CTM after comparing vessel requirement with Company USD liquidity.  
On supplied vessel-side figures, USD40,000 preferred operationally, subject to Company liquidity.

### Expected Recommendation

Preserve both sides: vessel requirement (~39293 → recommend 40k) AND financial feasibility (subject to liquidity; lower CTM / deferred recovery if 40k endangers critical obligations).  
Necessary ≠ Affordable — must NOT collapse into one judgment.

### Expected Readiness

`CONDITIONAL` unless FinanceSnapshot includes sufficient confirmed Company liquidity evidence (then may be READY).

### Expected Fact Separation

Confirmed supplied figures/rules; derived calculations labeled derived; missing time-sensitive liquidity/date/payee/CSI actual/unplanned spend.

### Expected Missing Information

Finance liquidity by CTM date; vessel/agent final date/payee — with Evidence.

### Expected Delegation

Master Ship Fund; Finance balances; agent delivery after auth; President final amount.

### Expected Professional Boundary

No auto bank transfer auth; forecasts ≠ accounting facts; no assuming uncertain receipts; respect account/currency/timing.

### Expected Management Learning

Compare actual vs forecast later. No auto IA/MR merely because Ship Fund temporarily negative.

### Review Candidate Expectation

`NO`

### NG Patterns

- 40k solely because vessel wants it
- 35k solely because standard
- Collapse necessary vs affordable
- Ignore USD5,000 target
- Count pending 9591.98 as posted actual without status label
- Remit CSI before Miyuki confirmation
- Claim sufficient liquidity without evidence
- READY while liquidity check still missing
