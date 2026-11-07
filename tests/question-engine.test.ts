import test from "node:test";
import assert from "node:assert/strict";
import { ANIME } from "../src/data/anime";
import { CHARACTERS } from "../src/data/characters";
import {
  auditAnswers,
  buildQuestionCatalog,
  dailyQuestions,
  getQuestionCatalog,
  getEngineStats,
  getQuestionById,
  matchesName,
  resolveScope,
  selectQuestions,
  MINIMUM_ANSWERS,
  RULES_VERSION,
} from "../src/lib/question-engine";
import {
  prominenceScore,
  rarityFor,
  scoreAnswer,
  RARITIES,
} from "../src/lib/scoring";
import { matchAnswer } from "../src/lib/game";
const questions = getQuestionCatalog();
test("the engine compiles over 1,000 distinct factual scopes instead of 20 rows", () => {
  const stats = getEngineStats();
  assert.ok(stats.questionCount >= 1000);
  assert.ok(stats.characterCount > 182);
  assert.ok(stats.animeCount >= 80);
  assert.equal(Object.values(stats.families).filter((n) => n > 0).length, 8);
});
test("EVERY playable scope has at least 24 canonical answers and two of every actual score tier", () => {
  for (const q of questions) {
    assert.ok(q.answers.length >= MINIMUM_ANSWERS, q.prompt);
    const counts = Object.fromEntries(RARITIES.map((t) => [t, 0]));
    for (const a of q.answers) counts[scoreAnswer(q, a).rarity]++;
    for (const tier of RARITIES)
      assert.ok(counts[tier] >= 2, `${q.id}: ${tier}`);
    assert.deepEqual(q.coverage, counts);
  }
});
test("question IDs and answer-set fingerprints are unique; paraphrases do not inflate the catalog count", () => {
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(
    new Set(
      questions.map((q) =>
        q.answers
          .map((a) => a.id)
          .sort()
          .join("|"),
      ),
    ).size,
    questions.length,
  );
  assert.ok(getEngineStats().duplicateScopes > 0);
});
test("all canonical answers, source references, and release years are well formed", () => {
  const answers = [...ANIME, ...CHARACTERS];
  assert.equal(new Set(answers.map((a) => a.id)).size, answers.length);
  for (const a of answers) {
    assert.ok(a.name.trim());
    assert.ok(a.aliases.every((s) => typeof s === "string"));
    assert.ok(a.source?.startsWith("https://"));
    assert.ok(a.prominence > 0 && a.prominence <= 100);
  }
  for (const a of ANIME) {
    assert.match(a.wikidataId, /^Q\d+$/);
    assert.ok(
      a.firstYear === null || (a.firstYear >= 1900 && a.firstYear <= 2026),
    );
  }
});
test("naruto scope includes independently sourced obscure characters with attainable Legendary scores", () => {
  const q = questions.find(
    (q) => q.family === "franchise" && q.scope?.franchiseIds?.[0] === "naruto",
  )!;
  assert.ok(q);
  const hero = q.answers.find((a) => a.name === "Naruto Uzumaki")!,
    obscure = q.answers.find((a) => a.name === "Genma Shiranui")!;
  assert.equal(scoreAnswer(q, hero).rarity, "Common");
  assert.equal(scoreAnswer(q, obscure).rarity, "Legendary");
  assert.equal(matchAnswer(q, "Genma").status, "correct");
});
test("removing common answers never manufactures Legendary rarity for a familiar answer", () => {
  const q = questions.find(
    (q) => q.family === "franchise" && q.scope?.franchiseIds?.[0] === "naruto",
  )!;
  const a = q.answers.find((a) => a.name === "Shikamaru Nara")!;
  const narrow = {
    ...q,
    answers: q.answers.filter((x) => x.prominence <= a.prominence),
  };
  assert.equal(scoreAnswer(q, a).score, scoreAnswer(narrow, a).score);
  assert.equal(scoreAnswer(narrow, a).rarity, "Uncommon");
});
test("narrow faction rosters and flat popularity distributions fail the quality gate", () => {
  const hashira = CHARACTERS.filter((a) => a.groups?.includes("hashira"));
  assert.equal(auditAnswers(hashira).eligible, false);
  const flat = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    name: String(i),
    aliases: [],
    prominence: 100,
  }));
  const audit = auditAnswers(flat);
  assert.equal(audit.eligible, false);
  assert.ok(audit.reasons.some((r) => r.includes("Legendary")));
});
test("duplicate IDs and malformed prominence fail eligibility", () => {
  const a = CHARACTERS[0];
  assert.equal(auditAnswers(Array(30).fill(a)).eligible, false);
  for (const prominence of [0, -1, NaN, Infinity, 101])
    assert.equal(auditAnswers([{ ...a, prominence }]).eligible, false);
});
test("the same answer retains its estimated score in every generated scope it belongs to", () => {
  const expected = new Map<string, number>();
  for (const q of questions)
    for (const a of q.answers) {
      const score = scoreAnswer(q, a).score;
      const previous = expected.get(a.id);
      if (previous !== undefined) assert.equal(score, previous);
      expected.set(a.id, score);
    }
});
test("daily sessions are reproducible, use all rarity tiers, and contain multiple question families", () => {
  for (let day = 1; day <= 365; day++) {
    const date = new Date(Date.UTC(2027, 0, day));
    const a = dailyQuestions(date),
      b = dailyQuestions(new Date(date));
    assert.deepEqual(a, b);
    assert.equal(a.length, 5);
    assert.equal(new Set(a.map((q) => q.id)).size, 5);
    assert.equal(new Set(a.map((q) => q.family)).size, 5);
    for (const q of a) assert.ok(auditAnswers(q.answers).eligible);
  }
});
test("consecutive daily challenges do not reuse scopes, regardless of local history", () => {
  let previous = dailyQuestions(new Date("2026-11-05T00:00:00Z"));
  for (let day = 1; day <= 365; day++) {
    const date = new Date(Date.UTC(2026, 10, 5 + day));
    const current = dailyQuestions(date);
    assert.ok(current.every((q) => !previous.some((p) => p.id === q.id)));
    previous = current;
  }
});
test("UTC daily selection stays fixed across the same day and changes at midnight", () => {
  assert.deepEqual(
    dailyQuestions(new Date("2026-11-05T00:00:00Z")),
    dailyQuestions(new Date("2026-11-05T23:59:59Z")),
  );
  assert.notDeepEqual(
    dailyQuestions(new Date("2026-11-05T23:59:59Z")),
    dailyQuestions(new Date("2026-11-06T00:00:00Z")),
  );
});
test("classic sessions avoid recent scopes and mix prompt families", () => {
  const a = selectQuestions("classic", 5, undefined, 42);
  const b = selectQuestions("classic", 5, undefined, 42, {
    excludeIds: a.map((q) => q.id),
  });
  assert.equal(new Set(a.map((q) => q.family)).size, 5);
  assert.ok(b.every((q) => !a.some((p) => p.id === q.id)));
  assert.equal(b.length, 5);
});
test("exhausted recent history recovers with eligible scopes rather than relaxing rarity requirements", () => {
  const selected = selectQuestions("classic", 5, undefined, 42, {
    excludeIds: questions.map((q) => q.id),
  });
  assert.equal(selected.length, 5);
  assert.ok(selected.every((q) => auditAnswers(q.answers).eligible));
});
test("explicit seeds reproduce sessions and unknown filters or invalid round counts fail clearly", () => {
  assert.deepEqual(
    selectQuestions("classic", 5, undefined, 42),
    selectQuestions("classic", 5, undefined, 42),
  );
  assert.notDeepEqual(
    selectQuestions("classic", 5, undefined, 42),
    selectQuestions("classic", 5, undefined, 43),
  );
  assert.throws(() => selectQuestions("classic", 5, "Unknown anime"));
  for (const n of [0, -1, 2.5, 51, NaN])
    assert.throws(() => selectQuestions("classic", n));
});
test("release predicates use the television adaptation, not the earlier manga publication", () => {
  const nineties = resolveScope({
    kind: "anime",
    years: { from: 1990, to: 1999 },
  });
  assert.ok(nineties.some((a) => a.name === "One Piece"));
  assert.ok(!nineties.some((a) => a.name === "Naruto"));
  const early = resolveScope({
    kind: "character",
    years: { from: 2000, to: 2009 },
  });
  assert.ok(early.some((a) => a.name === "Naruto Uzumaki"));
  assert.ok(!early.some((a) => a.name === "Monkey D. Luffy"));
});
test("genre OR predicates accept direct catalog memberships without filling missing genres", () => {
  const scope = resolveScope({
    kind: "anime",
    genres: ["Q15637293", "Q5366020"],
  });
  assert.ok(scope.some((a) => a.name === "Naruto"));
  assert.ok(scope.some((a) => a.name === "Kaiba"));
  assert.ok(!scope.some((a) => a.name === "Haikyu!!"));
});
test("character metadata inherits only from its linked TV adaptation", () => {
  const scope = resolveScope({
    kind: "character",
    productionCompanies: ["Q11231001"],
  });
  assert.ok(scope.some((a) => a.name === "Yuji Itadori"));
  assert.ok(scope.some((a) => a.name === "Denji"));
  assert.ok(!scope.some((a) => a.name === "Naruto Uzumaki"));
});
test("letter filters have explicit canonical-name semantics and ignore accents and punctuation for length", () => {
  assert.equal(matchesName("Shōwa", { type: "contains", letters: "o" }), true);
  assert.equal(
    matchesName("K-On!", { type: "length", minimum: 3, maximum: 3 }),
    true,
  );
  assert.equal(
    matchesName("Monkey D. Luffy", { type: "starts", letters: "mn" }),
    true,
  );
  assert.equal(
    matchesName("Naruto Uzumaki", { type: "without", letters: "a" }),
    false,
  );
});
test("every name-filtered question has canonical answers meeting its letter rule", () => {
  for (const q of questions.filter((q) => q.scope?.name))
    for (const a of q.answers)
      assert.ok(matchesName(a.name, q.scope!.name!), `${q.id}: ${a.name}`);
});
test("cross-franchise alias ambiguity requests the full canonical name", () => {
  const q = questions.find(
    (q) =>
      q.scope?.kind === "character" &&
      !q.scope.franchiseIds &&
      !q.scope.excludeFranchiseIds &&
      !q.scope.name &&
      !q.scope.years &&
      !q.scope.genres &&
      !q.scope.productionCompanies,
  )!;
  const match = matchAnswer(q, "Hinata");
  assert.equal(match.status, "ambiguous");
  if (match.status === "ambiguous")
    assert.ok(
      match.candidates.some((a) => a.name === "Hinata Hyuga") &&
        match.candidates.some((a) => a.name === "Shoyo Hinata"),
    );
  assert.equal(matchAnswer(q, "Hinata Hyuga").status, "correct");
});
test("a result scope is recoverable by versioned ID even when a different wording was shown", () => {
  for (const q of selectQuestions("classic", 50, undefined, 456)) {
    const found = getQuestionById(q.id);
    assert.ok(found);
    assert.equal(found.scopeKey, q.scopeKey);
    assert.ok(found.promptVariants?.includes(q.prompt));
  }
  assert.match(RULES_VERSION, /questions-2/);
  assert.equal(getQuestionById("naruto-characters"), undefined);
});
test("catalog compilation is deterministic and never mutates entity prominence", () => {
  const before = JSON.stringify([...CHARACTERS, ...ANIME]);
  const rebuilt = buildQuestionCatalog();
  assert.deepEqual(
    rebuilt.questions.map((q) => q.id),
    questions.map((q) => q.id),
  );
  assert.equal(before, JSON.stringify([...CHARACTERS, ...ANIME]));
});
test("known score boundaries span all tiers without scale inflation", () => {
  assert.equal(prominenceScore(100), 100);
  assert.equal(prominenceScore(1), 1000);
  assert.equal(rarityFor(prominenceScore(2)), "Legendary");
  assert.equal(rarityFor(prominenceScore(4)), "Epic");
  assert.equal(rarityFor(prominenceScore(10)), "Rare");
  assert.equal(rarityFor(prominenceScore(30)), "Uncommon");
  assert.equal(rarityFor(prominenceScore(90)), "Common");
});
test("a known anime that violates the year range is distinguished from an unknown answer", () => {
  const q = questions.find(
    (q) =>
      q.answerKind === "anime" &&
      q.scope.years?.from === 2007 &&
      q.scope.years.to === 2022,
  )!;
  const match = matchAnswer(q, "Naruto");
  assert.equal(match.status, "unknown");
  if (match.status === "unknown") assert.equal(match.reason, "outside-scope");
  const unknown = matchAnswer(q, "Totally invented anime title");
  assert.equal(unknown.status, "unknown");
  if (unknown.status === "unknown")
    assert.equal(unknown.reason, "unrecognized");
});
test("trusted frequencies cannot introduce nonfinite scores or score an answer outside the scope", () => {
  const q = questions[0],
    a = q.answers[0];
  for (const count of [-1, NaN, Infinity])
    assert.throws(() => scoreAnswer(q, a, { [a.id]: count }));
  assert.throws(() =>
    scoreAnswer(q, {
      id: "unknown",
      name: "Unknown",
      aliases: [],
      prominence: 1,
    }),
  );
});

test("classic sessions include both anime titles and characters when both are available", () => {
  for (let seed = 0; seed < 100; seed++) {
    const run = selectQuestions("classic", 5, undefined, seed);
    assert.equal(new Set(run.map((q) => q.answerKind)).size, 2);
    assert.equal(new Set(run.map((q) => q.family)).size, 5);
  }
});
test("a known excluded character is rejected before fuzzy matching can turn them into another character", () => {
  const base = questions.find((q) => q.answerKind === "character")!;
  const scope = {
    kind: "character" as const,
    name: { type: "without" as const, letters: "k" },
  };
  const answers = resolveScope(scope);
  assert.ok(answers.some((a) => a.name === "Mai Zenin"));
  assert.ok(!answers.some((a) => a.name === "Maki Zenin"));
  assert.ok(auditAnswers(answers).eligible);
  const q = { ...base, scope, answers };
  const match = matchAnswer(q, "Maki Zenin");
  assert.equal(match.status, "unknown");
  if (match.status === "unknown") assert.equal(match.reason, "outside-scope");
  assert.equal(matchAnswer(q, "Mai Zenin").status, "correct");
});
