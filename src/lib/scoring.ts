import type { Answer, Question, Rarity, RarityCoverage } from "./types";
export const RARITIES: readonly Rarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
];
export const SCORING_VERSION = "prominence-2";
export function rarityFor(score: number): Rarity {
  return score >= 850
    ? "Legendary"
    : score >= 650
      ? "Epic"
      : score >= 420
        ? "Rare"
        : score >= 220
          ? "Uncommon"
          : "Common";
}
/** Stable across scopes: removing well-known answers never promotes another to Legendary. */
export function prominenceScore(prominence: number): number {
  if (!Number.isFinite(prominence) || prominence <= 0 || prominence > 100)
    throw new RangeError(
      "Prominence must be greater than zero and at most 100.",
    );
  return Math.round(
    Math.max(100, Math.min(1000, 100 + 450 * Math.log10(100 / prominence))),
  );
}
export function rarityCoverage(answers: readonly Answer[]): RarityCoverage {
  const coverage: RarityCoverage = {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
  };
  for (const answer of answers)
    coverage[rarityFor(prominenceScore(answer.prominence))]++;
  return coverage;
}
export function scoreAnswer(
  question: Question,
  answer: Answer,
  frequencies: Record<string, number> = {},
  minimumSamples = 100,
) {
  if (!question.answers.some((a) => a.id === answer.id))
    throw new RangeError("Answer is outside this question scope.");
  const weightTotal = question.answers.reduce((n, a) => n + a.prominence, 0);
  const prior = answer.prominence / weightTotal;
  const count = (id: string) => {
    const n = frequencies[id] ?? 0;
    if (!Number.isFinite(n) || n < 0)
      throw new RangeError(
        "Submission counts must be nonnegative finite numbers.",
      );
    return n;
  };
  const sampleCount = question.answers.reduce((n, a) => n + count(a.id), 0);
  const estimated = sampleCount < minimumSamples;
  const probability = estimated
    ? prior
    : (count(answer.id) + 100 * prior) / (sampleCount + 100);
  const score = estimated
    ? prominenceScore(answer.prominence)
    : Math.round(
        Math.max(
          100,
          Math.min(
            1000,
            100 + 450 * Math.log10(100 / (probability * weightTotal)),
          ),
        ),
      );
  return { score, rarity: rarityFor(score), probability, estimated };
}
