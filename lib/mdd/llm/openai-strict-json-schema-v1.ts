/**
 * Convert Zod → JSON Schema into OpenAI Structured Outputs (strict) shape.
 * Does not alter the frozen Zod Schema v1.0 used for final validation.
 */
import { z } from "zod";
import { mddStructuredOutputSchema } from "../schema/structured-output-v1";

type JsonSchema = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonSchema {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function stripUnsupportedKeywords(node: JsonSchema): void {
  delete node.$schema;
  delete node.default;
  delete node.minLength;
  delete node.maxLength;
  // OpenAI supports minItems/maxItems; keep them.
}

function convertConstToEnum(node: JsonSchema): void {
  if (node.const !== undefined) {
    node.enum = [node.const];
    delete node.const;
  }
}

function fixEmptySchema(node: JsonSchema, keyHint: string): void {
  const keys = Object.keys(node).filter((k) => k !== "description" && k !== "title");
  if (keys.length === 0) {
    // e.g. z.unknown() → {} — provider needs a concrete type; string is representation-safe.
    node.type = "string";
    if (keyHint === "rawModelTrace") {
      node.description =
        "Optional opaque trace as a JSON string; omit meaning via null at parent optional fields.";
    }
  }
}

/**
 * OpenAI strict mode: every object property must be listed in `required`.
 * Optional Zod fields become `anyOf: [T, { type: "null" }]`.
 */
function makeOpenAiStrictObject(node: JsonSchema): void {
  if (node.type !== "object" || !isPlainObject(node.properties)) return;

  node.additionalProperties = false;
  const props = node.properties as Record<string, JsonSchema>;
  const required = new Set(
    Array.isArray(node.required) ? (node.required as string[]) : [],
  );

  for (const [key, prop] of Object.entries(props)) {
    walk(prop, key);
    if (!required.has(key)) {
      props[key] = { anyOf: [prop, { type: "null" }] };
      required.add(key);
    }
  }
  node.required = [...required];
}

function walk(node: unknown, keyHint = ""): void {
  if (!isPlainObject(node)) return;

  stripUnsupportedKeywords(node);
  convertConstToEnum(node);
  fixEmptySchema(node, keyHint);

  if (Array.isArray(node.anyOf)) {
    for (const branch of node.anyOf) walk(branch, keyHint);
  }
  if (Array.isArray(node.oneOf)) {
    // Prefer anyOf for OpenAI; convert oneOf → anyOf when present.
    node.anyOf = node.oneOf;
    delete node.oneOf;
    for (const branch of node.anyOf as unknown[]) walk(branch, keyHint);
  }
  if (node.items) walk(node.items, keyHint);
  if (isPlainObject(node.$defs)) {
    for (const [k, v] of Object.entries(node.$defs)) walk(v, k);
  }
  if (isPlainObject(node.definitions)) {
    for (const [k, v] of Object.entries(node.definitions)) walk(v, k);
  }

  if (node.type === "object") {
    makeOpenAiStrictObject(node);
  }
}

/** Machine schema for provider-enforced Structured Outputs (Schema v1.0 shape). */
export function buildMddOpenAiStrictJsonSchema(): JsonSchema {
  const fromZod = z.toJSONSchema(mddStructuredOutputSchema) as JsonSchema;
  walk(fromZod, "root");
  // Root must remain a plain object (not anyOf).
  if (fromZod.type !== "object") {
    throw new Error("OpenAI Structured Outputs root must be type: object");
  }
  fromZod.additionalProperties = false;
  return fromZod;
}

export const MDD_OPENAI_STRUCTURED_OUTPUT_NAME = "mdd_structured_output_v1";

let cached: JsonSchema | null = null;

export function getMddOpenAiStrictJsonSchema(): JsonSchema {
  if (!cached) cached = buildMddOpenAiStrictJsonSchema();
  return cached;
}
