import type {
  AnalyzeProposal,
  CaseType,
  CaseFollowUp,
  DecisionAuthorityItem,
  DecisionBrief,
  DecisionReadiness,
  FactItem,
  IntakeAttachmentRecord,
  ManagementLearning,
  MddCase,
  QualityGateResult,
} from "../types";
import {
  composeAnalyzeInput,
  extractUnverifiedFactCandidates,
} from "../attachments/compose-analyze-input";
import {
  evaluateQualityGateV1_1,
  subjectFromProposal,
} from "../quality-gate/evaluate-v1.1";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function fact(
  classification: FactItem["classification"],
  text: string,
  extra?: Partial<FactItem>,
): FactItem {
  return { id: id("fact"), classification, text, ...extra };
}

function auth(
  roleLabel: string,
  authority: string,
): DecisionAuthorityItem {
  return {
    id: id("auth"),
    roleLabel,
    authority,
    status: "pending",
  };
}

function learning(
  partial: Partial<ManagementLearning>,
): ManagementLearning {
  return {
    correctiveAction: false,
    preventiveAction: false,
    effectivenessVerification: false,
    horizontalCheck: false,
    fleetWideRelevance: "no",
    internalAuditCandidate: false,
    managementReviewCandidate: false,
    knowledgeUpdateCandidate: false,
    ...partial,
  };
}

/**
 * Deterministic Phase-1 proposer for Golden Case inputs and similar cases.
 * Proposals remain human-confirmable; acceptance truth stays in Spec fixtures.
 *
 * Attachments (v0.1): only affect the generic (non-Golden) path. Golden Case
 * proposals are unchanged when goldenCaseId is set or Golden cues are detected
 * from title/vessel/pastedText (attachment text is never used for GC detection).
 */
export function proposeFromHeuristics(input: {
  title: string;
  vessel?: string;
  pastedText: string;
  goldenCaseId?: MddCase["goldenCaseId"];
  financeSnapshot?: MddCase["financeSnapshot"];
  attachments?: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
}): AnalyzeProposal {
  const gc = input.goldenCaseId ?? detectGolden(input);
  switch (gc) {
    case "GC01":
      return proposeGc01();
    case "GC02":
      return proposeGc02();
    case "GC03":
      return proposeGc03();
    case "GC04":
      return proposeGc04(input.financeSnapshot);
    default:
      return proposeGeneric(input);
  }
}

function detectGolden(input: {
  title: string;
  vessel?: string;
  pastedText: string;
}): MddCase["goldenCaseId"] | undefined {
  const blob = `${input.title}\n${input.vessel ?? ""}\n${input.pastedText}`.toLowerCase();
  if (blob.includes("inoy") || (blob.includes("crew") && blob.includes("nansha")))
    return "GC01";
  if (blob.includes("cms") || (blob.includes("classnk") && blob.includes("fairwind")))
    return "GC02";
  if (
    blob.includes("panama") ||
    blob.includes("internal audit") ||
    blob.includes("cr-4")
  )
    return "GC03";
  if (blob.includes("ctm") || blob.includes("ship fund") || blob.includes("ship's fund"))
    return "GC04";
  return undefined;
}

