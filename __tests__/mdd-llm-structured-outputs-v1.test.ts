import { describe, expect, it } from "vitest";
import { normalizeMddStructuredOutputV1 } from "../lib/mdd/llm/normalize-structured-v1";
import { getMddOpenAiStrictJsonSchema } from "../lib/mdd/llm/openai-strict-json-schema-v1";

describe("OpenAI strict JSON Schema adapter", () => {
  it("produces a strict object root with additionalProperties false", () => {
    const schema = getMddOpenAiStrictJsonSchema();
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(Array.isArray(schema.required)).toBe(true);
    const props = schema.properties as Record<string, unknown>;
    expect(props.schemaVersion).toBeTruthy();
    expect(props.finance).toBeTruthy();
    // optional top-level finance must be required+nullable under strict mode
    expect(schema.required).toContain("finance");
  });
});

describe("normalizeMddStructuredOutputV1", () => {
  it("strips null optionals and stringifies numeric ids only", () => {
    const { normalized, repairs } = normalizeMddStructuredOutputV1({
      executive: {
        decisionAuthorities: [{ id: 1, authority: "President", notes: null }],
      },
      facts: { assumptions: [{ id: 2, hypothesis: "true" }] },
    });
    expect(repairs).toEqual(
      expect.arrayContaining([
        "strip_null_optional_keys",
        "coerce_numeric_ids_to_string",
        "coerce_hypothesis_boolean_strings",
      ]),
    );
    const n = normalized as {
      executive: {
        decisionAuthorities: [{ id: string; authority: string; notes?: string }];
      };
      facts: { assumptions: [{ id: string; hypothesis: boolean }] };
    };
    expect(n.executive.decisionAuthorities[0].id).toBe("1");
    expect(n.executive.decisionAuthorities[0].authority).toBe("President");
    expect(n.executive.decisionAuthorities[0].notes).toBeUndefined();
    expect(n.facts.assumptions[0].hypothesis).toBe(true);
  });

  it("does not invent finance or remap authorities", () => {
    const { normalized } = normalizeMddStructuredOutputV1({
      primaryCaseType: "FINANCE_COMMERCIAL",
      executive: {
        decisionAuthorities: [{ id: "a1", authority: "President" }],
        decisionReadiness: "READY",
      },
    });
    const n = normalized as Record<string, unknown>;
    expect(n.finance).toBeUndefined();
    expect(
      (n.executive as { decisionAuthorities: { authority: string }[] })
        .decisionAuthorities[0].authority,
    ).toBe("President");
  });
});
