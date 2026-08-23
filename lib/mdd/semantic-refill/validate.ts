/**
 * Deterministic Bounded Validator for Semantic Refill v0.3.
 * Fail-closed: non-empty alone is insufficient.
 */
import type { CurrentDecisionQuestion } from "../case-envelope/current-decision-question";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import {
  isAbsentPresidentText,
  isContradictoryPresidentText,
  isNotRequiredPresidentText,
} from "./prose-defect";

export type RefillValidationCode =
  | "EMPTY"
  | "STILL_NOT_REQUIRED"
  | "CDQ_CONTRADICTION"
  | "DEFERRED_AS_CURRENT"
  | "PROFESSIONAL_BOUNDARY"
  | "RECOMMENDATION_CONTRADICTION"
  | "UNSUPPORTED_TECHNICAL_INVENTION"
  | "UNSUPPORTED_FINANCIAL_INVENTION"
  | "MUTATED_NON_PD_FIELD";

export type RefillValidationResult = {
  accepted: boolean;
  codes: RefillValidationCode[];
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function significantTokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

/** Soft CDQ alignment: reject clear opposite/abandon when CDQ asks maintain/confirm/approve. */
function contradictsCdq(text: string, cdq: CurrentDecisionQuestion): boolean {
  const t = norm(text);
  const q = norm(cdq.decisionRequiredNow);
  if (/maintain|subject to|re-?confirm|clarif/i.test(q)) {
    if (
      /\b(abandon|reject|cancel)\b.*\b(plan|approach|handling)\b/i.test(t) &&
      !/\b(do not|must not|without)\b.*\b(abandon)\b/i.test(t)
    ) {
      return true;
    }
  }
  if (/postpon|japan|nansha|crew change/i.test(q)) {
    if (
      /\b(force|insist|proceed)\b.*\bnansha\b/i.test(t) &&
      !/\b(do not|must not|not)\b.*\bnansha\b/i.test(t)
    ) {
      return true;
    }
  }
  if (/close|closure|rectif|root.?cause|horizontal|effectiveness/i.test(q)) {
    if (
      /\b(close|closed|closure)\b.*\b(now|photos?|corrections?)\b/i.test(t) &&
      !/\b(do not|must not|not|may not)\b/i.test(t)
    ) {
      return true;
    }
  }
  if (/ctm|liquidity|funding|amount/i.test(q)) {
    if (
      /\b(approve|remit|authorize)\b.*\b(usd\s*)?\d/i.test(t) &&
      /\b(without|ignore).*(liquidity|confirm)/i.test(t)
    ) {
      return true;
    }
  }
  return false;
}

function convertsDeferredToCurrent(
  text: string,
  cdq: CurrentDecisionQuestion,
): boolean {
  const t = norm(text);
  const deferred = cdq.deferredToExecutionOrClosure ?? [];
  for (const item of deferred) {
    const tokens = significantTokens(item).filter(
      (tok) =>
        !["after", "before", "with", "from", "that", "this", "only"].includes(
          tok,
        ),
    );
    if (tokens.length < 2) continue;
    const hit = tokens.filter((tok) => t.includes(tok)).length;
    if (hit < Math.min(2, tokens.length)) continue;
    // Deciding the deferred item now (approve/set/finalize that item)
    if (
      /\b(decide|approve|finalize|determine|set|confirm)\b/i.test(text) &&
      tokens.some((tok) => t.includes(tok))
    ) {
      // Allow mentioning deferred as deferred/later
      if (
        /\b(defer|later|after|execution|closure|not\s+now|once|when)\b/i.test(
          text,
        )
      ) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function violatesProfessionalBoundary(
  text: string,
  boundaries: MddStructuredOutput["professionalBoundaries"],
): boolean {
  const t = norm(text);
  for (const b of boundaries) {
    const issue = norm(b.issue);
    // Common forbidden patterns mirrored in issue text
    if (
      /photo.?only|photos?\s+alone|class\s+accept|nk\s+approved|authorize\s+payment|bank\s+transfer/i.test(
        issue,
      )
    ) {
      if (
        /photo.?only|photos?\s+alone|class\s+has\s+approved|nk\s+approved\s+everything|authorize\s+(payment|transfer)/i.test(
          t,
        )
      ) {
        return true;
      }
    }
    // If issue says must not X and text asserts X without negation
    const mustNot = issue.match(/must not ([^.]+)/i);
    if (mustNot?.[1]) {
      const frag = significantTokens(mustNot[1]).slice(0, 4);
      if (
        frag.length >= 2 &&
        frag.every((tok) => t.includes(tok)) &&
        !/\b(must not|do not|not)\b/i.test(text)
      ) {
        return true;
      }
    }
  }
  return false;
}

function contradictsRecommendation(
  text: string,
  recommendation: MddStructuredOutput["executive"]["recommendation"],
): boolean {
  const t = norm(text);
  const r = norm(recommendation.text);
  if (/maintain|subject to|re-?confirm|clarif/i.test(r)) {
    if (
      /\b(abandon|scrap|reject)\b.*\b(plan|approach|handling|cms)\b/i.test(t) &&
      !/\b(do not|must not|without evidence)\b/i.test(t)
    ) {
      return true;
    }
  }
  if (/postpon/i.test(r) && /force.*nansha|insist.*nansha/i.test(t)) {
    return true;
  }
  if (
    /do not close|not close|rectif|root.?cause|horizontal/i.test(r) &&
    /\bclose\b.*\b(now|photos?)\b/i.test(t) &&
    !/\b(do not|must not|not)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /subject to.*liquidity|necessary.*affordable|liquidity/i.test(r) &&
    /\b(approve|remit)\b.*\b40,?000\b/i.test(t) &&
    /\b(confirmed liquidity|liquidity is sufficient|can afford)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

function inventsUnsupportedTechnical(text: string): boolean {
  return (
    /class(?:nk)?\s+(has\s+)?approved\s+(everything|all)/i.test(text) ||
    /class(?:nk)?\s+acceptance\s+(is\s+)?(confirmed|complete|definite)/i.test(
      text,
    ) ||
    /flag\s+(items?\s+)?(are\s+)?closed/i.test(text) ||
    /technical(?:ly)?\s+(safe|accepted|cleared)\s+without/i.test(text)
  );
}

function inventsUnsupportedFinancial(text: string): boolean {
  return (
    /liquidity\s+(is\s+)?(confirmed|sufficient|adequate)/i.test(text) ||
    /company\s+can\s+afford/i.test(text) ||
    /authorize[sd]?\s+(payment|remittance|transfer|bank)/i.test(text) ||
    /approve[sd]?\s+(final\s+)?(ctm|remittance).*\bwithout\b.*liquidity/i.test(
      text,
    )
  );
}

/**
 * Compare drafts: only presidentDecision.text may differ; requiredNow must stay true.
 */
export function detectNonPdMutation(
  before: MddStructuredOutput,
  after: MddStructuredOutput,
): boolean {
  const b = structuredClone(before);
  const a = structuredClone(after);
  b.executive.presidentDecision.text = "";
  a.executive.presidentDecision.text = "";
  return JSON.stringify(b) !== JSON.stringify(a);
}

export function validatePresidentDecisionRefill(input: {
  proposedText: string;
  cdq: CurrentDecisionQuestion;
  controlled: MddStructuredOutput;
  /** Draft after applying only PD text — for mutation check */
  candidateDraft: MddStructuredOutput;
}): RefillValidationResult {
  const codes: RefillValidationCode[] = [];
  const text = input.proposedText ?? "";

  if (isAbsentPresidentText(text)) codes.push("EMPTY");
  if (isNotRequiredPresidentText(text) || isContradictoryPresidentText(text)) {
    codes.push("STILL_NOT_REQUIRED");
  }
  if (contradictsCdq(text, input.cdq)) codes.push("CDQ_CONTRADICTION");
  if (convertsDeferredToCurrent(text, input.cdq)) {
    codes.push("DEFERRED_AS_CURRENT");
  }
  if (
    violatesProfessionalBoundary(text, input.controlled.professionalBoundaries)
  ) {
    codes.push("PROFESSIONAL_BOUNDARY");
  }
  if (
    contradictsRecommendation(text, input.controlled.executive.recommendation)
  ) {
    codes.push("RECOMMENDATION_CONTRADICTION");
  }
  if (inventsUnsupportedTechnical(text)) {
    codes.push("UNSUPPORTED_TECHNICAL_INVENTION");
  }
  if (inventsUnsupportedFinancial(text)) {
    codes.push("UNSUPPORTED_FINANCIAL_INVENTION");
  }
  if (detectNonPdMutation(input.controlled, input.candidateDraft)) {
    codes.push("MUTATED_NON_PD_FIELD");
  }
  if (!input.candidateDraft.executive.presidentDecision.requiredNow) {
    codes.push("MUTATED_NON_PD_FIELD");
  }

  return { accepted: codes.length === 0, codes };
}
