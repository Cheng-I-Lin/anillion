# Architecture and single-player roadmap

The application uses Next.js App Router, React, TypeScript, and Tailwind CSS 4, with Lucide icons. It exports static HTML/CSS/JavaScript for standard static hosting or Vercel. Single-player needs no backend, account, or API key.

## Question generation and scoring

The [question engine](QUESTION_ENGINE.md) compiles structured anime and character facts into scoped predicates. It replaces the fixed twenty-question starter bank. Eight template families generate new era, genre, franchise, crossover, production-credit, and name variations as the catalog expands. Every playable scope has at least 24 answers and two answers in every rarity tier. Production builds fail if the full-bank audit detects a violated invariant.

Rarity estimates use an absolute per-entity prominence scale. The same character or anime earns the same estimated points across different scopes; a narrow filter cannot inflate rarity. Broad scopes with insufficient coverage are rejected. Editorial estimates remain clearly separated from observed player behavior.

Classic sessions avoid recently completed scopes and mix families and answer kinds. The daily uses a versioned deterministic schedule independent of local history. New question, data, and scoring versions are recorded in completed runs so changing the engine does not confuse first-attempt daily tracking. The collection and reveal explorer paginate/filter the expanded bank instead of rendering thousands of cards or hundreds of names at once.

## Game state and matching

The shell owns navigation, preferences, saved progress, and the selected question objects. A session owns `question → answer/retry → locked reveal → next round → results`. A synchronous submission lock prevents duplicate results. The timer uses a wall-clock deadline, so background-tab suspension does not extend a round. Submissions after the deadline expire even if a timer callback has not run.

Answer matching normalizes Unicode, case, whitespace, and punctuation. Exact canonical names and aliases take precedence. One edit is allowed for inputs of at least five characters; two for inputs of at least ten. Equally close candidates request a fuller name. Cross-franchise collisions such as “Hinata” remain ambiguous until clarified. A known catalog answer outside the current predicate gets scope-specific feedback; unknown answers can be flagged.

## Persistence

A versioned localStorage record contains preferences, up to 100 runs, and up to 100 review flags. Runs store rules versions and rounds preserve prompt/scope context. Old records are readable; flags and progress can be exported. Local history influences only classic variety, never rarity or shared daily selection. It is specific to the browser and site origin, and clearing site storage removes it.

## Next single-player work

- Expand reviewed rosters and metadata coverage, with entity-level provenance and documented aliases.
- Incorporate actual playtest feedback to refine the separately labeled editorial prominence estimates.
- Add further question families only when factual fields and scope definitions are reviewed and meet rarity-coverage gates.
- Add resumable sessions and an import/restore flow for exported progress.
- Add an explicit local review workflow for flagged answers.

## Deferred online architecture

Online multiplayer, accounts, remote persistence, public leaderboards, and a shared moderation queue remain deferred at the user's request. Do not provision a backend to refine single-player.

A later PostgreSQL/Supabase backend should separate canonical entities, aliases, provenance, data and question versions, rounds, immutable accepted submissions, review requests, and trusted frequency snapshots. The server must select question/scoring versions, validate answers and deadlines, and enforce one accepted submission per player/round. Shared daily attempts need a unique authenticated-player/challenge/version constraint. Reconnection state must come from the server.

Observed rarity requires trusted identity/session constraints, rate limiting, abuse detection, minimum sample sizes, and a frozen aggregate snapshot per game. Smoothing alone does not prevent abuse. Uploaded client scores and local flags must not become trusted competitive records without validation.
