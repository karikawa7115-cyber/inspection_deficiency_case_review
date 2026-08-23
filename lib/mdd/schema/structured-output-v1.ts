/**
 * MDD Structured Output Schema v1.0 — machine-readable implementation.
 * Human-readable SSoT: docs/mdd/STRUCTURED_OUTPUT_SCHEMA_v1.0.md (frozen).
 * Do not connect production LLM from this module.
 */
import { z } from "zod";

export const MDD_STRUCTURED_OUTPUT_SCHEMA_VERSION = "1.0" as const;

export const caseTypeSchema = z.enum([
  "OPERATIONAL",
  "TECHNICAL",
  "CREW_MANNING",
  "FINANCE_COMMERCIAL",
  "INSPECTION_COMPLIANCE",
  "ISM_MANAGEMENT",
]);

export const decisionReadinessSchema = z.enum([
  "READY",
  "CONDITIONAL",
  "NOT_READY",
]);

export const authorityKindSchema = z.enum([
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
]);

export const authorityItemStatusSchema = z.enum([
  "pending",
  "confirmed",
  "not_required",
]);

export const actionStatusSchema = z.enum(["open", "done"]);

export const fleetWideRelevanceSchema = z.enum(["yes", "possible", "no"]);

export const professionalBoundaryDomainSchema = z.enum([
  "Class",
  "Flag",
  "Master",
  "Superintendent",
  "Medical",
  "Legal",
  "Other",
]);

export const qualityGateCodeSchema = z.enum([
  "CRITICAL_FACT_MISSING",
  "SAFETY_OR_COMPLIANCE_UNRESOLVED",
  "DECISION_AUTHORITY_UNCLEAR",
  "PROFESSIONAL_BOUNDARY_VIOLATION",
  "RECOMMENDATION_UNSUPPORTED",
  "FINANCIAL_DEPENDENCY_UNRESOLVED",
  "FACT_RECOMMENDATION_CONTRADICTION",
  "WARN_SHALLOW_ROOT_CAUSE",
  "WARN_HYPOTHESIS_AS_FACT_RISK",
  "WARN_OPTIONAL_DETAIL_MISSING",
  "WARN_OPTIONAL_EVIDENCE_MISSING",
  "WARN_MONITOR_REVIEW",
  "WARN_STALE_OR_CURRENT_INFO",
  "WARN_WEAK_DELEGATION",
  "WARN_OVERLONG_EXECUTIVE",
  "WARN_UNNECESSARY_ESCALATION",
  "WARN_REVIEW_LEARNING_OPPORTUNITY",
]);

export const moneyOriginSchema = z.enum(["source", "derived"]);

const proseBlockSchema = z.object({
  text: z.string().min(1),
  intentKeys: z.array(z.string()).optional(),
});

const presidentDecisionBlockSchema = proseBlockSchema.extend({
  requiredNow: z.boolean(),
});

const decisionAuthorityItemSchema = z.object({
  id: z.string().min(1),
  roleLabel: z.string().min(1),
  authority: authorityKindSchema,
  authorityDetail: z.string().optional(),
  notes: z.string().optional(),
  status: authorityItemStatusSchema,
});

const nextActionItemSchema = z.object({
  id: z.string().min(1),
  who: z.string().min(1),
  what: z.string().min(1),
  dueOrTrigger: z.string().optional(),
  status: actionStatusSchema,
});

const executiveDecisionSchema = z.object({
  recommendation: proseBlockSchema,
  presidentDecision: presidentDecisionBlockSchema,
  decisionReadiness: decisionReadinessSchema,
  decisionAuthorities: z.array(decisionAuthorityItemSchema).min(1),
  why: proseBlockSchema,
  nextActions: z.array(nextActionItemSchema),
});

const factItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  classification: z.enum(["confirmed", "unverified", "assumption"]).optional(),
  hypothesis: z.boolean().optional(),
});

const missingInformationItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  who: z.string().min(1),
  what: z.string().min(1),
  evidenceRequired: z.string().min(1),
  blocksReadiness: z.boolean().optional(),
});

const factBundleSchema = z.object({
  confirmed: z.array(factItemSchema),
  unverified: z.array(factItemSchema),
  assumptions: z.array(factItemSchema),
  missingInformation: z.array(missingInformationItemSchema),
});

const optionItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
});

