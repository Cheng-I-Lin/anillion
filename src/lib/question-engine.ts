import {
  ANIME,
  FRANCHISE_ANIME,
  GENRES,
  PRODUCTION_COMPANIES,
} from "@/data/anime";
import { CHARACTERS, CHARACTER_ROSTERS } from "@/data/characters";
import type {
  Answer,
  AnimeRecord,
  Question,
  QuestionFamily,
  QuestionScope,
  NameRule,
  RarityCoverage,
} from "./types";
import { RARITIES, rarityCoverage, SCORING_VERSION } from "./scoring";
import { dateKey, seededRandom, seedNumber, shuffle } from "./random";
export const DATA_VERSION = "catalog-2026-11-05-2";
export const ENGINE_VERSION = "questions-2";
export const RULES_VERSION = `${ENGINE_VERSION}/${DATA_VERSION}/${SCORING_VERSION}`;
export const MINIMUM_ANSWERS = 24;
export const MINIMUM_PER_TIER = 2;
export const FAMILY_LABELS: Record<QuestionFamily, string> = {
  franchise: "Franchise rosters",
  crossover: "Anime crossovers",
  "character-era": "Characters by era",
  "character-genre": "Characters by genre",
  "anime-era": "Anime by era",
  "anime-genre": "Anime by genre",
  production: "Production credits",
  name: "Names & letters",
};
const animeById = new Map(ANIME.map((a) => [a.wikidataId, a]));
const rosterById = new Map(CHARACTER_ROSTERS.map((r) => [r.id, r]));
const animeForCharacter = (a: Answer) =>
  animeById.get(FRANCHISE_ANIME[a.franchiseId ?? ""]);
