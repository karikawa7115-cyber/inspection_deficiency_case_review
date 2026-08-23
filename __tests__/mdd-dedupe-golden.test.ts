import { describe, expect, it } from "vitest";
import { dedupeGoldenCases } from "@/lib/mdd/data/local-case-repository";
import type { MddCase } from "@/lib/mdd/types";

function stub(partial: Partial<MddCase> & Pick<MddCase, "id" | "title">): MddCase {
  return {
    primaryCaseTypeConfirmed: false,
    tags: [],
    tagsConfirmed: false,
    status: "NEW",
    reviewCandidateFlag: false,
    reviewCandidateConfirmed: false,
    pastedText: "",
    structuredFacts: [],
    contextPack: {
      companyCore: true,
      businessPartners: [],
      people: [],
      relatedCaseIds: [],
      aiSuggested: false,
      humanConfirmed: false,
    },
    recommendationConfirmed: false,
    presidentDecisionConfirmed: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("dedupeGoldenCases", () => {
  it("keeps deterministic golden-* id over legacy random id", () => {
    const legacy = stub({
      id: "case_old_gc01",
      title: "PLUTO LEADER — C/M Inoy Crew Change",
      goldenCaseId: "GC01",
      updatedAt: "2026-08-23T01:00:00.000Z",
    });
    const canonical = stub({
      id: "golden-GC01",
      title: "PLUTO LEADER — C/M Inoy Crew Change",
      goldenCaseId: "GC01",
      updatedAt: "2026-08-22T01:00:00.000Z",
    });
    const { cases, removed } = dedupeGoldenCases([legacy, canonical]);
    expect(removed).toBe(1);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.id).toBe("golden-GC01");
  });

  it("leaves non-golden cases untouched", () => {
    const a = stub({ id: "case_a", title: "A" });
    const b = stub({ id: "case_b", title: "B" });
    const { cases, removed } = dedupeGoldenCases([a, b]);
    expect(removed).toBe(0);
    expect(cases).toHaveLength(2);
  });
});