const professionalBoundaryItemSchema = z.object({
  id: z.string().min(1),
  domain: professionalBoundaryDomainSchema,
  issue: z.string().min(1),
  evidenceNeeded: z.string().optional(),
  questionForAuthority: z.string().optional(),
  responsibleAuthority: z.union([authorityKindSchema, z.string()]),
  escalationPath: z.string().optional(),
});

const gateFindingSchema = z.object({
  code: qualityGateCodeSchema,
  message: z.string().min(1),
  relatedFieldPaths: z.array(z.string()).optional(),
});

const qualityGateSchema = z.object({
  passed: z.boolean(),
  criticalFailures: z.array(gateFindingSchema),
  warnings: z.array(gateFindingSchema),
  evaluatedAt: z.string().min(1),
});

const reviewCandidateSchema = z.object({
  flag: z.boolean(),
  reason: z.string().optional(),
  retainAfterClose: z.boolean(),
  monitorOnly: z.boolean().optional(),
});

const managementLearningSchema = z.object({
  correctiveAction: z.boolean(),
  preventiveAction: z.boolean(),
  effectivenessVerification: z.boolean(),
  horizontalCheck: z.boolean(),
  fleetWideRelevance: fleetWideRelevanceSchema,
  internalAuditCandidate: z.boolean(),
  managementReviewCandidate: z.boolean(),
  knowledgeUpdateCandidate: z.boolean(),
  notes: z.string().optional(),
});

/** Structural MoneyView (Pre-Control). Origin-when-amount is Canonical-only. */
const moneyViewSchema = z.object({
  amount: z.number().optional(),
  currency: z.string().default("USD"),
  label: z.string().min(1),
  asOf: z.string().optional(),
  origin: moneyOriginSchema.optional(),
});

const feasibilityViewSchema = z.object({
  liquidityConfirmed: z.boolean(),
  note: z.string().optional(),
  blockingIfUnconfirmed: z.boolean(),
});

const financeSourceFactsSchema = z.object({
  reportedShipFund: z.number().optional(),
  pendingExpenses: z.number().optional(),
  targetClosing: z.number().optional(),
  standardCtm: z.number().optional(),
  recoveryCtm: z.number().optional(),
  companyLiquidityNote: z.string().optional(),
  companyLiquidityConfirmed: z.boolean().optional(),
  asOfDate: z.string().optional(),
  notes: z.string().optional(),
});

const financeDerivedValuesSchema = z.object({
  adjustedBalance: z.number().optional(),
  vesselRequiredApprox: z.number().optional(),
  recommendedCtm: z.number().optional(),
  scenarioNotes: z.string().optional(),
});

const financeSnapshotSchema = z.object({
  reportedShipFund: z.number().optional(),
  pendingExpenses: z.number().optional(),
  adjustedBalance: z.number().optional(),
  targetClosing: z.number().optional(),
  standardCtm: z.number().optional(),
  recoveryCtm: z.number().optional(),
  vesselRequiredApprox: z.number().optional(),
  recommendedCtm: z.number().optional(),
  companyLiquidityNote: z.string().optional(),
  companyLiquidityConfirmed: z.boolean().optional(),
  asOfDate: z.string().optional(),
  notes: z.string().optional(),
});

const financeExtensionSchema = z.object({
  vesselOperationalRequirement: moneyViewSchema.optional(),
  companyFinancialFeasibility: feasibilityViewSchema.optional(),
  separationPreserved: z.boolean(),
  sourceFacts: financeSourceFactsSchema.optional(),
  derivedValues: financeDerivedValuesSchema.optional(),
  snapshot: financeSnapshotSchema.optional(),
  hardDependencies: z.array(z.string()).optional(),
  doNotAuthorizePayment: z.boolean(),
  forecastsLabeledAsNonAccounting: z.boolean(),
});

const inspectionIsmExtensionSchema = z.object({
  rootCauseChallengeRequired: z.boolean(),
  shallowRootCauseRejected: z.boolean().optional(),
  horizontalCheckExpected: z.boolean(),
  effectivenessVerificationExpected: z.boolean(),
  photoAloneInsufficient: z.boolean(),
  systemWeaknessHypothesis: z.string().optional(),
  personProcedureChain: z.string().optional(),
});

const debugExtensionSchema = z.object({
  engine: z.string().optional(),
  engineNotes: z.string().optional(),
  rawModelTrace: z.unknown().optional(),
});

