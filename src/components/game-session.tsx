"use client";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Clock3,
  Flag,
  Sparkles,
  Trophy,
  Check,
  Send,
  SkipForward,
  ChevronDown,
  Eye,
  RotateCcw,
  Share2,
} from "lucide-react";
import { matchAnswer, remainingSeconds, scoreAnswer } from "@/lib/game";
import type { Question, RoundResult, GameRecord, Settings } from "@/lib/types";
import { RarityBadge, RarityRange } from "./ui";
import AnswerExplorer from "./answer-explorer";
import { RULES_VERSION } from "@/lib/question-engine";
function playTone(enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.13);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => void ctx.close();
  } catch {}
}
export default function GameSession({
  questions,
  mode,
  settings,
  onExit,
  onComplete,
  onReview,
  onReplay,
  dailyKey,
  nextPlayerName,
}: {
  questions: Question[];
  mode: GameRecord["mode"];
  settings: Settings;
  onExit: () => void;
  onComplete: (g: GameRecord) => void;
  onReview: (q: Question, s: string) => void;
  onReplay: () => void;
  dailyKey?: string;
  nextPlayerName?: string;
}) {
  const [index, setIndex] = useState(0),
    [rounds, setRounds] = useState<RoundResult[]>([]),
    [phase, setPhase] = useState<"answer" | "reveal" | "results">("answer");
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(settings.roundSeconds),
    [showAnswers, setShowAnswers] = useState(false),
    [copied, setCopied] = useState(false),
    [reported, setReported] = useState(false),
    [confirmExit, setConfirmExit] = useState(false);
  const deadline = useRef(Date.now() + settings.roundSeconds * 1000),
    started = useRef(Date.now()),
    locked = useRef(false),
    id = useRef(crypto.randomUUID()),
    inputRef = useRef<HTMLInputElement>(null),
    nextButtonRef = useRef<HTMLButtonElement>(null),
    timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const question = questions[index],
    total = rounds.reduce((s, r) => s + r.score, 0),
    latest = rounds[rounds.length - 1];
  const finishRef = useRef<(status: "skipped" | "timeout") => void>(() => {});
  function finish(status: "skipped" | "timeout") {
    if (locked.current) return;
    locked.current = true;
    setRounds((r) => [
      ...r,
      {
        questionId: question.id,
        questionPrompt: question.prompt,
        scopeKey: question.scopeKey,
        answerId: null,
        input,
        name: status === "timeout" ? "Time’s up" : "Round skipped",
        score: 0,
        rarity: null,
        probability: 0,
        status,
        elapsed: (Date.now() - started.current) / 1000,
      },
    ]);
    setPhase("reveal");
    setError("");
  }
  finishRef.current = finish;
  useEffect(() => {
    if (phase !== "answer") return;
    const tick = () => {
      const remaining = remainingSeconds(deadline.current);
      setSeconds(remaining);
      if (remaining === 0) finishRef.current("timeout");
    };
    tick();
    timerRef.current = setInterval(tick, 150);
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, index]);
  useEffect(() => {
    if (phase === "reveal")
      nextButtonRef.current?.focus({ preventScroll: true });
  }, [phase]);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    if (Date.now() >= deadline.current) {
      finish("timeout");
      return;
    }
    const match = matchAnswer(question, input);
    if (match.status === "unknown") {
      setError(
        match.reason === "outside-scope"
          ? "That answer is in the catalog, but it doesn’t fit this question. Check the scope and try another answer."
          : "That answer isn’t in this curated set yet. Try another name or flag it for review.",
      );
      return;
    }
    if (match.status === "ambiguous") {
      setError(
        "That name matches more than one character. Enter the full name.",
      );
      return;
    }
    locked.current = true;
    const scoring = scoreAnswer(question, match.answer);
    setRounds((r) => [
      ...r,
      {
        questionId: question.id,
        questionPrompt: question.prompt,
        scopeKey: question.scopeKey,
        answerId: match.answer.id,
        input,
        name: match.answer.name,
        score: scoring.score,
        rarity: scoring.rarity,
        probability: scoring.probability,
        status: "correct",
        elapsed: (Date.now() - started.current) / 1000,
        matchedBy: match.matchedBy,
      },
    ]);
    setPhase("reveal");
    setError("");
    playTone(settings.sound);
  }
  function next() {
    if (index === questions.length - 1) {
      const game: GameRecord = {
        id: id.current,
        date: new Date().toISOString(),
        mode,
        total,
        rounds,
        player: settings.player,
        dailyKey,
        rulesVersion: RULES_VERSION,
      };
      onComplete(game);
      setPhase("results");
      return;
    }
    setIndex((i) => i + 1);
    setInput("");
    setError("");
    setReported(false);
    setShowAnswers(false);
    locked.current = false;
    started.current = Date.now();
    deadline.current = Date.now() + settings.roundSeconds * 1000;
    setSeconds(settings.roundSeconds);
    setPhase("answer");
  }
  const best = rounds
    .filter((r) => r.rarity)
    .sort((a, b) => b.score - a.score)[0];
  async function share() {
    const text = `I scored ${total.toLocaleString()} in anillion ${mode === "daily" ? `Daily ${dailyKey}` : "Classic"}! ${rounds.filter((r) => r.status === "correct").length}/${rounds.length} answers. Go beyond the main character.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(
        "Clipboard is unavailable in this browser. Your score is saved in your profile.",
      );
    }
  }
  if (phase === "results")
    return (
      <div className="game-wrap results-page animate-enter">
        <div className="results-medal">
          <Trophy size={40} />
        </div>
        <span className="eyebrow red">
          {mode === "daily" ? "DAILY CHALLENGE COMPLETE" : "THAT’S A WRAP"}
        </span>
        <h1>Certified deep-cut energy.</h1>
        <p className="muted">A little niche knowledge goes a long way.</p>
        <div className="final-score">
          {total.toLocaleString()}
          <span>POINTS</span>
        </div>
        <div className="result-metrics">
          <div>
            <strong>
              {rounds.filter((r) => r.status === "correct").length}/
              {rounds.length}
            </strong>
            <span>Correct answers</span>
          </div>
          <div>
            <strong>{best?.rarity ?? "—"}</strong>
            <span>Rarest find</span>
          </div>
          <div>
            <strong>
              {Math.round(rounds.reduce((n, r) => n + r.elapsed, 0))}s
            </strong>
            <span>Total answer time</span>
          </div>
        </div>
        <div className="round-summary">
          {rounds.map((r, i) => (
            <div key={r.questionId}>
              <span className="round-no">0{i + 1}</span>
              <div>
                <strong>{r.name}</strong>
                <span>{questions[i].prompt}</span>
              </div>
              <RarityBadge rarity={r.rarity} />
              <b>+{r.score}</b>
            </div>
          ))}
        </div>
        <div className="result-actions">
          <button className="button primary" onClick={onReplay}>
            <RotateCcw size={16} />
            {mode === "party"
              ? nextPlayerName
                ? `Next: ${nextPlayerName}`
                : "See party rankings"
              : "Play again"}
          </button>
          <button className="button secondary" onClick={share}>
            <Share2 size={16} />
            {copied ? "Copied to clipboard" : "Share score"}
          </button>
          <button className="text-button" onClick={onExit}>
            {mode === "party"
              ? nextPlayerName
                ? "Pass the screen"
                : "See party rankings"
              : "Back to the lobby"}
            <ArrowRight size={15} />
          </button>
        </div>
        {error && (
          <p role="status" className="feedback-error">
            {error}
          </p>
        )}
        <p className="small-note">
          Saved on this device · Rarity uses starter estimates
        </p>
      </div>
    );
  return (
    <div className="game-wrap animate-enter">
      <div className="game-topbar">
        <button className="text-button" onClick={() => setConfirmExit(true)}>
          <ArrowLeft size={16} />
          Leave game
        </button>
        <span className="mode-pill">
          <span className="status-dot" />
          {mode === "daily"
            ? "Daily challenge"
            : mode === "practice"
              ? "Free practice"
              : mode === "party"
                ? "Local party"
                : "Classic solo"}
        </span>
        <div className="game-total">
          <Trophy size={16} />
          {total.toLocaleString()}
          <span>pts</span>
        </div>
      </div>
      {confirmExit && (
        <div
          role="alertdialog"
          aria-label="Leave this game?"
          className="exit-confirm"
        >
          <p>Leave this game? This unfinished run won’t be saved.</p>
          <button
            className="button secondary"
            onClick={() => setConfirmExit(false)}
          >
            Keep playing
          </button>
          <button className="button primary" onClick={onExit}>
            Leave game
          </button>
        </div>
      )}
      <div className="round-progress">
        {questions.map((q, i) => (
          <span
            key={q.id}
            className={`${i < index ? "done" : ""} ${i === index ? "current" : ""}`}
          />
        ))}
      </div>
      <div className="round-label">
        <span className="eyebrow">
          ROUND {String(index + 1).padStart(2, "0")} /{" "}
          {String(questions.length).padStart(2, "0")}
        </span>
        <span className="small-note">
          {question.category} · {question.difficulty}
        </span>
      </div>
      <section
        data-question-id={question.id}
        className={`question-panel ${phase === "reveal" ? "revealed" : ""}`}
      >
        <div className="question-watermark">問</div>
        <div className="question-meta">
          <span className="franchise-pill">{question.franchise}</span>
          <span className={`countdown ${seconds <= 10 ? "urgent" : ""}`}>
            <Clock3 size={16} />
            {phase === "answer" ? `${seconds}s` : "Locked in"}
          </span>
        </div>
        <h1>{question.prompt}</h1>
        <p>{question.subtitle}</p>
        <div className="question-footnote">
          <span>
            <Check size={13} />
            {question.answers.length} curated answers
          </span>
          <RarityRange coverage={question.coverage} />
        </div>
      </section>
      {phase === "answer" ? (
        <form className="answer-form" onSubmit={submit}>
          <label htmlFor="anime-answer">YOUR ANSWER</label>
          <div className={`answer-input-wrap ${error ? "invalid" : ""}`}>
            <Sparkles size={19} />
            <input
              ref={inputRef}
              id="anime-answer"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
                setReported(false);
              }}
              placeholder={
                question.answerKind === "anime"
                  ? "Name an anime TV series…"
                  : "Think beyond the main character…"
              }
              maxLength={120}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={error ? "answer-error" : "answer-help"}
            />
            <button
              className="button primary"
              disabled={!input.trim()}
              type="submit"
            >
              Lock it in
              <Send size={15} />
            </button>
          </div>
          {error ? (
            <div className="answer-error" id="answer-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="text-button"
                disabled={reported}
                onClick={() => {
                  onReview(question, input);
                  setReported(true);
                }}
              >
                <Flag size={13} />
                {reported ? "Saved for local review" : "Flag this answer"}
              </button>
            </div>
          ) : (
            <p id="answer-help" className="small-note">
              Aliases and minor typos accepted. Press <kbd>enter ↵</kbd> to
              submit.
            </p>
          )}
          <button
            className="text-button skip-button"
            type="button"
            onClick={() => finish("skipped")}
          >
            Skip this round
            <SkipForward size={14} />
          </button>
        </form>
      ) : (
        <div className="reveal-panel animate-enter">
          <div
            className={`reveal-icon ${latest.status === "correct" ? "" : "missed"}`}
          >
            {latest.status === "correct" ? (
              <Sparkles size={25} />
            ) : (
              <Clock3 size={25} />
            )}
          </div>
          <span className="eyebrow">
            {latest.status === "correct"
              ? "GOOD FIND. GREAT TASTE."
              : "THE NEXT ONE IS YOURS."}
          </span>
          <h2>{latest.name}</h2>
          {latest.matchedBy === "fuzzy" && (
            <p className="small-note">
              Matched your spelling to the canonical character name.
            </p>
          )}
          <RarityBadge rarity={latest.rarity} />
          <div className="revealed-score">
            +{latest.score}
            <span>POINTS</span>
          </div>
          <p className="small-note">
            {latest.status === "correct"
              ? "Rarity is an editorial estimate, consistent across question scopes."
              : "No points this round. Discover a few answers below."}
          </p>
          <div className="reveal-actions">
            <button
              className="text-button"
              onClick={() => setShowAnswers((s) => !s)}
            >
              <Eye size={15} />
              {showAnswers ? "Hide answers" : "Explore answer set"}
              <ChevronDown size={14} />
            </button>
            <button
              ref={nextButtonRef}
              className="button primary"
              onClick={next}
            >
              {index === questions.length - 1 ? "See my results" : "Next round"}
              <ArrowRight size={16} />
            </button>
          </div>
          {showAnswers && <AnswerExplorer question={question} />}
        </div>
      )}
      <div className="game-tip">
        <span>✦</span>
        <p>
          Familiar answers are a starting point.
          <br />
          <strong>Your deepest cuts are where the points live.</strong>
        </p>
      </div>
    </div>
  );
}