function nameLetters(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}
export function matchesName(name: string, rule: NameRule): boolean {
  const text = nameLetters(name);
  if (rule.type === "length")
    return text.length >= rule.minimum && text.length <= rule.maximum;
  if (rule.type === "starts") return rule.letters.includes(text[0] ?? " ");
  if (rule.type === "contains")
    return [...rule.letters].some((letter) => text.includes(letter));
  return [...rule.letters].every((letter) => !text.includes(letter));
}
function matchesMetadata(
  anime: AnimeRecord | undefined,
  scope: QuestionScope,
): boolean {
  if (!anime)
    return !scope.years && !scope.genres && !scope.productionCompanies;
  if (
    scope.years &&
    (anime.firstYear === null ||
      anime.firstYear < scope.years.from ||
      anime.firstYear > scope.years.to)
  )
    return false;
  if (scope.genres && !scope.genres.some((id) => anime.genres.includes(id)))
    return false;
  if (
    scope.productionCompanies &&
    !scope.productionCompanies.some((id) =>
      anime.productionCompanies.includes(id),
    )
  )
    return false;
  return true;
}
/** Each scope is a predicate over canonical facts. No generated prose decides correctness. */
export function resolveScope(scope: QuestionScope): Answer[] {
  const pool = scope.kind === "anime" ? ANIME : CHARACTERS;
  return pool.filter((answer) => {
    if (
      scope.kind === "character" &&
      scope.franchiseIds &&
      !scope.franchiseIds.includes(answer.franchiseId ?? "")
    )
      return false;
    if (scope.excludeFranchiseIds?.includes(answer.franchiseId ?? ""))
      return false;
    if (scope.name && !matchesName(answer.name, scope.name)) return false;
    return matchesMetadata(
      scope.kind === "anime"
        ? (answer as AnimeRecord)
        : animeForCharacter(answer),
      scope,
    );
  });
}
export interface ScopeAudit {
  eligible: boolean;
  answerCount: number;
  coverage: RarityCoverage;
  reasons: string[];
}
export function auditAnswers(answers: readonly Answer[]): ScopeAudit {
  const unique = new Set(answers.map((a) => a.id));
  const invalid = answers.some(
    (a) =>
      !Number.isFinite(a.prominence) || a.prominence <= 0 || a.prominence > 100,
  );
  const coverage = invalid
    ? { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 }
    : rarityCoverage(answers);
  const reasons: string[] = [];
  if (unique.size !== answers.length)
    reasons.push("Duplicate canonical answers.");
  if (invalid) reasons.push("Invalid prominence estimate.");
  if (answers.length < MINIMUM_ANSWERS)
    reasons.push(`Fewer than ${MINIMUM_ANSWERS} answers.`);
  for (const rarity of RARITIES)
    if (coverage[rarity] < MINIMUM_PER_TIER)
      reasons.push(`Fewer than ${MINIMUM_PER_TIER} ${rarity} answers.`);
  return {
    eligible: reasons.length === 0,
    answerCount: answers.length,
    coverage,
    reasons,
  };
}
function* combinations<T>(
  items: readonly T[],
  size: number,
  start = 0,
  prefix: T[] = [],
): Generator<T[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i++)
    yield* combinations(items, size, i + 1, [...prefix, items[i]]);
}
function joinNames(names: string[]) {
  return new Intl.ListFormat("en", {
    style: "long",
    type: "disjunction",
  }).format(names);
}
function scopeSources(answers: Answer[]) {
  const urls = new Map<string, string>();
  for (const answer of answers) {
    const roster = rosterById.get(answer.franchiseId ?? "");
    if (answer.source)
      urls.set(
        answer.source,
        answer.kind === "anime" ? answer.name : (roster?.name ?? answer.name),
      );
    if (answer.kind === "character") {
      const anime = animeForCharacter(answer);
      if (anime)
        urls.set(anime.source, `${roster?.name ?? anime.name} · TV metadata`);
    }
  }
  return [...urls].map(([url, label]) => ({ url, label }));
}
export interface QuestionCatalog {
  questions: Question[];
  rejected: number;
  duplicateScopes: number;
}
/** Compile templates against reviewed catalog facts; new records expand scopes automatically. */
export function buildQuestionCatalog(): QuestionCatalog {
  const questions: Question[] = [],
    fingerprints = new Set<string>();
  let rejected = 0,
    duplicateScopes = 0;
  function add(
    scope: QuestionScope,
    family: QuestionFamily,
    prompt: string,
    label: string,
    variants: string[] = [],
  ) {
    const answers = resolveScope(scope),
      audit = auditAnswers(answers);
    if (!audit.eligible) {
      rejected++;
      return;
    }
    const fingerprint = answers
      .map((a) => a.id)
      .sort()
      .join("|");
    if (fingerprints.has(fingerprint)) {
      duplicateScopes++;
      return;
    }
    fingerprints.add(fingerprint);
    const scopeKey = JSON.stringify(scope),
      franchiseIds = [
        ...new Set(
          answers.flatMap((a) => (a.franchiseId ? [a.franchiseId] : [])),
        ),
      ].sort();
    const sources = scopeSources(answers);
    questions.push({
      id: `q2:${family}:${seedNumber(scopeKey).toString(16).padStart(8, "0")}`,
      scopeKey,
      scope,
      family,
      answerKind: scope.kind,
      franchise: label,
      franchiseIds,
      prompt,
      promptVariants: [prompt, ...variants],
      subtitle: scope.name
        ? "Letter rules use the listed English / romanized catalog name. Aliases accepted."
        : scope.kind === "anime"
          ? "Use an anime TV series from the reviewed catalog. Think beyond the obvious."
          : "One character from the reviewed rosters. Every rarity tier is in play.",
      category: FAMILY_LABELS[family],
      difficulty: scope.name
        ? "Hard"
        : family === "franchise"
          ? "Easy"
          : "Medium",
      answers,
      coverage: audit.coverage,
      sources,
      source: sources[0]?.url ?? "https://www.wikidata.org/",
      accent: "#ee4c55",
    });
  }
  add(
    { kind: "character" },
    "crossover",
    "Name a character from any anime in the collection.",
    "Across anime",
    ["Name any anime character in our collection."],
  );
  add(
    { kind: "anime" },
    "anime-era",
    "Name any anime TV series in the collection.",
    "Anime TV series",
    ["Name an anime television series from the collection."],
  );
  const ids = CHARACTER_ROSTERS.map((r) => r.id).sort();
  for (let size = 1; size <= 3; size++)
    for (const group of combinations(ids, size)) {
      const names = group.map((id) => rosterById.get(id)!.name),
        list = joinNames(names);
      add(
        { kind: "character", franchiseIds: group },
        size === 1 ? "franchise" : "crossover",
        `Name a character from ${list}.`,
        names.join(" × "),
        [`Who can you name from ${list}?`],
      );
    }
  for (let size = 1; size <= 2; size++)
    for (const excluded of combinations(ids, size)) {
      const list = joinNames(excluded.map((id) => rosterById.get(id)!.name));
      add(
        { kind: "character", excludeFranchiseIds: excluded },
        "crossover",
        `Name a character from the collection outside ${list}.`,
        "Beyond the usual picks",
      );
    }
  // Inclusive windows are derived from actual catalog years, not an ever-growing array of daily questions.
  const years = [
    ...new Set(
      ANIME.flatMap((a) => (a.firstYear === null ? [] : [a.firstYear])),
    ),
  ].sort((a, b) => a - b);
  for (const kind of ["anime", "character"] as const) {
    for (const from of years)
      for (const to of years) {
        if (to < from || to - from < 9) continue;
        const label = `${from}–${to}`;
        add(
          { kind, years: { from, to } },
          kind === "anime" ? "anime-era" : "character-era",
          kind === "anime"
            ? `Name an anime TV series that first aired between ${from} and ${to}, inclusive.`
            : `Name a character from an anime TV series that first aired between ${from} and ${to}, inclusive.`,
          label,
        );
      }
  }
  // OR is explicit: an answer needs at least one listed genre or production-company credit.
  for (const kind of ["anime", "character"] as const) {
    for (let size = 1; size <= 3; size++)
      for (const group of combinations(GENRES, size)) {
        const list = joinNames(group.map((g) => g.name));
        add(
          { kind, genres: group.map((g) => g.id).sort() },
          kind === "anime" ? "anime-genre" : "character-genre",
          kind === "anime"
            ? `Name an anime TV series tagged ${list} in the catalog.`
            : `Name a character from an anime tagged ${list} in the catalog.`,
          group.map((g) => g.name).join(" / "),
        );
      }
    const companies = PRODUCTION_COMPANIES.filter(
      (c) =>
        ANIME.filter((a) => a.productionCompanies.includes(c.id)).length >= 3,
    );
    for (let size = 1; size <= 3; size++)
      for (const group of combinations(companies, size)) {
        const list = joinNames(group.map((c) => c.name));
        add(
          { kind, productionCompanies: group.map((c) => c.id).sort() },
          "production",
          kind === "anime"
            ? `Name an anime TV series whose catalog production credits include ${list}.`
            : `Name a character from an anime whose catalog production credits include ${list}.`,
          group.map((c) => c.name).join(" / "),
        );
      }
  }
  const rules: NameRule[] = [
    ...[
      "a",
      "e",
      "i",
      "o",
      "n",
      "r",
      "s",
      "t",
      "ae",
      "ai",
      "an",
      "er",
      "io",
      "st",
    ].map((letters) => ({ type: "contains" as const, letters })),
    ...["a", "e", "i", "o", "r", "s"].map((letters) => ({
      type: "without" as const,
      letters,
    })),
    ...["abcdef", "ghijklm", "nopqrs", "tuvwxyz"].map((letters) => ({
      type: "starts" as const,
      letters,
    })),
    ...[
      [4, 12],
      [8, 20],
      [12, 40],
      [4, 20],
    ].map(([minimum, maximum]) => ({
      type: "length" as const,
      minimum,
      maximum,
    })),
  ];
  for (const kind of ["anime", "character"] as const)
    for (const rule of rules) {
      const condition =
        rule.type === "length"
          ? `has ${rule.minimum}–${rule.maximum} letters (ignore spaces and punctuation)`
          : rule.type === "starts"
            ? `starts with one of ${[...rule.letters].map((l) => l.toUpperCase()).join(", ")}`
            : rule.type === "without"
              ? `does not contain the letter “${rule.letters.toUpperCase()}”`
              : `contains ${rule.letters.length === 1 ? "the letter" : "at least one of the letters"} ${joinNames([...rule.letters].map((l) => `“${l.toUpperCase()}”`))}`;
      add(
        { kind, name: rule },
        "name",
        `Name ${kind === "anime" ? "an anime TV series whose listed title" : "a character whose listed name"} ${condition}.`,
        kind === "anime" ? "Anime title wordplay" : "Character name wordplay",
      );
      if (kind === "character")
        for (const group of combinations(ids, 2)) {
          const list = joinNames(group.map((id) => rosterById.get(id)!.name));
          add(
            { kind, name: rule, franchiseIds: group },
            "name",
            `Name a character from ${list} whose listed name ${condition}.`,
            group.map((id) => rosterById.get(id)!.name).join(" × "),
          );
        }
    }
  return {
    questions: questions.sort((a, b) => a.id.localeCompare(b.id)),
    rejected,
    duplicateScopes,
  };
}
let compiled: QuestionCatalog | undefined;
export function getQuestionCatalog(): Question[] {
  return (compiled ??= buildQuestionCatalog()).questions;
}
export function getQuestionById(id: string): Question | undefined {
  return getQuestionCatalog().find((q) => q.id === id);
}
export function getEngineStats() {
  const catalog = (compiled ??= buildQuestionCatalog());
  return {
    questionCount: catalog.questions.length,
    characterCount: CHARACTERS.length,
    animeCount: ANIME.length,
    franchiseCount: CHARACTER_ROSTERS.length,
    rejected: catalog.rejected,
    duplicateScopes: catalog.duplicateScopes,
    families: Object.fromEntries(
      Object.keys(FAMILY_LABELS).map((f) => [
        f,
        catalog.questions.filter((q) => q.family === f).length,
      ]),
    ),
    version: RULES_VERSION,
  };
}
function wording(question: Question, random: () => number): Question {
  const variants = question.promptVariants ?? [question.prompt];
  return {
    ...question,
    prompt: variants[Math.floor(random() * variants.length)],
  };
}
export interface SelectionOptions {
  date?: Date;
  excludeIds?: readonly string[];
}
/** Daily takes consecutive slots from versioned per-family decks, with no dependence on local history. */
export function dailyQuestions(date = new Date(), count = 5): Question[] {
  const random = seededRandom(seedNumber(`${RULES_VERSION}:${dateKey(date)}`));
  const catalog = getQuestionCatalog();
  const families = shuffle(
    Object.keys(FAMILY_LABELS).filter(
      (f) => catalog.filter((q) => q.family === f).length >= 14,
    ),
    seededRandom(seedNumber(RULES_VERSION)),
  );
  const ordinal = Math.floor(
    Date.parse(`${dateKey(date)}T00:00:00Z`) / 86400000,
  );
  const selected: Question[] = [];
  for (let round = 0; round < Math.min(count, catalog.length); round++) {
    const slot = ordinal * count + round,
      family = families[slot % families.length];
    const deck = shuffle(
      catalog.filter((q) => q.family === family),
      seededRandom(seedNumber(`${RULES_VERSION}:${family}`)),
    );
    const cycle = Math.floor(slot / families.length),
      candidate = deck[cycle % deck.length];
    if (!selected.some((q) => q.id === candidate.id))
      selected.push(wording(candidate, random));
  }
  return selected;
}
export function selectQuestions(
  mode: "classic" | "daily" | "practice" | "party",
  count = 5,
  franchise?: string,
  seed?: number,
  options: SelectionOptions = {},
): Question[] {
  if (!Number.isInteger(count) || count < 1 || count > 50)
    throw new RangeError("Choose between 1 and 50 rounds.");
  if (mode === "daily" && seed === undefined && !franchise)
    return dailyQuestions(options.date ?? new Date(), count);
  const random = seededRandom(seed ?? Math.floor(Math.random() * 4294967296));
  const roster = CHARACTER_ROSTERS.find(
    (r) => r.name === franchise || r.id === franchise,
  );
  const pool = getQuestionCatalog().filter(
    (q) => !franchise || (roster && q.franchiseIds?.includes(roster.id)),
  );
  if (!pool.length)
    throw new RangeError("No eligible question scopes match this collection.");
  const recent = new Set(options.excludeIds ?? []),
    fresh = pool.filter((q) => !recent.has(q.id));
  const available = fresh.length >= Math.min(count, pool.length) ? fresh : pool;
  const families = shuffle(
    [...new Set(available.map((q) => q.family!))],
    random,
  );
  const decks = new Map(
    families.map((f) => [
      f,
      shuffle(
        available.filter((q) => q.family === f),
        random,
      ),
    ]),
  );
  const selected: Question[] = [];
  while (selected.length < Math.min(count, available.length))
    for (const family of families) {
      const candidate = decks.get(family)!.shift();
      if (candidate) selected.push(wording(candidate, random));
      if (selected.length >= Math.min(count, available.length)) break;
    }
  if (
    selected.length >= 2 &&
    new Set(selected.map((q) => q.answerKind)).size === 1
  ) {
    const keep = selected.slice(0, -1),
      usedFamilies = new Set(keep.map((q) => q.family));
    const other = shuffle(
      available.filter(
        (q) =>
          q.answerKind !== selected[0].answerKind &&
          !usedFamilies.has(q.family) &&
          !keep.some((k) => k.id === q.id),
      ),
      random,
    )[0];
    if (other) selected[selected.length - 1] = wording(other, random);
  }
  return selected;
}
