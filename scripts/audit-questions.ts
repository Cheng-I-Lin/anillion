import {
  auditAnswers,
  getQuestionCatalog,
  getEngineStats,
} from "../src/lib/question-engine";
import { scoreAnswer, RARITIES } from "../src/lib/scoring";
const questions = getQuestionCatalog();
const failures: string[] = [];
const ids = new Set<string>();
for (const question of questions) {
  if (ids.has(question.id))
    failures.push(`Duplicate question ID: ${question.id}`);
  ids.add(question.id);
  const audit = auditAnswers(question.answers);
  if (!audit.eligible)
    failures.push(`${question.id}: ${audit.reasons.join(" ")}`);
  const coverage = Object.fromEntries(RARITIES.map((tier) => [tier, 0]));
  for (const answer of question.answers)
    coverage[scoreAnswer(question, answer).rarity]++;
  for (const tier of RARITIES)
    if (coverage[tier] < 2)
      failures.push(`${question.id}: actual scoring lacks ${tier}.`);
}
const stats = getEngineStats();
if (Object.values(stats.families).filter((count) => count >= 14).length < 5)
  failures.push(
    "At least five broad question families are required for daily rotation.",
  );
if (!questions.length) failures.push("No eligible questions were generated.");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify(getEngineStats(), null, 2));
console.log(
  "PASS: every playable question has at least 24 answers and multiple answers in all five scoring tiers.",
);
