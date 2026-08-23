/**
 * President Decision prose defect classification for NSF / Semantic Refill v0.3.
 * Generalized detectors — never Golden/vessel keyed.
 */

export type PresidentProseDefectClass =
  | "absent"
  | "not_required"
  | "contradictory"
  | null;

export function isNotRequiredPresidentText(text: string): boolean {
  return /not required at this stage/i.test(text);
}

export function isAbsentPresidentText(text: string): boolean {
  return !text || !text.trim();
}

/**
 * Text asserts President decision is not needed / deferred while requiredNow is true.
 * Does not flag substantive decision prose.
 */
export function isContradictoryPresidentText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isNotRequiredPresidentText(t)) return true;
  return (
    /\b(no|not)\s+(president|dp|management)\s+decision\b/i.test(t) ||
    /\bpresident\s+(decision\s+)?(is\s+)?(not\s+)?(needed|required|necessary)\b/i.test(
      t,
    ) ||
    /\b(defer|deferred|later)\b.*\b(president|decision)\b/i.test(t) ||
    /\bdecision\s+not\s+(needed|required)\b/i.test(t)
  );
}

export function classifyPresidentProseDefect(
  text: string,
  requiredNow: boolean,
): PresidentProseDefectClass {
  if (!requiredNow) return null;
  if (isAbsentPresidentText(text)) return "absent";
  if (isNotRequiredPresidentText(text)) return "not_required";
  if (isContradictoryPresidentText(text)) return "contradictory";
  return null;
}

export function presidentProseNeedsSemanticFill(
  text: string,
  requiredNow: boolean,
): boolean {
  return classifyPresidentProseDefect(text, requiredNow) != null;
}
