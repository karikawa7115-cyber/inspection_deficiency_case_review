/**
 * Conservative representation-level normalization for LLM Structured Output.
 * Does NOT invent authorities, finance extensions, or alter decision semantics.
 * Zod Schema v1.0 remains the final contract.
 */

const ID_KEYS = new Set(["id"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Drop keys whose value is `null` (optional-absent representation).
 * Recurses into objects/arrays. Does not invent replacements.
 */
function stripNullKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullKeys);
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null) continue;
    out[k] = stripNullKeys(v);
  }
  return out;
}

/**
 * Coerce numeric `id` fields to strings — representation only.
 * Does not touch authority enums, readiness, recommendations, or finance presence.
 */
function coerceNumericIds(value: unknown, keyHint = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => coerceNumericIds(item, keyHint));
  }
  if (!isPlainObject(value)) {
    if (ID_KEYS.has(keyHint) && typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = coerceNumericIds(v, k);
  }
  return out;
}

/**
 * Coerce boolean-looking strings on `hypothesis` only (representation).
 * Leaves other boolean fields untouched if wrong type (visible to Zod).
 */
function coerceHypothesisBooleans(value: unknown, keyHint = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => coerceHypothesisBooleans(item, keyHint));
  }
  if (!isPlainObject(value)) {
    if (keyHint === "hypothesis" && typeof value === "string") {
      const lower = value.trim().toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = coerceHypothesisBooleans(v, k);
  }
  return out;
}

export type NormalizeStructuredV1Result = {
  normalized: unknown;
  repairs: string[];
};

/**
 * Apply only representation-level repairs. Semantic errors remain for Golden Eval.
 */
export function normalizeMddStructuredOutputV1(
  input: unknown,
): NormalizeStructuredV1Result {
  const repairs: string[] = [];
  if (!isPlainObject(input) && !Array.isArray(input)) {
    return { normalized: input, repairs };
  }

  let current: unknown = input;

  const afterNull = stripNullKeys(current);
  if (JSON.stringify(afterNull) !== JSON.stringify(current)) {
    repairs.push("strip_null_optional_keys");
  }
  current = afterNull;

  const afterIds = coerceNumericIds(current);
  if (JSON.stringify(afterIds) !== JSON.stringify(current)) {
    repairs.push("coerce_numeric_ids_to_string");
  }
  current = afterIds;

  const afterHyp = coerceHypothesisBooleans(current);
  if (JSON.stringify(afterHyp) !== JSON.stringify(current)) {
    repairs.push("coerce_hypothesis_boolean_strings");
  }
  current = afterHyp;

  return { normalized: current, repairs };
}
