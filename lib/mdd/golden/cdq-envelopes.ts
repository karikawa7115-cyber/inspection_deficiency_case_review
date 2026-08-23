/**
 * Golden Case input envelopes — Current Decision Question only.
 * Does not change Golden expected decisions/results (specs.ts remains SSoT for expectations).
 */
import type { CurrentDecisionQuestion } from "../case-envelope/current-decision-question";
import type { GoldenCaseSpec } from "./specs";

export const GOLDEN_CASE_CDQ: Record<
  GoldenCaseSpec["id"],
  CurrentDecisionQuestion
> = {
  GC01: {
    decisionClass: "crew_change_postponement",
    decisionRequiredNow:
      "Should management approve postponing the planned Nansha Chief Mate change to Japan during Voy.071 in late September?",
    expectedDecider: "President/DP (final management approval of postponement)",
    deferredToExecutionOrClosure: [
      "Exact Japanese port and ETA",
      "C/M Inoy remaining documentation and travel readiness follow-up",
      "Routine manning-agent document chasing",
    ],
  },
  GC02: {
    decisionClass: "technical_class_handling_confirm",
    decisionRequiredNow:
      "Should management maintain the current CMS handling plan subject to one focused ClassNK re-confirmation of item scope and acceptance?",
    expectedDecider:
      "Superintendent (technical) with Class confirmation; President/DP for final management confirmation only",
    deferredToExecutionOrClosure: [
      "Written ClassNK reply detail",
      "Item-by-item open-up execution feasibility confirmation",
      "Owner-side notification after clarification",
    ],
  },
  GC03: {
    decisionClass: "inspection_non_closure",
    decisionRequiredNow:
      "May Company close Internal Audit / Panama ASI items now, or must rectification, root-cause challenge, horizontal check, and effectiveness verification remain open?",
    expectedDecider:
      "President/DP (final acceptance of Company closure / management follow-up)",
    deferredToExecutionOrClosure: [
      "Full verbatim Panama ASI observation wording",
      "Before/after photo packs as execution evidence",
      "Detailed CR-5/CR-6 content verification packages",
    ],
  },
  GC04: {
    decisionClass: "finance_funding_amount",
    decisionRequiredNow:
      "What September CTM amount should be approved given vessel-side requirement versus Company liquidity feasibility?",
    expectedDecider: "President/DP (final CTM funding decision)",
    deferredToExecutionOrClosure: [
      "Final remittance payee and exact transfer date",
      "Agent delivery logistics after authorization",
      "CSI remittance timing after Miyuki Kisen receipt confirmation",
    ],
  },
};

export function getGoldenCaseCdq(
  id: GoldenCaseSpec["id"],
): CurrentDecisionQuestion {
  return GOLDEN_CASE_CDQ[id];
}
