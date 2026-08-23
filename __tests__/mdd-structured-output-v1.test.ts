import { describe, expect, it } from "vitest";
import {
  parseMddStructuredOutput,
  type MddStructuredOutput,
} from "@/lib/mdd/schema/structured-output-v1";

function baseValid(
  overrides: Partial<MddStructuredOutput> = {},
): MddStructuredOutput {
  const base: MddStructuredOutput = {
    schemaVersion: "1.0",
    primaryCaseType: "CREW_MANNING",
    tags: [],
    executive: {
      recommendation: { text: "Postpone crew change to Japan." },
      presidentDecision: {
        requiredNow: true,
        text: "Approve postponement to Japan late September.",
      },
      decisionReadiness: "READY",
      decisionAuthorities: [
        {
          id: "a1",
          roleLabel: "Final management approval",
          authority: "President/DP",
          status: "pending",
        },
      ],
      why: { text: "Core decision can be made." },
      nextActions: [
        {
          id: "n1",
          who: "Manning Agent",
          what: "Follow up documents",
          status: "open",
        },
      ],
    },
    facts: {
      confirmed: [{ id: "c1", text: "Inoy cannot board at Nansha." }],
      unverified: [],
      assumptions: [],
      missingInformation: [],
    },
    risks: [],
    options: [],
    professionalBoundaries: [],
    qualityGate: {
      passed: true,
      criticalFailures: [],
      warnings: [],
      evaluatedAt: "2026-08-23T00:00:00.000Z",
    },
    reviewCandidate: { flag: false, retainAfterClose: false },
    learning: {
      correctiveAction: false,
      preventiveAction: false,
      effectivenessVerification: false,
      horizontalCheck: false,
      fleetWideRelevance: "no",
      internalAuditCandidate: false,
      managementReviewCandidate: false,
      knowledgeUpdateCandidate: false,
    },
  };
  return { ...base, ...overrides };
}

describe("MddStructuredOutput v1.0", () => {
  it("accepts empty risks/options/professionalBoundaries", () => {
    const result = parseMddStructuredOutput(baseValid());
    expect(result.success).toBe(true);
  });

  it("rejects READY when a critical failure exists", () => {
    const result = parseMddStructuredOutput(
      baseValid({
        qualityGate: {
          passed: false,
          criticalFailures: [
            {
              code: "CRITICAL_FACT_MISSING",
              message: "Critical fact missing",
            },
          ],
          warnings: [],
          evaluatedAt: "2026-08-23T00:00:00.000Z",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("allows CONDITIONAL with critical failure cleared via passed=false path only when readiness not READY", () => {
    const result = parseMddStructuredOutput(
      baseValid({
        executive: {
          ...baseValid().executive,
          decisionReadiness: "CONDITIONAL",
        },
        qualityGate: {
          passed: false,
          criticalFailures: [
            {
              code: "FINANCIAL_DEPENDENCY_UNRESOLVED",
              message: "Liquidity unconfirmed",
            },
          ],
          warnings: [],
          evaluatedAt: "2026-08-23T00:00:00.000Z",
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("requires reviewCandidate.flag when managementReviewCandidate is true (unless monitorOnly)", () => {
    const bad = parseMddStructuredOutput(
      baseValid({
        learning: {
          ...baseValid().learning,
          managementReviewCandidate: true,
        },
        reviewCandidate: { flag: false, retainAfterClose: false },
      }),
    );
    expect(bad.success).toBe(false);

    const monitor = parseMddStructuredOutput(
      baseValid({
        learning: {
          ...baseValid().learning,
          managementReviewCandidate: true,
        },
        reviewCandidate: {
          flag: false,
          retainAfterClose: false,
          monitorOnly: true,
        },
      }),
    );
    expect(monitor.success).toBe(true);

    const flagged = parseMddStructuredOutput(
      baseValid({
        learning: {
          ...baseValid().learning,
          managementReviewCandidate: true,
        },
        reviewCandidate: {
          flag: true,
          retainAfterClose: true,
          reason: "MR candidate",
        },
      }),
    );
    expect(flagged.success).toBe(true);
  });

  it("requires finance.separationPreserved and MoneyView.origin when amount set", () => {
    const badSep = parseMddStructuredOutput(
      baseValid({
        primaryCaseType: "FINANCE_COMMERCIAL",
        finance: {
          separationPreserved: false,
          doNotAuthorizePayment: true,
          forecastsLabeledAsNonAccounting: true,
        },
      }),
    );
    expect(badSep.success).toBe(false);

    const badOrigin = parseMddStructuredOutput(
      baseValid({
        primaryCaseType: "FINANCE_COMMERCIAL",
        finance: {
          separationPreserved: true,
          doNotAuthorizePayment: true,
          forecastsLabeledAsNonAccounting: true,
          vesselOperationalRequirement: {
            amount: 39293,
            label: "required",
            currency: "USD",
          },
        },
      }),
    );
    expect(badOrigin.success).toBe(false);

    const ok = parseMddStructuredOutput(
      baseValid({
        primaryCaseType: "FINANCE_COMMERCIAL",
        finance: {
          separationPreserved: true,
          doNotAuthorizePayment: true,
          forecastsLabeledAsNonAccounting: true,
          sourceFacts: { reportedShipFund: 4052.19 },
          derivedValues: { adjustedBalance: -5539.79 },
          vesselOperationalRequirement: {
            amount: 39293,
            label: "required",
            currency: "USD",
            origin: "derived",
          },
        },
      }),
    );
    expect(ok.success).toBe(true);
  });
});