function proposeGc01(): AnalyzeProposal {
  return {
    primaryCaseType: "CREW_MANNING",
    tags: ["pluto_leader", "crew_change", "owner_interest", "operational_continuity"],
    brief: baseBrief({
      recommendation:
        "Postpone the Chief Mate change from Nansha and plan embarkation in Japan in late September (Voy.071). Do not force an impractical Nansha change or incur extraordinary overseas cost solely to preserve the original plan.",
      decisionReadiness: "READY",
      decisionAuthorities: [
        auth("Crew-change/document coordination", "Manning Agent"),
        auth("Continuation onboard", "Master"),
        auth("Final management approval of postponement", "President/DP"),
      ],
      presidentDecision:
        "Approve postponing the C/M change from Nansha and planning the change in Japan in late September.",
      why: "Nansha embarkation is no longer practically achievable; no immediate safety/MSM emergency requires replacement there; Japan offers a more reliable and lower-cost opportunity.",
      confirmedFacts: [
        fact("confirmed", "C/M Inoy cannot board at Nansha as originally planned."),
        fact(
          "confirmed",
          "Current Chief Mate can continue onboard for the time being; no immediate safety/MSM emergency identified.",
        ),
        fact(
          "confirmed",
          "Next intended opportunity is crew change in Japan during Voy.071 in late September 2026.",
        ),
      ],
      unverifiedFacts: [],
      assumptions: [],
      missingInformation: [
        fact("missing", "Exact Japanese port and ETA not finally fixed.", {
          who: "Vessel schedule / agent",
          what: "Japanese port and ETA",
          evidenceRequired: "Confirmed itinerary",
        }),
        fact("missing", "Final document/travel readiness for Inoy.", {
          who: "Manning Agent / CSI",
          what: "Document and boarding readiness",
          evidenceRequired: "Document status checklist",
        }),
        fact("missing", "Continuation confirmation by current Chief Mate where required.", {
          who: "Master / current Chief Mate",
          what: "Continued service confirmation",
          evidenceRequired: "Written confirmation if required",
        }),
      ],
      risks: [
        "Document readiness slip delaying Japan change",
        "Schedule/ETA change affecting embarkation window",
      ],
      options: [
        {
          id: id("opt"),
          title: "Postpone to Japan (recommended)",
          summary: "Abandon Nansha plan; prepare Japan late-September change.",
        },
        {
          id: id("opt"),
          title: "Force Nansha change",
          summary: "Not recommended — impractical and costly without safety necessity.",
        },
      ],
      delegation: [
        {
          id: id("del"),
          assignee: "CSI / Manning Agent",
          task: "Manage Inoy documentation and boarding preparation.",
        },
        {
          id: id("del"),
          assignee: "Vessel / schedule",
          task: "Confirm Japanese port and ETA.",
        },
        {
          id: id("del"),
          assignee: "Master / current C/M",
          task: "Confirm continuation arrangements.",
        },
      ],
      learning: learning({
        knowledgeUpdateCandidate: true,
        notes:
          "Earlier tracking of critical crew-change documents; reusable for future overseas changes. Not a major system issue from this case alone.",
      }),
      nextActions: [
        {
          id: id("act"),
          text: "Instruct CSI to proceed on Japan embarkation prep for Inoy.",
          owner: "President/DP",
          status: "open",
        },
        {
          id: id("act"),
          text: "Obtain Japanese port/ETA confirmation.",
          owner: "Vessel/ops",
          status: "open",
        },
      ],
    }),
  };
}

function proposeGc02(): AnalyzeProposal {
  return {
    primaryCaseType: "TECHNICAL",
    tags: ["fairwind", "class_nk", "maintenance", "cms", "knowledge_update_candidate"],
    brief: baseBrief({
      recommendation:
        "Do not abandon the existing CMS handling approach without evidence. Obtain one narrow written clarification from ClassNK on the specific items raised by the owner-side Superintendent, then close the interpretive gap among Company, owner side, and vessel. Escalate to Class attendance only where the written clarification shows a specific item cannot be handled by the Chief Engineer.",
      decisionReadiness: "CONDITIONAL",
      decisionAuthorities: [
        auth("Technical assessment", "Superintendent"),
        auth("Class acceptance / interpretation", "Class"),
        auth("Final management confirmation / communication direction", "President/DP"),
      ],
      presidentDecision:
        "Endorse maintaining the current handling plan, subject to one focused ClassNK re-confirmation addressing Kashiwabara's specific concern. President does not make the machinery/Class technical judgment personally.",
      why: "Prior ClassNK response and Technical Superintendent assessment support the approach, but the specific exception concern remains to be confirmed in writing.",
      confirmedFacts: [
        fact(
          "confirmed",
          "ClassNK has provided a favorable prior response regarding proposed CMS handling (C/E open-up by due date; Class verify at next relevant survey).",
        ),
        fact("confirmed", "Technical Superintendent Haruyama considers the approach acceptable."),
        fact(
          "confirmed",
          "Owner-side Superintendent Kashiwabara raised a specific concern and requested re-confirmation from ClassNK.",
        ),
      ],
      unverifiedFacts: [
        fact(
          "unverified",
          "Whether the prior ClassNK response covers all actual CMS items in question.",
        ),
      ],
      assumptions: [],
      missingInformation: [
        fact(
          "missing",
          "Whether any particular item requires different treatment or Class attendance.",
          {
            who: "Technical Superintendent / ClassNK",
            what: "Exact item(s) that cannot reasonably be handled by C/E alone and Class treatment",
            evidenceRequired: "Item list + written ClassNK response",
          },
        ),
      ],
      risks: [
        "Interpretive gap between Company, owner side, and Class",
        "Unnecessary Class attendance cost if concern is over-generalized",
      ],
      options: [
        {
          id: id("opt"),
          title: "Narrow ClassNK clarification (recommended)",
          summary: "Keep current plan pending focused written confirmation.",
        },
        {
          id: id("opt"),
          title: "Abandon approach now",
          summary: "Not recommended without evidence that prior Class guidance fails.",
        },
      ],
      delegation: [
        {
          id: id("del"),
          assignee: "Haruyama (Technical Superintendent)",
          task: "Identify technically problematic items and formulate the Class question.",
        },
        {
          id: id("del"),
          assignee: "ClassNK",
          task: "Confirm acceptance/conditions in writing for the questioned items.",
        },
        {
          id: id("del"),
          assignee: "Company",
          task: "Inform owner-side Superintendent after Class clarification.",
        },
      ],
      learning: learning({
        knowledgeUpdateCandidate: true,
        notes:
          "Final ClassNK clarification may become reusable company knowledge. IA/MR only if broader CMS-management weakness is revealed.",
      }),
      nextActions: [
        {
          id: id("act"),
          text: "Send focused ClassNK clarification request with item list.",
          owner: "Technical Superintendent",
          status: "open",
        },
      ],
      communication:
        "After Class clarification, communicate consistent position to owner-side Superintendent and vessel.",
    }),
  };
}

