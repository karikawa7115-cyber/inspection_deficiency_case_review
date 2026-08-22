import type { CaseType, DecisionReadiness } from "../types";

/** Human-approved Golden Case Specification v1.0 — machine-readable assertion targets.
 *  AI must NOT redefine these values. */
export type GoldenCaseSpec = {
  id: "GC01" | "GC02" | "GC03" | "GC04";
  title: string;
  vessel: string;
  inputFactsText: string;
  expectedPrimaryCaseType: CaseType;
  requiredTags: string[];
  acceptableTags: string[];
  expectedAuthorityRoleLabels: string[];
  presidentMustNotDo?: string[];
  expectedPresidentDecisionIntent: string[];
  expectedRecommendationIntent: string[];
  forbiddenRecommendationIntent: string[];
  expectedReadiness: DecisionReadiness | DecisionReadiness[];
  reviewCandidateExpected: "yes" | "no" | "no_or_monitor";
  knowledgeUpdateExpected?: boolean;
  managementLearningSignificant?: boolean;
  ngPatterns: string[];
  financeSnapshot?: {
    reportedShipFund: number;
    pendingExpenses: number;
    adjustedBalance: number;
    targetClosing: number;
    standardCtm: number;
    recoveryCtm: number;
    vesselRequiredApprox: number;
    recommendedCtm: number;
    companyLiquidityConfirmed: boolean;
  };
};

