// Compatibility facade. The playable bank is compiled from catalog predicates, never hand-written rows.
import { getQuestionCatalog } from "@/lib/question-engine";
import { CHARACTER_ROSTERS, CHARACTERS } from "./characters";
export const QUESTIONS = getQuestionCatalog();
export const FRANCHISES = CHARACTER_ROSTERS.map((roster) => roster.name);
export const ANSWER_COUNT = CHARACTERS.length;