function proposeGc03(): AnalyzeProposal {
  return {
    primaryCaseType: "INSPECTION_COMPLIANCE",
    tags: [
      "orbit",
      "panama_flag",
      "recordkeeping",
      "document_control",
      "root_cause_required",
      "horizontal_check",
      "effectiveness_verification",
      "system_weakness",
      "internal_audit_candidate",
      "management_review_candidate",
      "emergency_preparedness",
      "training_required",
    ],
    brief: baseBrief({
      recommendation:
        "Immediately rectify all Internal Audit and Panama ASI items with appropriate evidence. In parallel, challenge shallow root causes, run horizontal checks, set preventive actions, verify effectiveness after a reasonable period, and escalate technical items (e.g. earth fault) to the Technical Superintendent. Multiple observations may indicate broader weaknesses in recordkeeping, document control, emergency familiarization, routine verification, and housekeeping — treat this as a hypothesis until validated.",
      decisionReadiness: "CONDITIONAL",
      decisionAuthorities: [
        auth("Onboard corrective execution", "Master"),
        auth("Technical verification of electrical earth fault and technical defects", "Superintendent"),
        auth("Root cause / SMS / audit follow-up", "President/DP"),
        auth("Final acceptance of Company closure / management follow-up", "President/DP"),
      ],
      presidentDecision:
        "Do not treat the case as closed merely because individual items were corrected or photographs submitted. Require immediate rectification plus deeper root-cause review, horizontal checks, and effectiveness verification for recurring/system-type weaknesses.",
      why: "Immediate corrective direction is clear, but closure is not ready until root cause quality, horizontal-check results, and evidence are verified.",
      confirmedFacts: [
        fact("confirmed", "Two Company Internal Audit deficiencies recorded on CR-4."),
        fact("confirmed", "Vessel submitted CR-5 with stated causes and CR-6 with stated corrections."),
        fact(
          "confirmed",
          "Panama Flag ASI provided a written list of non-official deficiencies/observations (not recorded as official deficiencies) and requested prompt rectification with before/after evidence.",
        ),
      ],
      unverifiedFacts: [
        fact(
          "unverified",
          "CR-5 explanations are the vessel's stated causes, not necessarily proven root causes.",
        ),
        fact(
          "unverified",
          "CR-6 statements do not by themselves prove preventive effectiveness.",
        ),
      ],
      assumptions: [
        fact(
          "assumption",
          "Possible broader weakness in onboard verification, recordkeeping, document control, and familiarization (hypothesis until validated).",
        ),
      ],
      missingInformation: [
        fact("missing", "Whether bunkering work was correctly reflected in actual work/rest hours, not only Remarks.", {
          who: "Master / C/E",
          what: "Verify actual hours and prior samples",
          evidenceRequired: "Recent Work/Rest Records + bunkering records",
        }),
        fact("missing", "How controlled-document revision control failed for SKSMS Rev.5.", {
          who: "Master / Company",
          what: "Determine revision-control failure mechanism",
          evidenceRequired: "Controlled document list / revision receipt and acknowledgement",
        }),
        fact("missing", "Evidence that 2/O can demonstrate Emergency Generator starting.", {
          who: "Master / relevant officer",
          what: "Practical competence demonstration",
          evidenceRequired: "Demonstration / familiarization record",
        }),
        fact("missing", "Technical status and closure evidence of 100V earth fault.", {
          who: "C/E / Technical Superintendent",
          what: "Identify fault and permanent correction",
          evidenceRequired: "Readings / repair report / technical verification",
        }),
      ],
      risks: [
        "Future PSC exposure if non-official observations recur",
        "Shallow root causes leave systemic weaknesses unaddressed",
        "Technical defect (earth fault) left unverified",
      ],
      options: [
        {
          id: id("opt"),
          title: "Immediate fix + system follow-up (recommended)",
          summary: "Rectify now; challenge RC; horizontal check; effectiveness verification.",
        },
        {
          id: id("opt"),
          title: "Photo-close only",
          summary: "Not acceptable — does not address root cause or effectiveness.",
        },
      ],
      delegation: [
        {
          id: id("del"),
          assignee: "Master",
          task: "Coordinate onboard corrections and evidence pack.",
        },
        {
          id: id("del"),
          assignee: "C/O",
          task: "Deck/bridge/document matters as applicable.",
        },
        {
          id: id("del"),
          assignee: "C/E",
          task: "Engine-room/electrical/chemical/work-rest items as applicable.",
        },
        {
          id: id("del"),
          assignee: "Technical Superintendent",
          task: "Technical validation (including earth fault).",
        },
        {
          id: id("del"),
          assignee: "Company / DP",
          task: "Review root-cause quality, horizontal check, and closure.",
        },
      ],
      learning: learning({
        correctiveAction: true,
        preventiveAction: true,
        effectivenessVerification: true,
        horizontalCheck: true,
        fleetWideRelevance: "possible",
        internalAuditCandidate: true,
        managementReviewCandidate: true,
        knowledgeUpdateCandidate: true,
        notes:
          "Significant management learning expected from combined IA + ASI signals. Professional Boundary: do not declare electrical/earth-fault closed from photos alone; Technical Superintendent (not President) validates technical items.",
      }),
      nextActions: [
        {
          id: id("act"),
          text: "Complete immediate rectifications with before/after evidence.",
          owner: "Master",
          status: "open",
        },
        {
          id: id("act"),
          text: "Challenge CR-5 root causes; open horizontal checks.",
          owner: "Company/DP",
          status: "open",
        },
        {
          id: id("act"),
          text: "Escalate earth fault for technical verification.",
          owner: "Technical Superintendent",
          status: "open",
        },
      ],
    }),
  };
}