export const GOLDEN_CASE_SPECS: GoldenCaseSpec[] = [
  {
    id: "GC01",
    title: "PLUTO LEADER — C/M Inoy Crew Change",
    vessel: "PLUTO LEADER",
    inputFactsText: `Vessel: PLUTO LEADER.
A Chief Mate change had originally been planned at Nansha, China around 19 Aug 2026.
C/M Inoy could not be ready in time for embarkation at Nansha.
Required documentation / travel preparation was not sufficiently ready for the planned Nansha change.
The current Chief Mate could continue onboard; no immediate Safety or Minimum Safe Manning emergency requiring replacement at Nansha had been identified.
The next practical plan was crew change in Japan during Voy.071 in late September 2026.
Avoiding an additional overseas crew-change arrangement would reduce owner cost.
The exact Japanese port / ETA was not yet finally fixed.
Inoy's remaining documentation and travel readiness still required follow-up.`,
    expectedPrimaryCaseType: "CREW_MANNING",
    requiredTags: ["pluto_leader", "crew_change"],
    acceptableTags: [
      "visa",
      "owner_interest",
      "operational_continuity",
      "knowledge_update_candidate",
    ],
    expectedAuthorityRoleLabels: [
      "Crew-change/document coordination",
      "Continuation onboard",
      "Final management approval of postponement",
    ],
    presidentMustNotDo: ["visa", "document chasing", "personally manage every"],
    expectedPresidentDecisionIntent: [
      "postpone",
      "nansha",
      "japan",
      "september",
    ],
    expectedRecommendationIntent: ["postpone", "japan", "nansha"],
    forbiddenRecommendationIntent: ["force nansha", "insist on nansha"],
    expectedReadiness: "READY",
    reviewCandidateExpected: "no",
    ngPatterns: [
      "President personally manages every visa/document task",
      "Insist on Nansha despite impossibility",
      "NOT_READY solely because JP port not finalized",
      "Invent safety emergency",
      "Unnecessary MR escalation",
    ],
  },
  {
    id: "GC02",
    title: "FAIRWIND — NK CMS Handling",
    vessel: "FAIRWIND",
    inputFactsText: `Vessel: FAIRWIND.
A CMS-related machinery survey / due-item issue required clarification.
ClassNK had already advised in substance that the Chief Engineer could carry out the required open-up / inspection by the due date and that ClassNK could verify it at the next relevant survey.
Technical Superintendent Haruyama considered this approach acceptable.
Owner-side Superintendent Kashiwabara remained concerned that some machinery / "足回り" items might not practically be open-inspected by the Chief Engineer alone.
Kashiwabara requested another clarification from ClassNK.
The issue is therefore not merely "there is a Class survey," but whether the proposed technical handling and the scope of Class acceptance are valid for the actual CMS items concerned.`,
    expectedPrimaryCaseType: "TECHNICAL",
    requiredTags: ["fairwind", "class_nk", "maintenance"],
    acceptableTags: [
      "cms",
      "owner_interest",
      "knowledge_update_candidate",
      "inspection_compliance",
    ],
    expectedAuthorityRoleLabels: [
      "Technical assessment",
      "Class acceptance",
      "Final management confirmation",
    ],
    expectedPresidentDecisionIntent: [
      "maintain",
      "classnk",
      "re-confirmation",
      "clarification",
    ],
    expectedRecommendationIntent: ["clarification", "classnk", "not abandon"],
    forbiddenRecommendationIntent: [
      "approved everything",
      "require class attendance for all cms items",
      "class attendance for every item because concern exists",
    ],
    expectedReadiness: "CONDITIONAL",
    reviewCandidateExpected: "no_or_monitor",
    knowledgeUpdateExpected: true,
    ngPatterns: [
      "Primary as INSPECTION_COMPLIANCE",
      "NK has approved everything without confirmation",
      "President makes technical judgment",
      "Unnecessary Class attendance without evidence",
      "Treat Kashiwabara concern as proof approach is wrong",
    ],
  },
  {
    id: "GC03",
    title: "ORBIT — Internal Audit / Panama ASI",
    vessel: "ORBIT",
    inputFactsText: `On 18 Aug 2026, Company Internal Audit was conducted onboard MV ORBIT in Osaka.
CR-4 recorded two Company Internal Audit Deficiencies:
SMS Procedure / SKSMS onboard was not kept at the latest Revision No.5, although the revision record had been filled.
Bunkering operation was not recorded in the Remarks section of the Chief Engineer's Record of Hours of Work/Rest.
The vessel subsequently submitted CR-5 and CR-6.
On the same day, a Panama Flag State Inspector conducted an ASI and gave the Master a written list of non-official deficiencies / observations requesting prompt rectification to prevent future PSC deficiencies (including BNWAS/Nav lights records, Radar Log, Deck Log, ETB, fireman's outfit TAC, MSDS, Emergency Generator demonstration, earth-fault, etc.).
The Panama Inspector requested before/after evidence after rectification.`,
    expectedPrimaryCaseType: "INSPECTION_COMPLIANCE",
    requiredTags: [
      "orbit",
      "panama_flag",
      "recordkeeping",
      "document_control",
      "root_cause_required",
      "horizontal_check",
      "effectiveness_verification",
    ],
    acceptableTags: [
      "emergency_preparedness",
      "training_required",
      "system_weakness",
      "internal_audit_candidate",
      "management_review_candidate",
      "technical",
      "work_rest_hours",
    ],
    expectedAuthorityRoleLabels: [
      "Onboard corrective execution",
      "Technical verification",
      "Root cause",
      "Final acceptance",
    ],
    expectedPresidentDecisionIntent: [
      "not",
      "closed",
      "root-cause",
      "horizontal",
      "effectiveness",
    ],
    expectedRecommendationIntent: [
      "rectify",
      "root cause",
      "horizontal",
      "effectiveness",
    ],
    forbiddenRecommendationIntent: [
      "close because photos",
      "official psc deficiencies",
    ],
    expectedReadiness: "CONDITIONAL",
    reviewCandidateExpected: "yes",
    managementLearningSignificant: true,
    ngPatterns: [
      "Close because photos were sent",
      "Accept shallow root cause without challenge",
      "Treat ASI observations as unrelated isolates",
      "Convert hypothesis to confirmed fact",
      "President personally inspects technical equipment",
      "Treat non-official observations as irrelevant",
      "Claim official PSC deficiencies",
    ],
  },
  {
    id: "GC04",
    title: "PLUTO LEADER — CTM / Company Liquidity",
    vessel: "PLUTO LEADER",
    inputFactsText: `Vessel: PLUTO LEADER.
Ship's Fund Report showed a reported Carry Forward of USD4,052.19.
A Nansha provision purchase estimated at USD9,591.98 had not yet been reflected in that balance.
Adjusted ship-fund position ≈ -USD5,539.79.
Target Ship Fund closing balance is USD5,000.
Standard monthly CTM reference amount is USD35,000; Recovery/stress USD40,000.
Company cash-flow needs take priority over accelerating Ship Fund recovery.
September CTM is expected to be arranged in Japan in late September.
CSI must not be remitted before receipt from Miyuki Kisen has been confirmed.
Phase 1 FinanceSnapshot is manually supplied (no auto 30/60/90 forecast).
Vessel-side funding required to reach USD5,000 target ≈ USD39,293; operational recommendation USD40,000 subject to liquidity.`,
    expectedPrimaryCaseType: "FINANCE_COMMERCIAL",
    requiredTags: ["pluto_leader", "financial_risk", "owner_interest"],
    acceptableTags: [
      "ctm",
      "ship_fund",
      "company_liquidity",
      "operational_continuity",
    ],
    expectedAuthorityRoleLabels: [
      "Ship Fund data",
      "Company cash-position",
      "Final CTM funding",
    ],
    expectedPresidentDecisionIntent: ["ctm", "liquidity", "40000", "40,000"],
    expectedRecommendationIntent: ["40000", "40,000", "liquidity", "necessary"],
    forbiddenRecommendationIntent: [
      "solely because the vessel wants",
      "solely because it is the standard",
    ],
    expectedReadiness: "CONDITIONAL",
    reviewCandidateExpected: "no",
    financeSnapshot: {
      reportedShipFund: 4052.19,
      pendingExpenses: 9591.98,
      adjustedBalance: -5539.79,
      targetClosing: 5000,
      standardCtm: 35000,
      recoveryCtm: 40000,
      vesselRequiredApprox: 39293,
      recommendedCtm: 40000,
      companyLiquidityConfirmed: false,
    },
    ngPatterns: [
      "40k solely because vessel wants it",
      "35k solely because standard",
      "Collapse necessary vs affordable",
      "Ignore USD5,000 target",
      "Count pending provision as posted actual without status",
      "CSI before Miyuki confirmation",
      "Claim liquidity without evidence",
      "READY while liquidity check missing",
    ],
  },
];

export function getGoldenSpec(id: GoldenCaseSpec["id"]) {
  return GOLDEN_CASE_SPECS.find((s) => s.id === id)!;
}
