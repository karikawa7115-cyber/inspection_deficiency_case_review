/**
 * Plausible-but-wrong Golden mutants (polished prose, structurally wrong).
 * Used by Golden LLM Evaluation Rules v1.0 regression — not production LLM.
 */
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import {
  structuredFromHeuristicProposal,
} from "./llm-eval-v1";
import { proposeFromHeuristics } from "../decision-engine/propose";
import { GOLDEN_CASE_SPECS } from "./specs";

function baseFromSpec(id: "GC01" | "GC02" | "GC03" | "GC04"): MddStructuredOutput {
  const spec = GOLDEN_CASE_SPECS.find((s) => s.id === id)!;
  const proposal = proposeFromHeuristics({
    title: spec.title,
    vessel: spec.vessel,
    pastedText: spec.inputFactsText,
    goldenCaseId: id,
    financeSnapshot: spec.financeSnapshot,
  });
  return structuredFromHeuristicProposal(proposal, {
    reviewCandidateFlag: id === "GC03",
    financeSnapshot: spec.financeSnapshot,
  });
}

/** GC01: President assigned routine visa/document chasing (polished). */
export function mutantGc01PresidentVisaChase(): MddStructuredOutput {
  const base = baseFromSpec("GC01");
  return {
    ...base,
    executive: {
      ...base.executive,
      recommendation: {
        text: "After careful review of crew readiness and voyage planning, recommend postponing the Chief Mate change from Nansha to Japan in late September, while ensuring documentation remains tightly controlled at Head Office.",
      },
      presidentDecision: {
        requiredNow: true,
        text: "Approve postponement to Japan and personally oversee remaining visa and document chasing so that Inoy is fully ready without further delay.",
      },
      nextActions: [
        {
          id: "bad_1",
          who: "President/DP",
          what: "Chase every remaining visa and travel document for Inoy until embarkation.",
          status: "open",
        },
        {
          id: "bad_2",
          who: "President/DP",
          what: "Personally manage document chasing with the manning agent week by week.",
          status: "open",
        },
      ],
    },
  };
}

/** GC02: President substitutes for technical/Class judgment (polished). */
export function mutantGc02PresidentClassJudgment(): MddStructuredOutput {
  const base = baseFromSpec("GC02");
  return {
    ...base,
    executive: {
      ...base.executive,
      recommendation: {
        text: "Given the prior ClassNK response and onboard practicality, the President should make the technical judgment on CMS open-up scope and interpret Class acceptance personally so the fleet schedule is not delayed.",
      },
      presidentDecision: {
        requiredNow: true,
        text: "President to decide the CMS technical handling and Class acceptance personally; ClassNK re-confirmation is optional.",
      },
      why: {
        text: "Management clarity is best achieved when the President substitutes for Technical Superintendent and Class interpretation in this instance.",
      },
    },
  };
}

/** GC03: Closed merely because photos/corrections submitted (polished). */
export function mutantGc03CloseOnPhotos(): MddStructuredOutput {
  const base = baseFromSpec("GC03");
  return {
    ...base,
    executive: {
      ...base.executive,
      decisionReadiness: "READY",
      recommendation: {
        text: "All Internal Audit and Panama ASI items have been corrected onboard and before/after photographs have been submitted with appropriate care. The company may treat the case as closed merely because photos and corrections were submitted, without further root-cause challenge.",
      },
      presidentDecision: {
        requiredNow: true,
        text: "Close the case on the basis of submitted photographs and corrections; no further horizontal check is required.",
      },
      why: {
        text: "Evidence packages are complete and polished; closure is therefore appropriate.",
      },
    },
    reviewCandidate: {
      flag: false,
      retainAfterClose: false,
    },
    learning: {
      ...base.learning,
      managementReviewCandidate: false,
      internalAuditCandidate: false,
      horizontalCheck: false,
      correctiveAction: false,
      preventiveAction: false,
      effectivenessVerification: false,
      notes: "Closed on photo evidence; further learning deferred.",
    },
  };
}

/** GC04: USD40,000 CTM approved without confirming Company liquidity (polished). */
export function mutantGc04CtmWithoutLiquidity(): MddStructuredOutput {
  const base = baseFromSpec("GC04");
  return {
    ...base,
    executive: {
      ...base.executive,
      decisionReadiness: "READY",
      recommendation: {
        text: "Vessel-side figures clearly support USD40,000 as the appropriate CTM. Approve and remit USD40,000 immediately; Company liquidity can be assumed sufficient based on normal monthly patterns.",
      },
      presidentDecision: {
        requiredNow: true,
        text: "Approve USD40,000 CTM now without waiting for a fresh Company liquidity confirmation.",
      },
      why: {
        text: "Operational necessity is clear and the amount is standard recovery practice.",
      },
    },
    finance: {
      ...base.finance!,
      separationPreserved: true,
      doNotAuthorizePayment: true,
      forecastsLabeledAsNonAccounting: true,
      companyFinancialFeasibility: {
        liquidityConfirmed: false,
        note: "Not reconfirmed; assumed OK.",
        blockingIfUnconfirmed: true,
      },
      sourceFacts: {
        ...base.finance!.sourceFacts,
        companyLiquidityConfirmed: false,
      },
    },
  };
}
