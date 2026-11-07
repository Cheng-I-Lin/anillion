import { ANIME } from "@/data/anime";
import { CHARACTERS } from "@/data/characters";
import type { Answer, Question } from "./types";
export function normalize(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = temp;
    }
  }
  return row[b.length];
}
export type Match =
  | { status: "correct"; answer: Answer; matchedBy: "exact" | "fuzzy" }
  | { status: "ambiguous"; candidates: Answer[] }
  | { status: "unknown"; reason?: "outside-scope" | "unrecognized" };
export function matchAnswer(question: Question, raw: string): Match {
  const input = normalize(raw);
  if (!input || input.length > 120) return { status: "unknown" };
  const exact = question.answers.filter((a) =>
    [a.name, ...a.aliases].some((alias) => normalize(alias) === input),
  );
  if (exact.length === 1)
    return { status: "correct", answer: exact[0], matchedBy: "exact" };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };
  const catalog = question.answerKind === "anime" ? ANIME : CHARACTERS;
  const knownOutsideScope = catalog.some((answer) =>
    [answer.name, ...answer.aliases].some(
      (alias) => normalize(alias) === input,
    ),
  );
  // A valid known name must never be changed into another entity by typo matching.
  if (knownOutsideScope) return { status: "unknown", reason: "outside-scope" };
  if (input.length < 5) return { status: "unknown", reason: "unrecognized" };
  const scored = question.answers.map((answer) => ({
    answer,
    d: Math.min(
      ...[answer.name, ...answer.aliases].map((alias) =>
        distance(normalize(alias), input),
      ),
    ),
  }));
  const min = Math.min(...scored.map((x) => x.d));
  const candidates = scored
    .filter((x) => x.d === min && x.d <= (input.length >= 10 ? 2 : 1))
    .map((x) => x.answer);
  if (candidates.length === 1)
    return { status: "correct", answer: candidates[0], matchedBy: "fuzzy" };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "unknown", reason: "unrecognized" };
}
export { scoreAnswer, rarityFor } from "./scoring";
export { dateKey, seedNumber } from "./random";
export { selectQuestions } from "./question-engine";
export function remainingSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
