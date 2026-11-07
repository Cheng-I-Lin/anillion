import type { GameRecord, Progress, Settings } from "./types";
export const STORAGE_KEY = "anillion:progress:v1";
export const DEFAULT_SETTINGS: Settings = {
  player: "Player One",
  sound: true,
  reducedMotion: false,
  roundSeconds: 30,
};
export const emptyProgress = (): Progress => ({
  version: 1,
  games: [],
  settings: { ...DEFAULT_SETTINGS },
  reviews: [],
});
export function readProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (value?.version !== 1 || !Array.isArray(value.games))
      return emptyProgress();
    const settings = { ...DEFAULT_SETTINGS, ...value.settings };
    settings.player =
      typeof settings.player === "string"
        ? settings.player.slice(0, 24)
        : DEFAULT_SETTINGS.player;
    settings.roundSeconds = [15, 30, 45, 60].includes(settings.roundSeconds)
      ? settings.roundSeconds
      : 30;
    return {
      version: 1,
      games: value.games
        .filter(
          (g: GameRecord) =>
            typeof g?.total === "number" &&
            Array.isArray(g.rounds) &&
            typeof g.date === "string",
        )
        .slice(0, 100),
      settings,
      reviews: Array.isArray(value.reviews) ? value.reviews.slice(0, 100) : [],
    };
  } catch {
    return emptyProgress();
  }
}
export function writeProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function addGame(progress: Progress, game: GameRecord): Progress {
  if (progress.games.some((g) => g.id === game.id)) return progress;
  return { ...progress, games: [game, ...progress.games].slice(0, 100) };
}
