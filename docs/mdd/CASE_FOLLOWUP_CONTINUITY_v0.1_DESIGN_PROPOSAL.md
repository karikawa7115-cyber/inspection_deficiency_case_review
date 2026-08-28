# Case Follow-up Continuity v0.1 — Design Proposal Only

**Status:** ACCEPTED decisions · implementation in progress / shipped with Continuity v0.1 UI  
**Date:** 2026-08-28  
**Positioning:** Post-Graduation MDD UX / Case Envelope extension  
**Accepted prerequisites (do not modify in this proposal):** System Prompt v1.0 · Structured Output Schema v1.0 · Quality Gate v1.1 · Decision Control / Policy · Semantic Refill · Golden Spec / Eval  

**Related:** Intake Attachment Upload v0.1 (implemented) · Case Context Source Provenance v0.1 (design only)

**Does not change:** Structured Output Schema v1.0 · Control · Policy · Gate · Prompt · Golden

---

## 0. Why this exists

Real operational cases (e.g. **No. 1 Diesel G/E 3-way FO Outlet Valve Defective**) often cannot reach a President-ready answer from one email + one attachment.

Today MDD correctly returns **NOT_READY / CONDITIONAL** with Missing Information. Operators still need a **same-case continuation path**: add facts from the next email / phone / shore reply, then re-run Analyze — without opening a generic chat and without inventing answers.

---

## 1. Design principle

| Prefer | Avoid |
|--------|--------|
| Same Case, accumulating **facts** | New Case per follow-up email |
| Source-bounded append (`[FOLLOW-UP n]`) | Merging replies into original narrative as if one source |
| Re-analyze → updated Brief | Infinite chat thread as the product surface |
| Missing / Suggested questions for vessel | AI silently “closing” the case |
| Human confirms essentials | Auto-READY from incomplete follow-ups |

**Product identity stays:** Decision Preparation System (AI proposes / Human confirms), not judgment chatbot.

---

## 2. Screen wire (Case Workspace)

Desired left / right layout after Follow-up Continuity v0.1:

```
┌─ Case Intake ─────────────────────────────────────────┐  ┌─ Decision Brief ──────────────┐
│ Title                                                 │  │ Executive Decision             │
│ Vessel                                                │  │ …                              │
│                                                       │  │ Missing Information            │
│ Intake / Email / Narrative   (original, editable)     │  │  • …                           │
│ [ textarea — primary vessel email ]                   │  │                                │
│                                                       │  │ Suggested questions to vessel  │
│ Attachments                                           │  │  • Is DG usable?               │
│ [ drop zone / file cards ]                            │  │  • Parts ETA?                  │
│ Extracted Attachment Content ▸                        │  │  (copy → paste into Follow-up) │
│                                                       │  ├────────────────────────────────┤
│ ── Follow-up thread ───────────────────────────────   │  │ [ Re-analyze ]  (same as top)  │
│ Follow-up 1 · 2026-08-28 10:12                        │  └────────────────────────────────┘
│ [ vessel reply / phone note ]                         │
│ Follow-up 2 · 2026-08-28 14:40                        │
│ [ shore superintendent note ]                         │
│                                                       │
│ Add follow-up                                         │
│ [ textarea ]                                          │
│ [ + Attachments for this follow-up (optional) ]       │
│ [ Add follow-up ]                                     │
│                                                       │
│ Current Decision Question (optional / later)          │
└───────────────────────────────────────────────────────┘
   [ Analyze / Re-analyze ]
```

### UX notes

- **Case Intake** remains the panel title (not a text field).
- Original narrative stays visible and editable; follow-ups are **additive history**, not a replacement chat.
- Collapsed by default when empty: **Follow-up thread** section appears after first Analyze if readiness ≠ READY, or always as a quiet section.
- Focus ring / `bg-card` match Title · Vessel · Intake (existing Intake field language).
- Do not turn the panel into a document-management dashboard.

---

## 3. Envelope data (lightweight)

Do **not** change Structured Output Schema v1.0.

Extend **Case envelope / UI model** only (prototype LocalStorage OK):

```ts
type CaseFollowUp = {
  followUpId: string;
  createdAt: string; // ISO
  authorLabel?: string; // e.g. "Master", "Superintendent", "Phone note"
  text: string;
  attachmentIds?: string[]; // reuse Intake Attachment records
};
```

On `MddCase` (or equivalent):

