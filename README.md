# anillion

An anime rarity game for fans who know a little too much. Built directly in this repository with Next.js, React, TypeScript, and Tailwind CSS, with an original dark ink and red interface.

## Run locally

Requires Node.js 20.9 or newer (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. No accounts, API keys, database, or environment variables are required.

```sh
npm test                # Engine, matching, scoring, daily rotation, and storage
npm run audit:questions # Audit every playable answer set against actual scoring
npm run typecheck
npm run build           # Includes the full-bank audit; static export in out/
npm start               # Preview the built game at 127.0.0.1:3000
npm run test:e2e         # Full browser flows; run dev or production preview first
```

Browser tests use installed Google Chrome through Playwright. To use bundled Chromium, run `npx playwright install chromium` and remove `channel: 'chrome'` in `playwright.config.ts`. The `out/` directory works on a static host, and the repository can be deployed with Vercel's Next.js preset. Online deployment is not configured here.

## Playable now

- **Generated questions:** 1,045 distinct answer scopes from 81 reviewed anime TV adaptations and 216 canonical characters. Eight template families cover anime/character eras, genres, crossovers, broad franchise rosters, production credits, and name rules. Wording variants do not inflate that scope count.
- **Full rarity coverage:** every playable scope has at least 24 answers and multiple Common, Uncommon, Rare, Epic, and Legendary answers. Narrow, unbalanced scopes are rejected. A familiar answer never becomes Legendary just because a question is narrower.
- **Classic solo:** five timed rounds with different question families and both answer kinds, recent-scope avoidance, one locked answer per round, retries, skipping, reveals, and a final scorecard.
- **Daily:** a versioned deterministic UTC schedule with five generated scopes, identical for every player. Replays become practice; changing engine versions does not collide with old daily history.
- **Practice and discovery:** searchable, paginated collection; franchise and answer-type filters; a reveal explorer with rarity filters, answer search, progressively loaded results, and factual source links.
- **Validation:** canonical IDs, English/romanized aliases, Unicode and punctuation normalization, controlled typo matching, ambiguous-name handling, and distinct feedback for a known answer outside the current scope.
- **Local persistence:** profile, preferences, personal leaderboard, run history, review flags with question context, JSON export, sound, reduced motion, and adjustable classic timers.
- A shared-device pass-and-play interface remains available. **Online multiplayer is deferred** while single-player is refined.

The engine can keep producing sessions and daily challenges. Its underlying factual catalog is finite; new reviewed data automatically expands the possible scopes. It never invents anime facts to claim literally infinite unique questions.

## Data and scoring

The runtime uses a bounded, reviewed Wikidata TV-entity snapshot and manually curated character facts with source links. No external API is called while playing or building; no third-party popularity statistics or API responses are fabricated. Missing metadata remains unknown. Production-company credits are not automatically treated as animation-studio credits.

Prominence weights and rarity scores are **editorial estimates**, not measured player frequencies. They remain stable per canonical entity across scopes. A future trusted-frequency path is isolated from local progress; online competitive scoring requires server validation and versioned frequency snapshots.

See [question-engine design and expansion guide](docs/QUESTION_ENGINE.md), [data provenance and usage restrictions](docs/DATA_SOURCES.md), [architecture](docs/ARCHITECTURE.md), and [original artwork provenance](docs/ARTWORK.md).

## Project structure

```text
src/
  app/                         Next.js entry point, metadata, styling
  components/
    anillion.tsx               Dashboard, daily, profile, preferences, session shell
    game-session.tsx           Timed rounds, validation, reveals, results
    question-collection.tsx    Paginated generated-question browser
    answer-explorer.tsx        Searchable answer reveals and rarity filters
    ui.tsx                     Shared accessible UI primitives
  data/
    anime.json                 Reviewed TV adaptation facts and canonical IDs
    anime.ts                   Named metadata taxonomy and franchise links
    characters.ts              Character facts, aliases, source links, estimates
    questions.ts               Compatibility export of compiled scopes
  lib/
    question-engine.ts         Predicates, templates, coverage gate, selection
    scoring.ts                 Stable scoring, rarity tiers, coverage
    random.ts                  Seeded randomization and UTC boundaries
    game.ts                    Answer normalization, matching, game helpers
    storage.ts                 Backward-compatible local persistence
    types.ts                   Shared domain contracts
scripts/audit-questions.ts      Build-time whole-bank rarity audit
scripts/serve.mjs               Local static production preview
public/images/                 Original generated artwork
schema and factual evidence:   docs/data/wikidata-reviewed.json
tests/                         Engine and browser flow tests
```

The original GitHub `origin` is preserved. No credentials belong in tracked files or the browser bundle.
