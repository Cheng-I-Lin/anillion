"use client";
import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { Question, Rarity } from "@/lib/types";
import { scoreAnswer, RARITIES } from "@/lib/scoring";
import { RarityBadge } from "./ui";
export default function AnswerExplorer({ question }: { question: Question }) {
  const [tier, setTier] = useState<Rarity | "All">("All"),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(12);
  const scoredAnswers = useMemo(
    () =>
      question.answers.map((answer) => ({
        answer,
        ...scoreAnswer(question, answer),
      })),
    [question],
  );
  const answers = scoredAnswers
    .filter(
      (row) =>
        (tier === "All" || row.rarity === tier) &&
        [row.answer.name, ...row.answer.aliases].some((name) =>
          name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()),
        ),
    )
    .sort(
      (a, b) => b.score - a.score || a.answer.name.localeCompare(b.answer.name),
    );
  return (
    <div className="answer-explorer">
      <div
        className="answer-tier-filters"
        aria-label="Filter revealed answers by rarity"
      >
        <button
          className={tier === "All" ? "selected" : ""}
          onClick={() => {
            setTier("All");
            setLimit(12);
          }}
        >
          All answers ({question.answers.length})
        </button>
        {RARITIES.map((rarity) => (
          <button
            key={rarity}
            className={tier === rarity ? "selected" : ""}
            onClick={() => {
              setTier(rarity);
              setLimit(12);
            }}
          >
            {rarity} ({question.coverage[rarity]})
          </button>
        ))}
      </div>
      <div className="search-field">
        <Search size={15} />
        <input
          aria-label="Search revealed answers"
          placeholder="Find a name in this answer set…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(12);
          }}
        />
      </div>
      <div className="answer-reveal-grid">
        {answers.slice(0, limit).map((row) => (
          <div key={row.answer.id}>
            <span>{row.answer.name}</span>
            <RarityBadge rarity={row.rarity} />
            <b>{row.score}</b>
          </div>
        ))}
      </div>
      {!answers.length && (
        <p className="small-note">No answers match this filter.</p>
      )}
      <div className="answer-explorer-footer">
        <span className="small-note">
          Showing {Math.min(limit, answers.length)} of {answers.length} matching
          answers
        </span>
        {answers.length > limit && (
          <button
            className="text-button"
            onClick={() => setLimit((n) => n + 24)}
          >
            Show more
            <ChevronDown size={14} />
          </button>
        )}
      </div>
      <details className="answer-sources">
        <summary>Catalog sources ({question.sources.length})</summary>
        <div className="answer-source-links">
          {question.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.label} ↗
            </a>
          ))}
        </div>
      </details>
    </div>
  );
}
