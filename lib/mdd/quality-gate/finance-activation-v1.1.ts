/**
 * Finance Gate activation (Decision Control / Pipeline v0.1.1 P1).
 * F1∨F2∨F3 activate Critical finance checks; F0 = LLM finance extension alone is insufficient.
 */
import type { CurrentDecisionQuestion } from "../case-envelope/current-decision-question";
import type { CaseType } from "../types";

export type FinanceSourceInput = {
  reportedShipFund?: number;
  pendingExpenses?: number;
  adjustedBalance?: number;
  targetClosing?: number;
  standardCtm?: number;
  recoveryCtm?: number;
  vesselRequiredApprox?: number;
  recommendedCtm?: number;
  companyLiquidityConfirmed?: boolean;
  companyLiquidityNote?: string;
  asOfDate?: string;
  notes?: string;
};

export type FinanceGateActivation = {
  /** When true, Finance Critical / finance liquidity-escalation paths may run. */
  active: boolean;
  reasons: Array<"F1" | "F2" | "F3">;
  /** LLM emitted finance but F1∨F2∨F3 false — must not activate Criticals. */
  spuriousLlmFinanceExtension: boolean;
};

const FUNDING_CDQ_RE =
  /funding|payment|remittance|liquidity|affordab|financial\s+approval|ctm\b|cash[\s-]?position|ship\s*fund|company\s+cash|transfer\s+approval|remit\b/i;

function isMaterialFinanceSource(
  src?: FinanceSourceInput | null,
): boolean {
  if (!src) return false;
  const nums = [
    src.reportedShipFund,
    src.pendingExpenses,
    src.adjustedBalance,
    src.targetClosing,
    src.standardCtm,
    src.recoveryCtm,
    src.vesselRequiredApprox,
    src.recommendedCtm,
  ];
  if (nums.some((n) => typeof n === "number" && Number.isFinite(n))) {
    return true;
  }
  if (typeof src.companyLiquidityConfirmed === "boolean") return true;
  if (src.companyLiquidityNote?.trim()) return true;
  return false;
}

function isFundingOrientedCdq(
  cdq?: CurrentDecisionQuestion | null,
): boolean {
  if (!cdq) return false;
  if (cdq.decisionClass === "finance_funding_amount") return true;
  const blob = `${cdq.decisionRequiredNow}\n${cdq.expectedDecider}`;
  return FUNDING_CDQ_RE.test(blob);
}

/**
 * Resolve whether Finance Gate Critical checks are active.
 * F0: llmFinanceExtensionPresent alone never activates.
 */
export function resolveFinanceGateActivation(input: {
  primaryCaseType: CaseType | string;
  currentDecisionQuestion?: CurrentDecisionQuestion | null;
  financeSourceInput?: FinanceSourceInput | null;
  llmFinanceExtensionPresent?: boolean;
}): FinanceGateActivation {
  const reasons: Array<"F1" | "F2" | "F3"> = [];

  if (input.primaryCaseType === "FINANCE_COMMERCIAL") {
    reasons.push("F1");
  }
  if (isFundingOrientedCdq(input.currentDecisionQuestion ?? null)) {
    reasons.push("F2");
  }
  if (isMaterialFinanceSource(input.financeSourceInput ?? null)) {
    reasons.push("F3");
  }

  const active = reasons.length > 0;
  const spuriousLlmFinanceExtension =
    Boolean(input.llmFinanceExtensionPresent) && !active;

  return { active, reasons, spuriousLlmFinanceExtension };
}