- `followUps?: CaseFollowUp[]`
- Keep `pastedText` = original narrative
- Keep `attachments[]` as today (v0.1); optional link from follow-up to attachment ids

**Persistence (Graduation-era prototype):** metadata + text only; no large binaries in LocalStorage (same rule as Attachment Upload v0.1).

---

## 4. Analyze input composition

Extend `composeAnalyzeInput` with explicit boundaries:

```
[INTAKE NARRATIVE]
…

[ATTACHMENT 1]
…

[FOLLOW-UP 1]
At: 2026-08-28T10:12:00Z
Author: Master
…
[FOLLOW-UP 2]
…
```

Rules:

- Do not invent follow-up text.
- Do not reconcile conflicts between narrative / attachment / follow-ups; preserve all sources.
- Follow-up lines remain **Reported but Unverified** until human confirmation (same fact discipline).
- Golden Case path: ignore follow-ups when `goldenCaseId` is set (no GC expectation drift).

---

## 5. Brief behavior (no Schema change)

Without Schema edits, reuse existing Brief fields:

| Need | v0.1 mapping |
|------|----------------|
| What is still missing | `missingInformation` |
| What to ask next | Prefer `missingInformation` + optional `nextActions` / `delegation` wording as “ask vessel / shore…” |
| Continuity cue | `learning.notes` or Brief communication line: “N follow-up(s) included in Analyze input” |

**Later (optional Schema change):** promote chips to canonical `suggestedQuestionsToVessel[]` only if Schema v1.0+ is explicitly revised. Continuity v0.1 stores questions on the **UI DecisionBrief** envelope field only (not Canonical Schema).

### Brief chips (accepted)

- Section title: **Suggested questions to vessel**
- Each question is a compact chip / button; **click copies** text for email / follow-up paste
- Generated by the Analyze proposer for generic (non-Golden) cases from missing gaps + case cues — **not** invented operational facts

---

## 6. Operator flow (acceptance scenario)

**Case:** No. 1 Diesel G/E 3-way FO Outlet Valve Defective  

1. Paste short covering email into Intake; attach CR-8 Excel; Analyze → NOT_READY / Missing.  
2. Brief shows gaps (e.g. operability, temporary measures, parts, authority).  
3. Operator emails vessel / calls shore; receives reply.  
4. Paste reply into **Add follow-up** (optional author label “Master”); Add.  
5. **Re-analyze** → Brief updates using original + attachment + follow-up; still not auto-Confirmed.  
6. Repeat until essentials are human-confirmable or case stays Waiting for information.

Pass only if:

- Same `caseId` throughout  
- Sources remain inspectable  
- No invented content for empty follow-ups  
- No-attachment / no-follow-up path unchanged  

---

## 7. Out of scope (explicit)

- Full chat UI / streaming dialogue with the model  
- Supabase Storage for follow-up binaries (Post-Graduation with Attachment Storage)  
- Source Provenance full architecture (may later label follow-up `sourceRole`)  
- Changing Control / Policy / Gate / Prompt / Schema / Golden  
- Auto-closing cases when follow-ups arrive  

---

## 8. Implementation sketch (when approved)

| Slice | Work |
|-------|------|
| A | `CaseFollowUp` type + LocalStorage persistence |
| B | Intake UI: follow-up list + add form |
| C | `composeAnalyzeInput` + generic heuristic / future LLM user payload |
| D | Tests: compose boundaries · GC unchanged · empty follow-up regression |
| E | Short implementation report |

Estimated UI surface: **MddCaseWorkspace + compose helper only**; no Control/Gate edits.

---

## 9. Accepted decisions (2026-08-28)

| # | Question | Decision |
|---|----------|----------|
| 1 | Author label on each follow-up | **Optional** |
| 2 | Attachments on follow-ups | **Allowed per follow-up** (stored on Case `attachments[]`, linked by `attachmentIds`) |
| 3 | Reset human-confirmation flags after Re-analyze | **Yes** (same as today’s Analyze) |
| 4 | Suggested questions to vessel | **Show as copyable chips in Brief** |

---

## 10. Recommendation / status

**Accepted for implementation** as Post-Graduation Continuity v0.1:

- same Case  
- additive follow-ups (+ optional per-follow-up attachments)  
- source-bounded Re-analyze  
- Brief chips for suggested vessel questions  
- no chat product pivot  
- no Schema / Control / Gate / Prompt / Golden changes  
