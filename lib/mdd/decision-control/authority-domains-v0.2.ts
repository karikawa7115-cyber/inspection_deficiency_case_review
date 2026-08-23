/**
 * Decision Policy v0.2 — Authority Domain resolution (AD-INSPECT-RC, AD-FINANCE-SHIPFUND).
 * Generalized triggers only — never Golden/vessel IDs.
 */
import type {
  CaseEnvelope,
  CurrentDecisionQuestion,
  DecisionClass,
} from "../case-envelope/current-decision-question";
import type { FinanceSourceInput } from "../quality-gate/finance-activation-v1.1";
import type { MddStructuredOutput } from "../schema/structured-output-v1";
import type { OrgAuthorityDefaults } from "./org-defaults";

export type AuthorityDomainId = "RC_SMS_FOLLOWUP" | "SHIP_FUND_SOURCE";

export type ResolvedAuthorityRole = {
  authority: string;
  roleLabel: string;
  source: "reuse" | "case_context" | "org_fallback";
};

export type AuthorityDomainResolution = {
  domain: AuthorityDomainId;
  required: boolean;
  resolved: ResolvedAuthorityRole | null;
  unresolved: boolean;
};

const RC_COVER =
  /root[\s-]?cause|sms|capa|corrective.?system|dpa|designated person|audit follow|management system follow/i;
const SHIP_FUND_COVER =
  /ship[\s-]?fund|vessel[\s-]?cash|carry[\s-]?forward|vessel[\s-]?side (?:fund|cash|balance)|fund data|cash evidence/i;

function authBlob(
  a: MddStructuredOutput["executive"]["decisionAuthorities"][number],
): string {
  return `${a.roleLabel} ${a.authority} ${a.authorityDetail ?? ""} ${a.notes ?? ""}`;
}

export function domainAlreadyCovered(
  list: MddStructuredOutput["executive"]["decisionAuthorities"],
  domain: AuthorityDomainId,
): ResolvedAuthorityRole | null {
  const re = domain === "RC_SMS_FOLLOWUP" ? RC_COVER : SHIP_FUND_COVER;
  const hit = list.find((a) => re.test(authBlob(a)));
  if (!hit) return null;
  return {
    authority: String(hit.authority),
    roleLabel: hit.roleLabel,
    source: "reuse",
  };
}

export function triggersRcSmsFollowup(input: {
  decisionClass: DecisionClass;
  primaryCaseType: string;
  cdq: CurrentDecisionQuestion;
  controlled: MddStructuredOutput;
}): boolean {
  const inspect =
    input.decisionClass === "inspection_non_closure" ||
    input.primaryCaseType === "INSPECTION_COMPLIANCE" ||
    input.primaryCaseType === "ISM_MANAGEMENT";
  if (!inspect) return false;

  const learning = input.controlled.learning;
  const cdqBlob = [
    input.cdq.decisionRequiredNow,
    input.cdq.expectedDecider,
    ...(input.cdq.deferredToExecutionOrClosure ?? []),
  ].join("\n");

  const rcCapaSignals =
    learning.correctiveAction ||
    learning.preventiveAction ||
    learning.horizontalCheck ||
    learning.effectivenessVerification ||
    input.controlled.tags.some((t) =>
      /root_cause|horizontal|effectiveness|capa|system_weakness/i.test(t),
    ) ||
    /root[\s-]?cause|capa|horizontal|effectiveness|sms|corrective/i.test(
      cdqBlob,
    ) ||
    input.controlled.facts.missingInformation.some((m) =>
      /root[\s-]?cause|horizontal|effectiveness|capa/i.test(m.text),
    ) ||
    input.controlled.facts.assumptions.some((a) =>
      /system weakness|root[\s-]?cause/i.test(a.text),
    );

  return rcCapaSignals;
}