const CRITICAL_CODES = new Set([
  "CRITICAL_FACT_MISSING",
  "SAFETY_OR_COMPLIANCE_UNRESOLVED",
  "DECISION_AUTHORITY_UNCLEAR",
  "PROFESSIONAL_BOUNDARY_VIOLATION",
  "RECOMMENDATION_UNSUPPORTED",
  "FINANCIAL_DEPENDENCY_UNRESOLVED",
  "FACT_RECOMMENDATION_CONTRADICTION",
]);

export const mddStructuredOutputObjectSchema = z.object({
  schemaVersion: z.literal(MDD_STRUCTURED_OUTPUT_SCHEMA_VERSION),
  primaryCaseType: caseTypeSchema,
  tags: z.array(z.string()),
  executive: executiveDecisionSchema,
  facts: factBundleSchema,
  risks: z.array(z.string()),
  options: z.array(optionItemSchema),
  professionalBoundaries: z.array(professionalBoundaryItemSchema),
  qualityGate: qualityGateSchema,
  reviewCandidate: reviewCandidateSchema,
  learning: managementLearningSchema,
  finance: financeExtensionSchema.optional(),
  inspectionIsm: inspectionIsmExtensionSchema.optional(),
  debug: debugExtensionSchema.optional(),
});

/**
 * Canonical Structured Output Schema v1.0 (frozen contract) — includes cross-field superRefine.
 */
export const mddStructuredOutputSchema = mddStructuredOutputObjectSchema.superRefine(
  (data, ctx) => {
    const criticalCount = data.qualityGate.criticalFailures.length;
    const passedExpected = criticalCount === 0;

    if (data.qualityGate.passed !== passedExpected) {
      ctx.addIssue({
        code: "custom",
        message:
          "qualityGate.passed must equal (criticalFailures.length === 0)",
        path: ["qualityGate", "passed"],
      });
    }

    for (const [i, finding] of data.qualityGate.criticalFailures.entries()) {
      if (!CRITICAL_CODES.has(finding.code)) {
        ctx.addIssue({
          code: "custom",
          message: `criticalFailures[${i}] must use a critical QualityGateCode, not a WARN_* code`,
          path: ["qualityGate", "criticalFailures", i, "code"],
        });
      }
    }

    if (
      criticalCount > 0 &&
      data.executive.decisionReadiness === "READY"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "decisionReadiness READY is invalid when any critical failure exists",
        path: ["executive", "decisionReadiness"],
      });
    }

    if (data.finance) {
      if (!data.finance.separationPreserved) {
        ctx.addIssue({
          code: "custom",
          message: "finance.separationPreserved must be true",
          path: ["finance", "separationPreserved"],
        });
      }
      if (!data.finance.doNotAuthorizePayment) {
        ctx.addIssue({
          code: "custom",
          message: "finance.doNotAuthorizePayment must be true",
          path: ["finance", "doNotAuthorizePayment"],
        });
      }

      const moneyViews: Array<{ amount?: number; origin?: string } | undefined> =
        [data.finance.vesselOperationalRequirement];
      for (const [i, mv] of moneyViews.entries()) {
        if (mv && mv.amount !== undefined && mv.origin === undefined) {
          ctx.addIssue({
            code: "custom",
            message: "MoneyView.origin is required when amount is present",
            path: ["finance", "vesselOperationalRequirement", "origin"],
          });
        }
      }
    }

    if (
      data.learning.managementReviewCandidate === true &&
      data.reviewCandidate.flag !== true &&
      data.reviewCandidate.monitorOnly !== true
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "managementReviewCandidate YES normally requires reviewCandidate.flag true (MONITOR may keep flag false)",
        path: ["reviewCandidate", "flag"],
      });
    }
  },
);

export type MddStructuredOutput = z.infer<typeof mddStructuredOutputSchema>;

export type ParseMddStructuredOutputResult =
  | { success: true; data: MddStructuredOutput }
  | { success: false; error: z.ZodError };

/** Pre-Control structural validation only (no cross-field policy superRefine). */
export function parseMddStructuredOutputStructural(
  input: unknown,
): ParseMddStructuredOutputResult {
  const result = mddStructuredOutputObjectSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/** Canonical Schema v1.0 validation (shape + cross-field policy). */
export function parseMddStructuredOutput(
  input: unknown,
): ParseMddStructuredOutputResult {
  const result = mddStructuredOutputSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
