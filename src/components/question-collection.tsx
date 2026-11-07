"use client";
import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { CHARACTER_ROSTERS } from "@/data/characters";
import {
  FAMILY_LABELS,
  getQuestionCatalog,
  getEngineStats,
} from "@/lib/question-engine";
import type { Question } from "@/lib/types";
import { RarityRange } from "./ui";
const PAGE_SIZE = 18;
export default function QuestionCollection({
  onPractice,
}: {
  onPractice: (question: Question) => void;
}) {
  const [search, setSearch] = useState(""),
    [franchise, setFranchise] = useState("all"),
    [kind, setKind] = useState("all"),
    [page, setPage] = useState(0);
  const stats = getEngineStats();
  const questions = useMemo(
    () =>
      getQuestionCatalog().filter(
        (q) =>
          (kind === "all" || q.answerKind === kind) &&
          (franchise === "all" || q.franchiseIds?.includes(franchise)) &&
          `${q.prompt} ${q.franchise} ${q.category}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase().trim()),
      ),
    [search, franchise, kind],
  );
  const pages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE)),
    current = Math.min(page, pages - 1),
    visible = questions.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  return (
    <div className="animate-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ANIME KNOWLEDGE, EXPANDED</span>
          <h1>The collection.</h1>
          <p>
            {stats.questionCount.toLocaleString()} generated question scopes ·{" "}
            {stats.animeCount} anime · {stats.characterCount} characters
          </p>
        </div>
      </div>
      <div className="engine-overview">
        <span className="stat-icon red-bg">
          <Sparkles size={20} />
        </span>
        <div>
          <h3>Different angles. The full rarity range.</h3>
          <p>
            Explore eras, genres, crossovers, production credits, and name
            challenges. Every question has at least 24 curated answers and
            multiple answers in all five rarity tiers.
          </p>
        </div>
        <RarityRange />
      </div>
      <div className="collection-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search questions and anime"
            placeholder="Search topics, anime, or question types…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="select-wrap">
          <select
            aria-label="Filter anime"
            value={franchise}
            onChange={(e) => {
              setFranchise(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All franchises</option>
            {CHARACTER_ROSTERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
      </div>
      <div className="collection-results">
        <div className="segmented-control" aria-label="Answer type">
          {[
            ["all", "All questions"],
            ["character", "Characters"],
            ["anime", "Anime titles"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? "selected" : ""}
              onClick={() => {
                setKind(value);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="small-note" aria-live="polite">
          {questions.length.toLocaleString()} matching scopes
        </span>
      </div>
      <div className="collection-grid">
        {visible.map((q, i) => (
          <article className="collection-card" key={q.id}>
            <div className="collection-card-top">
              <span className="eyebrow">{q.franchise}</span>
              <span className={`difficulty ${q.difficulty.toLowerCase()}`}>
                {q.answerKind === "anime" ? "Anime" : "Characters"}
              </span>
            </div>
            <span className="collection-index">
              {String(current * PAGE_SIZE + i + 1).padStart(2, "0")}
            </span>
            <h3>{q.prompt}</h3>
            <span className="collection-family">
              {FAMILY_LABELS[q.family!]}
            </span>
            <RarityRange coverage={q.coverage} />
            <div className="collection-footer">
              <span>{q.answers.length} curated answers</span>
              <button className="text-button" onClick={() => onPractice(q)}>
                Practice
                <ArrowUpRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!questions.length && (
        <div className="empty-state">
          <div>
            <Search size={28} />
          </div>
          <h3>No anime in this arc.</h3>
          <p>Try a broader search or clear the filters.</p>
          <button
            className="button primary"
            onClick={() => {
              setSearch("");
              setFranchise("all");
              setKind("all");
              setPage(0);
            }}
          >
            Reset filters
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {questions.length > PAGE_SIZE && (
        <nav
          className="collection-pagination"
          aria-label="Question collection pages"
        >
          <button
            className="button secondary"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ArrowLeft size={14} />
            Previous
          </button>
          <span aria-live="polite">
            Page {current + 1} of {pages}
          </span>
          <button
            className="button secondary"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
            <ArrowRight size={14} />
          </button>
        </nav>
      )}
      <div className="info-card">
        <BookOpen size={22} />
        <div>
          <h3>A growing catalog, a new angle every run.</h3>
          <p>
            Questions combine reviewed facts rather than inventing answers. The
            catalog is finite and will grow as more data is reviewed. Rarity
            uses editorial prominence estimates; a narrow scope never upgrades a
            familiar answer to Legendary. Missing a valid answer? Flag it during
            a game.
          </p>
        </div>
      </div>
    </div>
  );
}
