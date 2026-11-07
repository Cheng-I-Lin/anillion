# Generated questions and rarity coverage

## Scope and guarantees

The fixed twenty-row bank has been replaced by a compiler over structured catalog records. The current snapshot has **81 anime TV adaptations, 216 characters, and 1,045 distinct playable answer scopes**. Wording variants are not counted as distinct scopes. There is no fixed maximum bank size in the sampler; new reviewed records create new combinations without adding question rows.

A finite catalog cannot supply literally infinite distinct factual questions. The engine supports ongoing daily challenges and repeatable generated sessions, with overlapping topics allowed. It never invents characters, release years, relationships, or answers to manufacture novelty. The data snapshot and rules are versioned; growing the reviewed catalog grows the factual coverage.

Every compiled question must have:

- At least **24 distinct canonical answers**.
- At least **two Common, two Uncommon, two Rare, two Epic, and two Legendary answers**, measured using the actual scoring function.
- Valid prominence estimates and a recoverable scope definition.
- A unique answer-set fingerprint. Different phrasing or equivalent predicates do not inflate the catalog count.

Narrow rosters such as the nine Hashira, the Straw Hat crew alone, or Kyoto students are excluded when they cannot meet these conditions. The compiler also builds broader franchise unions, era windows, and genre unions. Failure does not trigger a fallback that relaxes the rarity requirement.

## Modules

| Module                       | Responsibility                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/data/characters.ts`     | Canonical character IDs, romanized names, aliases, franchise relationships, reference links, editorial prominence.    |
| `src/data/anime.json`        | Reviewed TV adaptation IDs and factual metadata from the bounded Wikidata snapshot.                                   |
| `src/data/anime.ts`          | Named genre taxonomy, production-company labels, and explicit character-franchise-to-TV-adaptation links.             |
| `src/lib/question-engine.ts` | Scope predicates, prompt families, quality gate, answer-set deduplication, daily scheduling, fresh session selection. |
| `src/lib/scoring.ts`         | Stable editorial scores, rarity tiers, coverage, and the isolated future trusted-frequency path.                      |
| `src/lib/random.ts`          | Deterministic seeded randomization and UTC day keys.                                                                  |
| `src/lib/game.ts`            | Normalization, alias/typo matching, ambiguity and outside-scope feedback, public game helpers.                        |
| `scripts/audit-questions.ts` | Build gate validating the whole compiled bank against real scoring.                                                   |

`Question` requires its scope, family, canonical answer kind, coverage, sources, and stable ID. A question is a predicate over facts; the displayed English sentence is not used as a validation oracle.

## Template families

1. **Franchise rosters:** a broad reviewed character roster that meets the full quality gate.
2. **Anime crossovers:** any of two or three franchises; or characters outside specified franchises in the collection.
3. **Characters by era:** use the first air year of the linked TV adaptation.
4. **Characters by genre:** match at least one explicitly named catalog genre.
5. **Anime by era:** inclusive first-air-year windows over actual TV entities.
6. **Anime by genre:** explicit OR combinations of reviewed genre claims.
7. **Production credits:** explicit OR combinations of source-listed production companies. These are **not assumed to be animation-studio credits**.
8. **Names and letters:** canonical listed names/titles containing, excluding, or starting with specified letters; or within an explicit letter-count range. Spaces, punctuation, and accent marks are excluded from letter counts. An alias is accepted only if its canonical entity is eligible.

Missing metadata never becomes an inferred fact. The wording says “tagged … in the catalog” because genre coverage is incomplete and taxonomies differ. Year predicates refer to the television adaptation, not its manga or franchise debut. `Hunter × Hunter` refers to the reviewed 2011 TV entity; `Tamayura: Hitotose` is a TV entity rather than the earlier OVA. Episode-count prompts are not enabled because ongoing totals and per-season versus whole-series counts were not independently standardized.

## Rarity that does not inflate when a scope narrows

The previous formula was relative to the average prominence of answers in a question. A narrow scope could have no Legendary answer, or make familiar answers appear more obscure simply by changing the average.

The new editorial estimate is stable per canonical entity:

```text
score = round(clamp(100 + 450 × log10(100 / prominence), 100, 1000))
```

A weight of 100 earns 100 points; a weight of 1 earns 1,000. The tiers are Common (<220), Uncommon (220–419), Rare (420–649), Epic (650–849), and Legendary (850+). An answer receives the same estimated score in every scope it belongs to. Narrowing a scope never promotes an answer. If there are too few truly low-weight answers, the prompt is rejected.

Weights remain editorial estimates, not measured global popularity or player percentages. The isolated trusted-frequency scoring path retains minimum samples and prior smoothing, but no local history is passed to it and no anonymous global frequency claim is made. Future observed scoring must version its snapshot and rerun coverage checks using that snapshot before admitting questions.

## Sessions and daily reproducibility

Classic sessions sample distinct question families, include both anime and character answers when available, and avoid scope IDs from locally saved recent runs. If recent history covers the eligible bank, replay becomes possible again without weakening question-quality rules. Practice filters can keep questions relevant to a selected franchise. A session uses canonical entities and fixed weights throughout its rounds.

A daily is selected using the UTC date and a versioned data/rules identifier. Daily decks are shuffled deterministically per family and consumed in consecutive slots, rather than independently rolling the same twenty entries each day. Local history never influences a daily. Tests verify a year's worth of daily selection for reproducibility, five distinct families, full rarity coverage, and no repeated scope on consecutive days. Repeats over longer periods remain possible with finite data.

Completed runs store `rulesVersion`; rounds store the displayed prompt and scope key alongside the canonical question and answer IDs. Flags also preserve prompt/scope/rules context. Older local history is retained. A previous daily from the old rules does not block the current version's first attempt.

## Expanding the catalog

1. Review the source's current license, usage rules, and the exact adaptation/entity. Do not substitute a manga, season, film, dubbing, or live-action item for a television adaptation.
2. Add the canonical entity, aliases, explicit source references, and only supported factual fields. Keep unknown values unknown. Prominence is a separately labeled editorial estimate.
3. For a new character franchise, add its roster and explicit TV-entity mapping. Add named taxonomy labels only when their semantics are understood.
4. Update the bounded metadata provenance snapshot and bump `DATA_VERSION` when facts or memberships change. Bump scoring or engine versions when their rules change.
5. Run `npm run audit:questions`, `npm test`, `npm run typecheck`, and `npm run build`. The production build automatically runs the full-bank audit.

No external API is required while playing or building. Nothing is scraped or generated by an LLM at runtime.
