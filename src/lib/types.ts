export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export interface Answer {
  id: string;
  name: string;
  aliases: string[];
  prominence: number;
  groups?: string[];
  kind?: "character" | "anime";
  franchiseId?: string;
  source?: string;
}
export interface Question {
  id: string;
  franchise: string;
  prompt: string;
  subtitle: string;
  category: string;
  family: QuestionFamily;
  answerKind: "character" | "anime";
  franchiseIds: string[];
  scope: QuestionScope;
  scopeKey: string;
  coverage: RarityCoverage;
  sources: { label: string; url: string }[];
  promptVariants: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  answers: Answer[];
  source: string;
  accent: string;
}
export interface RoundResult {
  questionId: string;
  questionPrompt?: string;
  scopeKey?: string;
  answerId: string | null;
  input: string;
  name: string;
  score: number;
  rarity: Rarity | null;
  probability: number;
  status: "correct" | "skipped" | "timeout";
  elapsed: number;
  matchedBy?: "exact" | "fuzzy";
}
export interface GameRecord {
  id: string;
  date: string;
  mode: "classic" | "daily" | "practice" | "party";
  total: number;
  rounds: RoundResult[];
  player: string;
  dailyKey?: string;
  rulesVersion?: string;
}
export interface Settings {
  player: string;
  sound: boolean;
  reducedMotion: boolean;
  roundSeconds: number;
}
export interface Progress {
  version: 1;
  games: GameRecord[];
  settings: Settings;
  reviews: {
    questionId: string;
    input: string;
    date: string;
    questionPrompt?: string;
    scopeKey?: string;
    rulesVersion?: string;
  }[];
}

export type RarityCoverage = Record<Rarity, number>;
export type QuestionFamily =
  | "franchise"
  | "crossover"
  | "character-era"
  | "character-genre"
  | "anime-era"
  | "anime-genre"
  | "production"
  | "name";
export type NameRule =
  | { type: "contains" | "without" | "starts"; letters: string }
  | { type: "length"; minimum: number; maximum: number };
export interface QuestionScope {
  kind: "character" | "anime";
  franchiseIds?: string[];
  excludeFranchiseIds?: string[];
  years?: { from: number; to: number };
  genres?: string[];
  productionCompanies?: string[];
  name?: NameRule;
}
export interface AnimeRecord extends Answer {
  kind: "anime";
  firstYear: number | null;
  genres: string[];
  productionCompanies: string[];
  wikidataId: string;
  source: string;
}
