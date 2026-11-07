import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../src/data/questions";
import {
  normalize,
  matchAnswer,
  scoreAnswer,
  selectQuestions,
  dateKey,
  remainingSeconds,
} from "../src/lib/game";
import {
  addGame,
  emptyProgress,
  readProgress,
  writeProgress,
  STORAGE_KEY,
} from "../src/lib/storage";
import type { Question, GameRecord } from "../src/lib/types";
const naruto = QUESTIONS.find(
  (q) => q.family === "franchise" && q.scope?.franchiseIds?.[0] === "naruto",
)!;
test("the generated question bank has unique IDs and broad canonical answer sets", () => {
  assert.ok(QUESTIONS.length > 20);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  for (const q of QUESTIONS) {
    assert.ok(q.answers.length >= 24, q.id);
    assert.ok(new URL(q.source).protocol === "https:");
    assert.equal(new Set(q.answers.map((a) => a.id)).size, q.answers.length);
    for (const a of q.answers) assert.ok(a.prominence > 0);
  }
});
test("normalizes full-width text, whitespace, accents, and punctuation", () => {
  assert.equal(normalize("  ＮＡＲＵＴＯ   Uzumaki! "), "naruto uzumaki");
  assert.equal(normalize("Übel"), "ubel");
  assert.equal(normalize("Monkey D. Luffy"), "monkey d luffy");
});
test("every canonical name and alias resolves or identifies the intended answer as ambiguous", () => {
  const sampled = [
    QUESTIONS.find(
      (q) =>
        q.answerKind === "character" &&
        q.scope &&
        Object.keys(q.scope).length === 1,
    )!,
    QUESTIONS.find(
      (q) =>
        q.answerKind === "anime" &&
        q.scope &&
        Object.keys(q.scope).length === 1,
    )!,
  ];
  for (const q of sampled)
    for (const a of q.answers)
      for (const name of [a.name, ...a.aliases]) {
        const match = matchAnswer(q, name);
        assert.notEqual(match.status, "unknown", name);
        if (match.status === "correct") assert.equal(match.answer.id, a.id);
        else if (match.status === "ambiguous")
          assert.ok(match.candidates.some((x) => x.id === a.id));
      }
});
test("accepts one-letter spelling mistakes in a sufficiently long name", () => {
  const match = matchAnswer(naruto, "Narutp");
  assert.equal(match.status, "correct");
  if (match.status === "correct") {
    assert.equal(match.answer.name, "Naruto Uzumaki");
    assert.equal(match.matchedBy, "fuzzy");
  }
});
test("does not fuzz short names, accept an unrelated franchise, or empty answers", () => {
  for (const s of ["Nao", "Goku", "   ", "a".repeat(121)])
    assert.equal(matchAnswer(naruto, s).status, "unknown");
});
test("asks for a fuller answer when exact aliases collide", () => {
  const q: Question = {
    ...naruto,
    answers: [
      { id: "a", name: "Aki One", aliases: ["Aki"], prominence: 10 },
      { id: "b", name: "Aki Two", aliases: ["Aki"], prominence: 10 },
    ],
  };
  assert.equal(matchAnswer(q, "Aki").status, "ambiguous");
});
test("rejects ambiguous equally close fuzzy matches", () => {
  const q: Question = {
    ...naruto,
    answers: [
      { id: "a", name: "Kazumi", aliases: [], prominence: 10 },
      { id: "b", name: "Kasumi", aliases: [], prominence: 10 },
    ],
  };
  assert.equal(matchAnswer(q, "Kamumi").status, "ambiguous");
});
test("less prominent characters earn strictly more points than the protagonist", () => {
  const hero = naruto.answers.find((a) => a.name === "Naruto Uzumaki")!,
    obscure = naruto.answers.find((a) => a.name === "Shino Aburame")!;
  assert.ok(
    scoreAnswer(naruto, obscure).score > scoreAnswer(naruto, hero).score,
  );
});
test("all estimated scores stay in bounds and probabilities sum to one", () => {
  for (const q of QUESTIONS) {
    let sum = 0;
    for (const a of q.answers) {
      const s = scoreAnswer(q, a);
      assert.ok(s.score >= 100 && s.score <= 1000);
      assert.equal(s.estimated, true);
      sum += s.probability;
    }
    assert.ok(Math.abs(sum - 1) < 1e-9);
  }
});
test("requires 100 trusted submissions before blending observed rarity", () => {
  const a = naruto.answers[0];
  const before = scoreAnswer(naruto, a, { [a.id]: 99 });
  assert.equal(before.probability, scoreAnswer(naruto, a).probability);
  assert.equal(before.estimated, true);
  const after = scoreAnswer(naruto, a, { [a.id]: 100 });
  assert.equal(after.estimated, false);
  assert.ok(after.probability > before.probability);
});
test("smoothing gives an unseen answer positive probability after minimum samples", () => {
  const a = naruto.answers[0],
    unseen = naruto.answers[1];
  const score = scoreAnswer(naruto, unseen, { [a.id]: 200 });
  assert.ok(score.probability > 0);
  assert.ok(Number.isFinite(score.score));
});
test("daily questions are reproducible and do not repeat within a run", () => {
  const first = selectQuestions("daily", 5, undefined, 42),
    second = selectQuestions("daily", 5, undefined, 42);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((q) => q.id)).size, 5);
  assert.notDeepEqual(first, selectQuestions("daily", 5, undefined, 43));
});
test("practice filters stay within the selected franchise", () => {
  const selected = selectQuestions("practice", 5, "Naruto", 4);
  assert.ok(selected.length > 0);
  assert.ok(selected.every((q) => q.franchiseIds?.includes("naruto")));
});
test("classic and daily runs explore different question families", () => {
  for (const mode of ["classic", "daily"] as const)
    for (let seed = 0; seed < 20; seed++) {
      const selected = selectQuestions(mode, 5, undefined, seed);
      assert.equal(new Set(selected.map((q) => q.family)).size, 5);
    }
});
test("UTC daily key is independent of local date and handles midnight", () => {
  assert.equal(dateKey(new Date("2026-11-05T23:59:59-08:00")), "2026-11-06");
  assert.equal(dateKey(new Date("2026-11-05T23:59:59Z")), "2026-11-05");
});
test("wall-clock countdown expires after suspended tabs and clamps at zero", () => {
  assert.equal(remainingSeconds(31000, 1000), 30);
  assert.equal(remainingSeconds(31000, 30500), 1);
  assert.equal(remainingSeconds(31000, 50000), 0);
});
const mockGame: GameRecord = {
  id: "g1",
  date: "2026-11-05T12:00:00Z",
  mode: "classic",
  total: 123,
  rounds: [],
  player: "Tester",
};
test("a completed run is persisted once by its unique ID", () => {
  const p = addGame(emptyProgress(), mockGame);
  assert.equal(p.games.length, 1);
  assert.equal(addGame(p, mockGame).games.length, 1);
});
test("local history is capped at 100 games", () => {
  let p = emptyProgress();
  for (let i = 0; i < 105; i++) p = addGame(p, { ...mockGame, id: String(i) });
  assert.equal(p.games.length, 100);
  assert.equal(p.games[0].id, "104");
});
test("unavailable storage returns defaults and does not crash save", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  assert.deepEqual(readProgress(), emptyProgress());
  assert.equal(writeProgress(emptyProgress()), false);
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
test("corrupt and incompatible saved data safely return defaults", () => {
  for (const raw of ["bad-json", "{}", '{"version":2,"games":[]}']) {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => raw },
    });
    assert.deepEqual(readProgress(), emptyProgress());
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});
test("restores a valid save and repairs unsupported timer preferences", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        assert.equal(key, STORAGE_KEY);
        return JSON.stringify({
          version: 1,
          games: [mockGame],
          settings: { player: "Test", roundSeconds: 999 },
          reviews: [],
        });
      },
    },
  });
  const p = readProgress();
  assert.equal(p.games[0].id, "g1");
  assert.equal(p.settings.roundSeconds, 30);
  Reflect.deleteProperty(globalThis, "localStorage");
});