function proposeGc04(
  financeSnapshot?: MddCase["financeSnapshot"],
): AnalyzeProposal {
  const liquidityConfirmed = Boolean(financeSnapshot?.companyLiquidityConfirmed);
  const readiness: DecisionReadiness = liquidityConfirmed ? "READY" : "CONDITIONAL";
  const recommended =
    financeSnapshot?.recommendedCtm ?? 40000;
  const required =
    financeSnapshot?.vesselRequiredApprox ?? 39293;

  return {
    primaryCaseType: "FINANCE_COMMERCIAL",
    tags: [
      "pluto_leader",
      "financial_risk",
      "owner_interest",
      "ctm",
      "ship_fund",
      "company_liquidity",
    ],
    brief: baseBrief({
      recommendation: `Vessel-side requirement to restore projected closing toward the USD5,000 target is approximately USD${required.toLocaleString()}. Therefore USD${recommended.toLocaleString()} is the appropriate vessel-side operational recommendation. Final remittance remains subject to Company USD liquidity: if USD40,000 would materially endanger DCKK, CSI, Casareo, SPF, Retirement Fund or other critical obligations, a lower CTM may be selected and deficit recovery deferred. Necessary ≠ Affordable — keep these judgments separate. Do not remit CSI before Miyuki Kisen receipt confirmation.`,
      decisionReadiness: readiness,
      decisionAuthorities: [
        auth("Ship Fund data / onboard requirement input", "Master"),
        auth("Company cash-position confirmation", "Finance/Accounting"),
        auth("Final CTM funding decision", "President/DP"),
      ],
      presidentDecision: `Determine/approve the September CTM amount after comparing vessel requirement (~USD${required.toLocaleString()}) with Company USD liquidity. On currently supplied vessel-side figures, USD${recommended.toLocaleString()} is the preferred operational amount, subject to Company liquidity.`,
      why: liquidityConfirmed
        ? "Vessel-side requirement is clear and Company liquidity confirmation is present in the FinanceSnapshot."
        : "Vessel-side requirement is sufficiently clear, but final approval requires current Company liquidity confirmation near the remittance date.",
      confirmedFacts: [
        fact("confirmed", "Reported Ship Fund carry forward USD4,052.19 (supplied)."),
        fact(
          "confirmed",
          "Nansha provision estimate USD9,591.98 not yet reflected in that balance (pending/estimated status).",
        ),
        fact("confirmed", "Target Ship Fund closing balance USD5,000."),
        fact(
          "confirmed",
          "CSI must not be remitted before Miyuki Kisen receipt is confirmed; main month-end USD payments generally from SMBC USD.",
        ),
      ],
      unverifiedFacts: [],
      assumptions: [],
      missingInformation: liquidityConfirmed
        ? [
            fact("missing", "Exact September CTM date/payee may still be unsettled.", {
              who: "Vessel / agent",
              what: "Final CTM date and receiving party",
              evidenceRequired: "Port schedule / agent instructions",
            }),
          ]
        : [
            fact("missing", "Available Company USD liquidity by the proposed CTM date.", {
              who: "Finance / Accounting / President",
              what: "USD liquidity vs committed near-term obligations",
              evidenceRequired: "Current bank balances + confirmed near-term inflows/outflows",
            }),
            fact("missing", "Exact September CTM date and payee.", {
              who: "Vessel / agent",
              what: "Final CTM date and receiving party",
              evidenceRequired: "Port schedule / agent instructions",
            }),
          ],
      risks: [
        "Ship Fund deficit if CTM undershoots requirement",
        "Company liquidity stress if CTM overshoots without confirmation",
        "CSI remittance before Miyuki receipt",
      ],
      options: [
        {
          id: id("opt"),
          title: "CTM USD40,000 (vessel-side preferred)",
          summary: "Approaches USD5,000 target on supplied projections, subject to liquidity.",
        },
        {
          id: id("opt"),
          title: "Lower CTM / defer recovery",
          summary: "If liquidity endangers critical obligations, select lower amount.",
        },
      ],
      delegation: [
        {
          id: id("del"),
          assignee: "Master",
          task: "Maintain and report Ship Fund position.",
        },
        {
          id: id("del"),
          assignee: "Finance / Accounting",
          task: "Update bank balances and committed payments.",
        },
        {
          id: id("del"),
          assignee: "Agent",
          task: "Handle CTM delivery after authorization.",
        },
        {
          id: id("del"),
          assignee: "President",
          task: "Decide final funding amount.",
        },
      ],
      learning: learning({
        notes:
          "Compare actual CTM/Ship Fund result with forecast later. No automatic IA/MR merely because Ship Fund temporarily went negative.",
      }),
      nextActions: [
        {
          id: id("act"),
          text: "Confirm Company USD liquidity near remittance date.",
          owner: "Finance/Accounting",
          status: "open",
        },
        {
          id: id("act"),
          text: "President approve final September CTM amount.",
          owner: "President/DP",
          status: "open",
        },
      ],
    }),
  };
}