export function triggersShipFundSource(input: {
  decisionClass: DecisionClass;
  primaryCaseType: string;
  cdq: CurrentDecisionQuestion;
  financeSourceInput?: FinanceSourceInput | null;
  controlled: MddStructuredOutput;
}): boolean {
  const fundingOriented =
    input.decisionClass === "finance_funding_amount" ||
    input.primaryCaseType === "FINANCE_COMMERCIAL";
  if (!fundingOriented) return false;

  const src = input.financeSourceInput;
  const materialVesselSide =
    src != null &&
    (typeof src.reportedShipFund === "number" ||
      typeof src.pendingExpenses === "number" ||
      typeof src.adjustedBalance === "number" ||
      typeof src.vesselRequiredApprox === "number" ||
      typeof src.standardCtm === "number" ||
      typeof src.recoveryCtm === "number" ||
      typeof src.recommendedCtm === "number");

  const fin = input.controlled.finance;
  const draftVesselSide = Boolean(
    fin?.sourceFacts?.reportedShipFund != null ||
      fin?.sourceFacts?.pendingExpenses != null ||
      fin?.derivedValues?.vesselRequiredApprox != null ||
      fin?.derivedValues?.adjustedBalance != null ||
      fin?.snapshot?.reportedShipFund != null ||
      fin?.vesselOperationalRequirement?.amount != null,
  );

  const cdqBlob = [
    input.cdq.decisionRequiredNow,
    ...(input.cdq.deferredToExecutionOrClosure ?? []),
  ].join("\n");
  const cdqVesselSide =
    /ship[\s-]?fund|ctm|carry[\s-]?forward|vessel[\s-]?side|pending expenses|cash onboard/i.test(
      cdqBlob,
    );

  return materialVesselSide || draftVesselSide || cdqVesselSide;
}

function resolveFromCaseContext(
  domain: AuthorityDomainId,
  envelope: CaseEnvelope,
  cdq: CurrentDecisionQuestion,
): ResolvedAuthorityRole | null {
  const owned = envelope.authorityContext?.domainOwners?.[domain];
  if (owned?.authority?.trim() && owned.roleLabel?.trim()) {
    return {
      authority: owned.authority.trim(),
      roleLabel: owned.roleLabel.trim(),
      source: "case_context",
    };
  }

  const ctxBlob = [
    cdq.expectedDecider,
    cdq.decisionRequiredNow,
    ...(cdq.deferredToExecutionOrClosure ?? []),
    envelope.authorityContext?.raciNotes ?? "",
  ].join("\n");

  if (domain === "RC_SMS_FOLLOWUP") {
    if (/dpa|designated person|sms owner|compliance manager|internal audit/i.test(ctxBlob)) {
      return {
        authority: "President/DP",
        roleLabel: "Root cause / SMS / CAPA follow-up",
        source: "case_context",
      };
    }
    if (/root[\s-]?cause.*(owner|follow)|sms follow|capa (?:owner|follow)/i.test(ctxBlob)) {
      return {
        authority: "President/DP",
        roleLabel: "Root cause / SMS / CAPA follow-up",
        source: "case_context",
      };
    }
    return null;
  }

  // SHIP_FUND_SOURCE
  if (/master|chief engineer|vessel accounts|ship.?s fund owner/i.test(ctxBlob)) {
    return {
      authority: "Master",
      roleLabel: "Ship Fund data / vessel cash evidence",
      source: "case_context",
    };
  }
  return null;
}

function resolveOrgFallback(
  domain: AuthorityDomainId,
  org: OrgAuthorityDefaults,
): ResolvedAuthorityRole | null {
  if (domain === "RC_SMS_FOLLOWUP" && org.rcSmsOwner === "DP") {
    return {
      authority: "President/DP",
      roleLabel: "Root cause / SMS / CAPA follow-up",
      source: "org_fallback",
    };
  }
  if (domain === "SHIP_FUND_SOURCE" && org.shipFundOwner === "Master") {
    return {
      authority: "Master",
      roleLabel: "Ship Fund data / vessel cash evidence",
      source: "org_fallback",
    };
  }
  return null;
}

/**
 * Resolve a required authority domain without inventing Golden-specific roles.
 */
export function resolveAuthorityDomain(input: {
  domain: AuthorityDomainId;
  required: boolean;
  controlled: MddStructuredOutput;
  envelope: CaseEnvelope;
  cdq: CurrentDecisionQuestion;
  orgDefaults: OrgAuthorityDefaults;
}): AuthorityDomainResolution {
  if (!input.required) {
    return {
      domain: input.domain,
      required: false,
      resolved: null,
      unresolved: false,
    };
  }

  const reused = domainAlreadyCovered(
    input.controlled.executive.decisionAuthorities,
    input.domain,
  );
  if (reused) {
    return {
      domain: input.domain,
      required: true,
      resolved: reused,
      unresolved: false,
    };
  }

  const fromCtx = resolveFromCaseContext(
    input.domain,
    input.envelope,
    input.cdq,
  );
  if (fromCtx) {
    return {
      domain: input.domain,
      required: true,
      resolved: fromCtx,
      unresolved: false,
    };
  }

  const fromOrg = resolveOrgFallback(input.domain, input.orgDefaults);
  if (fromOrg) {
    return {
      domain: input.domain,
      required: true,
      resolved: fromOrg,
      unresolved: false,
    };
  }

  return {
    domain: input.domain,
    required: true,
    resolved: null,
    unresolved: true,
  };
}
