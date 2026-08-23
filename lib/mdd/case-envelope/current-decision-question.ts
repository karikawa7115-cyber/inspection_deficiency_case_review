/**
 * Current Decision Question — first-class Case Envelope field (Decision Control v0.1).
 * Not part of frozen Structured Output Schema v1.0.
 */

/** Generalized decision-class tokens — never Golden Case IDs. */
export type DecisionClass =
  | "crew_change_postponement"
  | "technical_class_handling_confirm"
  | "inspection_non_closure"
  | "finance_funding_amount"
  | "generic";

export type CurrentDecisionQuestion = {
  /** What decision is currently required. */
  decisionRequiredNow: string;
  /** Who is expected to make/confirm it (role or authority kind). */
  expectedDecider: string;
  /** Intentionally deferred to execution/closure — not part of the current decision. */
  deferredToExecutionOrClosure: string[];
  /** Optional generalized class for Control rules (not Golden identity). */
  decisionClass?: DecisionClass;
};

export type CaseEnvelope = {
  title: string;
  vessel?: string;
  pastedText?: string;
  currentDecisionQuestion?: CurrentDecisionQuestion | null;
  /** Optional pre-known tags from caller (merged by R1). */
  knownTags?: string[];
  /**
   * Authoritative Case Context for authority-domain resolution (Decision Policy v0.2).
   * Prefer over organizational env fallbacks.
   */
  authorityContext?: {
    domainOwners?: Partial<{
      RC_SMS_FOLLOWUP: { authority: string; roleLabel: string };
      SHIP_FUND_SOURCE: { authority: string; roleLabel: string };
    }>;
    /** Free-text RACI / provenance used for domain role resolution. */
    raciNotes?: string;
  };
};

export function expectedDeciderRequiresPresident(expectedDecider: string): boolean {
  return /president|dpa|\bdp\b|designated person/i.test(expectedDecider);
}