function proposeGeneric(input: {
  title: string;
  vessel?: string;
  pastedText: string;
  attachments?: IntakeAttachmentRecord[];
  followUps?: CaseFollowUp[];
}): AnalyzeProposal {
  const attachments = input.attachments ?? [];
  const followUps = input.followUps ?? [];
  const extractedAttachments = attachments.filter(
    (a) =>
      a.extractionStatus === "EXTRACTED" &&
      a.extractedContent.trim().length > 0,
  );
  const previewOnly = attachments.filter(
    (a) => a.extractionStatus === "PREVIEW_ONLY",
  );
  const failed = attachments.filter((a) => a.extractionStatus === "FAILED");

  const analyzeInput = composeAnalyzeInput({
    narrative: input.pastedText,
    attachments,
    followUps,
  });

  const attachmentFacts = extractUnverifiedFactCandidates(extractedAttachments);
  const unverifiedFacts: FactItem[] = attachmentFacts.map((c) =>
    fact("unverified", c.text, {
      evidenceRequired: c.sourceLabel,
    }),
  );

  for (const a of previewOnly) {
    unverifiedFacts.push(
      fact(
        "unverified",
        `Attachment present without semantic extraction: ${a.fileName} (${a.extractionNote ?? "PREVIEW_ONLY"})`,
        { evidenceRequired: `Source: ${a.fileName}` },
      ),
    );
  }
  for (const a of failed) {
    unverifiedFacts.push(
      fact(
        "unverified",
        `Attachment extraction failed: ${a.fileName} — do not invent its contents. (${a.extractionNote ?? "FAILED"})`,
        { evidenceRequired: `Source: ${a.fileName}` },
      ),
    );
  }

  followUps.forEach((fu, i) => {
    const label = fu.authorLabel?.trim()
      ? `Follow-up ${i + 1} (${fu.authorLabel.trim()})`
      : `Follow-up ${i + 1}`;
    const snippet = fu.text.trim().slice(0, 220);
    if (snippet) {
      unverifiedFacts.push(
        fact("unverified", `${snippet}${fu.text.trim().length > 220 ? "…" : ""}`, {
          evidenceRequired: `Source: ${label}`,
        }),
      );
    }
  });

  const hasNarrative = input.pastedText.trim().length > 0;
  const confirmedFacts: FactItem[] = [];
  if (hasNarrative) {
    confirmedFacts.push(
      fact(
        "confirmed",
        "User-pasted intake text is present (content not yet verified as operational fact).",
      ),
    );
  }
  if (extractedAttachments.length > 0) {
    confirmedFacts.push(
      fact(
        "confirmed",
        `${extractedAttachments.length} attachment(s) yielded extractable text; lines below are Reported but Unverified until human confirmation.`,
      ),
    );
  }
  if (followUps.length > 0) {
    confirmedFacts.push(
      fact(
        "confirmed",
        `${followUps.length} follow-up(s) included in Analyze input (Reported but Unverified until human confirmation).`,
      ),
    );
  }

  const missingInformation: FactItem[] = [
    fact(
      "missing",
      "Key confirmed facts and decision question are not yet structured.",
      {
        who: "Case owner",
        what: "Decision question and confirmed facts",
        evidenceRequired: "Structured intake",
      },
    ),
  ];
  if (attachments.length > 0 && extractedAttachments.length === 0) {
    missingInformation.push(
      fact(
        "missing",
        "Attached files did not yield usable text (FAILED or PREVIEW_ONLY). Re-supply text, a text-layer PDF, or spreadsheet — do not invent.",
        {
          who: "Case owner",
          what: "Readable attachment content",
          evidenceRequired: "Re-extractable source file",
        },
      ),
    );
  }

  const type: CaseType = inferGenericCaseType(
    `${input.title}\n${input.pastedText}\n${attachmentFacts.map((f) => f.text).join("\n")}\n${followUps.map((f) => f.text).join("\n")}`,
  );

  const suggestedQuestionsToVessel = buildSuggestedQuestionsToVessel({
    caseType: type,
    title: input.title,
    pastedText: input.pastedText,
    attachmentBlob: attachmentFacts.map((f) => f.text).join("\n"),
    followUpCount: followUps.length,
  });

  const typeTag =
    type === "TECHNICAL"
      ? "technical"
      : type === "INSPECTION_COMPLIANCE"
        ? "inspection_compliance"
        : type === "FINANCE_COMMERCIAL"
          ? "finance"
          : "operational";

  return {
    primaryCaseType: type,
    tags: [
      ...(input.vessel
        ? [input.vessel.toLowerCase().replace(/\s+/g, "_")]
        : []),
      typeTag,
      ...(extractedAttachments.length > 0 ? ["attachment_sourced"] : []),
      ...(followUps.length > 0 ? ["follow_up"] : []),
    ],
    brief: {
      ...baseBrief({
        recommendation:
          extractedAttachments.length > 0 || followUps.length > 0
            ? "Review attachment- and follow-up-sourced Reported facts against the email narrative, confirm what is operationally true, identify contradictions without silently reconciling them, and escalate only what requires a President Decision."
            : "Organize facts, identify missing information, assign decision authorities, and prepare a President Decision only for what requires management confirmation.",
        decisionReadiness: "NOT_READY",
        decisionAuthorities: [
          auth("Case coordination", "Other"),
          auth("Final management confirmation if required", "President/DP"),
        ],
        presidentDecision:
          "President Decision: Not required at this stage — pending structured facts.",
        why:
          followUps.length > 0
            ? "Follow-up material was added with explicit source boundaries, but content is not auto-confirmed. Human verification of Reported facts and the decision question is still required."
            : extractedAttachments.length > 0
              ? "Attachment text was ingested with explicit source boundaries, but attachment content is not auto-confirmed. Human verification of Reported facts and the decision question is still required."
              : "Insufficient structured analysis for a management decision.",
        confirmedFacts,
        unverifiedFacts,
        assumptions: [],
        missingInformation,
        risks: [
          "Acting on unstructured intake",
          ...(extractedAttachments.length > 0
            ? [
                "Treating attachment extraction as confirmed fact without human review",
                "Silently reconciling conflicts between email narrative and attachments",
              ]
            : []),
          ...(followUps.length > 0
            ? [
                "Treating follow-up replies as confirmed without human review",
                "Silently reconciling conflicts across narrative, attachments, and follow-ups",
              ]
            : []),
        ],
        options: [],
        delegation: [
          {
            id: id("del"),
            assignee: "Case coordinator",
            task: "Structure facts and identify decision owner(s).",
          },
        ],
        learning: learning({
          notes: [
            attachments.length > 0 || followUps.length > 0
              ? `Analyze input composed with source boundaries (${analyzeInput.length} chars). Attachment/follow-up lines are Reported but Unverified — not auto-confirmed.`
              : undefined,
            followUps.length > 0
              ? `${followUps.length} follow-up(s) included.`
              : undefined,
          ]
            .filter(Boolean)
            .join(" "),
        }),
        nextActions: [
          {
            id: id("act"),
            text:
              suggestedQuestionsToVessel.length > 0
                ? "Send suggested questions to vessel/shore, paste replies as Follow-up, then re-analyze."
                : extractedAttachments.length > 0
                  ? "Confirm or reject attachment-sourced Reported facts, then re-analyze."
                  : "Complete structured fact entry and re-analyze.",
            owner: "Case owner",
            status: "open",
          },
        ],
      }),
      suggestedQuestionsToVessel,
    },
  };
}

