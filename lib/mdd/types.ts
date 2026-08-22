/** MDD Phase 1 domain types — Design Package v1.1 */

export const CASE_TYPES = [
  "OPERATIONAL",
  "TECHNICAL",
  "CREW_MANNING",
  "FINANCE_COMMERCIAL",
  "INSPECTION_COMPLIANCE",
  "ISM_MANAGEMENT",
] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_STATUSES = [
  "NEW",
  "ANALYZING",
  "WAITING_FOR_INFORMATION",
  "DECISION_REQUIRED",
  "ACTION_IN_PROGRESS",
  "MONITORING",
  "CLOSED",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const READINESS = ["READY", "CONDITIONAL", "NOT_READY"] as const;
export type DecisionReadiness = (typeof READINESS)[number];

export const FACT_CLASSES = [
  "confirmed",
  "unverified",
  "assumption",
  "missing",
] as const;
export type FactClassification = (typeof FACT_CLASSES)[number];

export const AUTHORITY_KINDS = [
  "President/DP",
  "Superintendent",
  "Master",
  "Owner",
  "Manning Agent",
  "Class",
  "Flag Administration",
  "Finance/Accounting",
  "External Authority",
  "Other",
] as const;

export type AuthorityKind = (typeof AUTHORITY_KINDS)[number];

export const AUTHORITY_ITEM_STATUSES = [
  "pending",
  "confirmed",
  "not_required",
] as const;

export type DecisionAuthorityItem = {
  id: string;
  roleLabel: string;
  authority: AuthorityKind | string;
  notes?: string;
  status: (typeof AUTHORITY_ITEM_STATUSES)[number];
};

export type FactItem = {
  id: string;
  classification: FactClassification;
  text: string;
  who?: string;
  what?: string;
  evidenceRequired?: string;
};

export type ContextPack = {
  companyCore: boolean;
  vessel?: string;
  businessPartners: string[];
  people: string[];
  currentStatusNote?: string;
  relatedCaseIds: string[];
  aiSuggested: boolean;
  humanConfirmed: boolean;
};

export type OptionItem = {
  id: string;
  title: string;
  summary: string;
};

export type DelegationItem = {
  id: string;
  assignee: string;
  task: string;
};

export type QualityGateResult = {
  criticalFailures: string[];
  warnings: string[];
  passed: boolean;
  evaluatedAt: string;
};

export type ManagementLearning = {
  correctiveAction: boolean;
  preventiveAction: boolean;
  effectivenessVerification: boolean;
  horizontalCheck: boolean;
  fleetWideRelevance: "yes" | "possible" | "no";
  internalAuditCandidate: boolean;
  managementReviewCandidate: boolean;
  knowledgeUpdateCandidate: boolean;
  notes?: string;
};

export type FinanceSnapshot = {
  reportedShipFund?: number;
  pendingExpenses?: number;
  adjustedBalance?: number;
  targetClosing?: number;
  standardCtm?: number;
  recoveryCtm?: number;
  vesselRequiredApprox?: number;
  recommendedCtm?: number;
  companyLiquidityNote?: string;
  companyLiquidityConfirmed?: boolean;
  asOfDate?: string;
  notes?: string;
};

export type ActionItem = {
  id: string;
  text: string;
  owner: string;
  dueDate?: string;
  status: "open" | "done";
};

export type DecisionBrief = {
  recommendation: string;
  decisionReadiness: DecisionReadiness;
  decisionAuthorities: DecisionAuthorityItem[];
  presidentDecision: string;
  why: string;
  nextActions: ActionItem[];
  confirmedFacts: FactItem[];
  unverifiedFacts: FactItem[];
  assumptions: FactItem[];
  missingInformation: FactItem[];
  risks: string[];
  options: OptionItem[];
  delegation: DelegationItem[];
  communication?: string;
  learning: ManagementLearning;
  qualityGate: QualityGateResult;
  generatedAt: string;
};

export type MddCase = {
  id: string;
  title: string;
  vessel?: string;
  goldenCaseId?: "GC01" | "GC02" | "GC03" | "GC04";
  primaryCaseType?: CaseType;
  primaryCaseTypeConfirmed: boolean;
  tags: string[];
  tagsConfirmed: boolean;
  status: CaseStatus;
  reviewCandidateFlag: boolean;
  reviewCandidateConfirmed: boolean;
  pastedText: string;
  structuredFacts: FactItem[];
  contextPack: ContextPack;
  financeSnapshot?: FinanceSnapshot;
  brief?: DecisionBrief;
  recommendationConfirmed: boolean;
  presidentDecisionConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
};

export type AnalyzeProposal = {
  primaryCaseType: CaseType;
  tags: string[];
  brief: Omit<DecisionBrief, "generatedAt" | "qualityGate"> & {
    qualityGate?: QualityGateResult;
  };
};