/** UI chips only — questions to ask, not asserted facts. */
function buildSuggestedQuestionsToVessel(input: {
  caseType: CaseType;
  title: string;
  pastedText: string;
  attachmentBlob: string;
  followUpCount: number;
}): string[] {
  const blob =
    `${input.title}\n${input.pastedText}\n${input.attachmentBlob}`.toLowerCase();
  const qs: string[] = [];

  if (input.caseType === "TECHNICAL") {
    qs.push(
      "Is the affected equipment currently usable / available for operation?",
    );
    qs.push("What temporary / contingency measures are in place onboard now?");
    qs.push("What is the estimated parts / repair completion timing?");
  }
  if (
    blob.includes("valve") ||
    blob.includes("generator") ||
    blob.includes("diesel") ||
    blob.includes("contamination") ||
    blob.includes("vlsfo")
  ) {
    qs.push(
      "Please confirm contamination extent and whether DO service tank / FO system isolation is complete.",
    );
    qs.push(
      "What Class / company notifications (if any) have already been made?",
    );
  }
  if (input.caseType === "CREW_MANNING") {
    qs.push("What is the latest embarkation / document readiness status?");
  }
  if (input.caseType === "FINANCE_COMMERCIAL") {
    qs.push("Please confirm latest Ship Fund / pending expense figures and as-of date.");
  }
  if (input.followUpCount === 0) {
    qs.push(
      "Who onboard owns this issue now (Master / C/E / other), and what decision do you need from shore?",
    );
  } else {
    qs.push(
      "Please confirm any remaining open points after the latest follow-up (list unknowns only).",
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of qs) {
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}

/** Lightweight type hint from intake+attachment text — not Golden-specific. */
function inferGenericCaseType(blob: string): CaseType {
  const t = blob.toLowerCase();
  if (
    t.includes("generator") ||
    t.includes("valve") ||
    t.includes("diesel") ||
    t.includes("engine") ||
    t.includes("defect") ||
    t.includes("trouble report") ||
    t.includes("machinery")
  ) {
    return "TECHNICAL";
  }
  if (
    t.includes("psc") ||
    t.includes("audit") ||
    t.includes("deficiency") ||
    t.includes("ism")
  ) {
    return "INSPECTION_COMPLIANCE";
  }
  if (t.includes("ctm") || t.includes("invoice") || t.includes("remittance")) {
    return "FINANCE_COMMERCIAL";
  }
  if (t.includes("crew") || t.includes("manning") || t.includes("visa")) {
    return "CREW_MANNING";
  }
  return "OPERATIONAL";
}

function baseBrief(
  partial: Omit<
    AnalyzeProposal["brief"],
    "confirmedFacts" | "unverifiedFacts" | "assumptions" | "missingInformation"
  > & {
    confirmedFacts: FactItem[];
    unverifiedFacts: FactItem[];
    assumptions: FactItem[];
    missingInformation: FactItem[];
  },
): AnalyzeProposal["brief"] {
  return {
    ...partial,
    communication: partial.communication,
  };
}

export function runQualityGate(input: {
  brief: AnalyzeProposal["brief"];
  primaryCaseType: CaseType;
  tags?: string[];
  reviewCandidateFlag?: boolean;
}): QualityGateResult {
  const b = input.brief;
  const evaluation = evaluateQualityGateV1_1(
    subjectFromProposal({
      primaryCaseType: input.primaryCaseType,
      tags: input.tags,
      recommendation: b.recommendation,
      presidentDecision: b.presidentDecision,
      why: b.why,
      decisionReadiness: b.decisionReadiness,
      decisionAuthorities: b.decisionAuthorities.map((a) => ({
        roleLabel: a.roleLabel,
        authority: String(a.authority),
      })),
      nextActions: b.nextActions.map((a) => ({
        owner: a.owner,
        text: a.text,
        dueDate: a.dueDate,
      })),
      confirmedFacts: b.confirmedFacts,
      unverifiedFacts: b.unverifiedFacts,
      assumptions: b.assumptions,
      missingInformation: b.missingInformation,
      learning: {
        managementReviewCandidate: b.learning.managementReviewCandidate,
        internalAuditCandidate: b.learning.internalAuditCandidate,
        knowledgeUpdateCandidate: b.learning.knowledgeUpdateCandidate,
        notes: b.learning.notes,
      },
      reviewCandidateFlag:
        input.reviewCandidateFlag ?? b.learning.managementReviewCandidate,
    }),
  );

  return {
    passed: evaluation.passed,
    criticalFailures: evaluation.criticalFailures.map(
      (f) => `${f.code}: ${f.message}`,
    ),
    warnings: evaluation.warnings.map((f) => `${f.code}: ${f.message}`),
    evaluatedAt: evaluation.evaluatedAt,
  };
}

export function applyGateToBrief(
  proposal: AnalyzeProposal,
  opts?: {
    reviewCandidateFlag?: boolean;
    financeSnapshot?: MddCase["financeSnapshot"];
  },
): DecisionBrief {
  const evaluation = evaluateQualityGateV1_1(
    subjectFromProposal({
      primaryCaseType: proposal.primaryCaseType,
      tags: proposal.tags,
      recommendation: proposal.brief.recommendation,
      presidentDecision: proposal.brief.presidentDecision,
      why: proposal.brief.why,
      decisionReadiness: proposal.brief.decisionReadiness,
      decisionAuthorities: proposal.brief.decisionAuthorities.map((a) => ({
        roleLabel: a.roleLabel,
        authority: String(a.authority),
      })),
      nextActions: proposal.brief.nextActions.map((a) => ({
        owner: a.owner,
        text: a.text,
        dueDate: a.dueDate,
      })),
      confirmedFacts: proposal.brief.confirmedFacts,
      unverifiedFacts: proposal.brief.unverifiedFacts,
      assumptions: proposal.brief.assumptions,
      missingInformation: proposal.brief.missingInformation,
      learning: {
        managementReviewCandidate:
          proposal.brief.learning.managementReviewCandidate,
        internalAuditCandidate: proposal.brief.learning.internalAuditCandidate,
        knowledgeUpdateCandidate:
          proposal.brief.learning.knowledgeUpdateCandidate,
        notes: proposal.brief.learning.notes,
      },
      reviewCandidateFlag:
        opts?.reviewCandidateFlag ??
        proposal.brief.learning.managementReviewCandidate,
      financeSnapshot: opts?.financeSnapshot,
    }),
  );

  return {
    ...proposal.brief,
    decisionReadiness: evaluation.enforcedReadiness,
    qualityGate: {
      passed: evaluation.passed,
      criticalFailures: evaluation.criticalFailures.map(
        (f) => `${f.code}: ${f.message}`,
      ),
      warnings: evaluation.warnings.map((f) => `${f.code}: ${f.message}`),
      evaluatedAt: evaluation.evaluatedAt,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function createEmptyCase(partial?: Partial<MddCase>): MddCase {
  const now = new Date().toISOString();
  const base: MddCase = {
    id: id("case"),
    title: "New Case",
    primaryCaseTypeConfirmed: false,
    tags: [],
    tagsConfirmed: false,
    status: "NEW",
    reviewCandidateFlag: false,
    reviewCandidateConfirmed: false,
    pastedText: "",
    attachments: [],
    followUps: [],
    structuredFacts: [],
    contextPack: {
      companyCore: true,
      businessPartners: [],
      people: [],
      relatedCaseIds: [],
      aiSuggested: false,
      humanConfirmed: false,
    },
    recommendationConfirmed: false,
    presidentDecisionConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };
  const merged = { ...base, ...partial, updatedAt: now };
  if (partial?.vessel && !partial.contextPack) {
    merged.contextPack = {
      ...merged.contextPack,
      vessel: partial.vessel,
    };
  }
  return merged;
}
