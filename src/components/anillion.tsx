"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Gamepad2,
  CalendarDays,
  Trophy,
  BookOpen,
  Settings as SettingsIcon,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Flame,
  Users,
  Sparkles,
  Clock3,
  Check,
  HelpCircle,
  Volume2,
  VolumeX,
  UserRound,
  Search,
  Target,
  Layers,
  Plus,
  X,
  Globe,
  Monitor,
  ShieldCheck,
  History,
  Download,
  Flag,
  Menu,
  Zap,
  Play,
  ExternalLink,
} from "lucide-react";
import QuestionCollection from "./question-collection";
import { RULES_VERSION } from "@/lib/question-engine";
import { dateKey, selectQuestions, scoreAnswer } from "@/lib/game";
import {
  emptyProgress,
  readProgress,
  writeProgress,
  addGame,
} from "@/lib/storage";
import type { Progress, GameRecord, Question, Settings } from "@/lib/types";
import { Brand, Modal, RarityBadge, SectionTitle } from "./ui";
import GameSession from "./game-session";
type View =
  "play" | "daily" | "leaderboard" | "collection" | "profile" | "party-results";
type Dialog = "help" | "settings" | "multiplayer" | null;
type Session = {
  mode: GameRecord["mode"];
  questions: Question[];
  key: string;
  dailyKey?: string;
};
interface Party {
  players: string[];
  index: number;
  games: GameRecord[];
  questions: Question[];
}
const modes = [
  {
    id: "classic",
    tag: "THE ORIGINAL",
    name: "Classic solo",
    description:
      "Five questions. One mission. Find the answers nobody else thinks of.",
    icon: Gamepad2,
    meta: "5 rounds",
    time: "30 sec / round",
    button: "Play solo",
    color: "red",
  },
  {
    id: "daily",
    tag: "A FRESH CHALLENGE",
    name: "The daily drop",
    description: "New angles every day. The same challenge for everyone.",
    icon: CalendarDays,
    meta: "5 rounds",
    time: "Resets at 00:00 UTC",
    button: "Take the challenge",
    color: "gold",
  },
  {
    id: "multiplayer",
    tag: "BETTER WITH RIVALS",
    name: "Play with friends",
    description:
      "Settle who really knows anime. Bring your friends and your deepest cuts.",
    icon: Users,
    meta: "2–6 players",
    time: "Pass & play available",
    button: "Gather your party",
    color: "purple",
  },
];
export default function Anillion() {
  const [view, setView] = useState<View>("play"),
    [dialog, setDialog] = useState<Dialog>(null),
    [progress, setProgress] = useState<Progress>(emptyProgress),
    [ready, setReady] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [party, setParty] = useState<Party | null>(null),
    [mobileOpen, setMobileOpen] = useState(false),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("All modes"),
    [rankFilter, setRankFilter] = useState("All runs");
  useEffect(() => {
    setProgress(readProgress());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !writeProgress(progress))
      setToast(
        "Browser storage is unavailable. Progress will last for this session.",
      );
  }, [progress, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.motion = progress.settings.reducedMotion
      ? "reduced"
      : "full";
  }, [progress.settings.reducedMotion]);
  const closeDialog = useCallback(() => setDialog(null), []);
  const classicGames = progress.games.filter(
    (g) => g.mode === "classic" || g.mode === "daily",
  );
  const best = Math.max(0, ...classicGames.map((g) => g.total));
  const dailyGame = progress.games.find(
    (g) =>
      g.mode === "daily" &&
      g.dailyKey === dateKey() &&
      g.rulesVersion === RULES_VERSION,
  );
  const rareFinds = progress.games
    .flatMap((g) => g.rounds)
    .filter((r) => r.rarity === "Epic" || r.rarity === "Legendary").length;
  function navigate(next: View) {
    setView(next);
    setSession(null);
    setMobileOpen(false);
  }
  function start(mode: GameRecord["mode"], franchise?: string) {
    setParty(null);
    setDialog(null);
    setSession({
      mode,
      questions: selectQuestions(mode, 5, franchise, undefined, {
        excludeIds: progress.games.flatMap((g) =>
          g.rounds.map((r) => r.questionId),
        ),
      }),
      key: crypto.randomUUID(),
      dailyKey: mode === "daily" ? dateKey() : undefined,
    });
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function complete(game: GameRecord) {
    setProgress((p) =>
      addGame(
        p,
        game.mode === "daily" &&
          p.games.some(
            (g) =>
              g.mode === "daily" &&
              g.dailyKey === game.dailyKey &&
              g.rulesVersion === game.rulesVersion,
          )
          ? { ...game, mode: "practice" }
          : game,
      ),
    );
    if (party) setParty((p) => (p ? { ...p, games: [...p.games, game] } : p));
  }
  function exitSession() {
    if (party && party.games.length > party.index) {
      if (party.index + 1 < party.players.length) {
        setParty((p) => (p ? { ...p, index: p.index + 1 } : p));
        setSession(null);
        setDialog("multiplayer");
      } else {
        setView("party-results");
        setSession(null);
      }
    } else {
      setSession(null);
      if (party) setParty(null);
    }
  }
  function beginParty(players: string[]) {
    const qs = selectQuestions("party");
    setParty({ players, index: 0, games: [], questions: qs });
    setDialog(null);
    setSession({ mode: "party", questions: qs, key: crypto.randomUUID() });
  }
  function nextParty() {
    if (!party) return;
    setDialog(null);
    setSession({
      mode: "party",
      questions: party.questions,
      key: crypto.randomUUID(),
    });
  }
  function updateSettings(settings: Settings) {
    setProgress((p) => ({ ...p, settings }));
    setDialog(null);
    setToast("Preferences saved. Your next run is ready.");
  }
  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anillion-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const navItems = [
    { id: "play" as View, label: "Play", icon: Gamepad2 },
    { id: "daily" as View, label: "Daily challenge", icon: CalendarDays },
    { id: "leaderboard" as View, label: "Leaderboard", icon: Trophy },
    { id: "collection" as View, label: "Anime collection", icon: BookOpen },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <button
          className="brand-button"
          aria-label="anillion home"
          onClick={() => navigate("play")}
        >
          <Brand />
        </button>
        <div className="sidebar-caption">YOUR NEXT OBSESSION</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${view === id && !session ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "daily" ? (
                <span className="nav-new" aria-hidden="true">
                  NEW
                </span>
              ) : id === "play" ? (
                <ChevronRight size={14} />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <span className="sidebar-caption">YOUR CORNER</span>
        <nav aria-label="Personal navigation">
          <button
            className={`nav-link ${view === "profile" ? "active" : ""}`}
            onClick={() => navigate("profile")}
          >
            <UserRound size={18} />
            <span>My profile</span>
          </button>
          <button className="nav-link" onClick={() => setDialog("settings")}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="beta-card">
            <span className="beta-symbol">✦</span>
            <span className="eyebrow">A NEW ARC BEGINS</span>
            <h3>
              Built for the
              <br />
              deeply obsessed.
            </h3>
            <p>
              Small collection. Big potential.
              <br />
              Welcome to the first chapter.
            </p>
            <button
              className="text-button"
              onClick={() => {
                navigate("collection");
              }}
            >
              Explore the collection
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" />
            EARLY ACCESS<span>v0.1</span>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={20} />
            </button>
            <span className="topbar-title">THE ANIME RARITY GAME</span>
            <span className="topbar-separator">/</span>
            <span className="topbar-location">
              {session
                ? "In game"
                : view === "play"
                  ? "The lobby"
                  : view === "daily"
                    ? "Daily challenge"
                    : view === "leaderboard"
                      ? "Leaderboard"
                      : view === "collection"
                        ? "The collection"
                        : view === "party-results"
                          ? "Party results"
                          : "Your profile"}
            </span>
          </div>
          <div className="topbar-actions">
            <button className="help-button" onClick={() => setDialog("help")}>
              <HelpCircle size={16} />
              <span>How to play</span>
            </button>
            <span className="header-divider" />
            <button
              className="icon-button sound-toggle"
              aria-label={
                progress.settings.sound ? "Mute sounds" : "Enable sounds"
              }
              onClick={() =>
                setProgress((p) => ({
                  ...p,
                  settings: { ...p.settings, sound: !p.settings.sound },
                }))
              }
            >
              {progress.settings.sound ? (
                <Volume2 size={17} />
              ) : (
                <VolumeX size={17} />
              )}
            </button>
            <button
              className="avatar"
              aria-label="Open your profile"
              onClick={() => navigate("profile")}
            >
              {progress.settings.player.slice(0, 1).toUpperCase()}
              <span />
            </button>
          </div>
        </header>
        <main className={`main-content ${session ? "in-session" : ""}`}>
          {session ? (
            <GameSession
              key={session.key}
              questions={session.questions}
              mode={session.mode}
              settings={{
                ...progress.settings,
                player: party?.players[party.index] ?? progress.settings.player,
                roundSeconds:
                  session.mode === "daily"
                    ? 30
                    : progress.settings.roundSeconds,
              }}
              dailyKey={session.dailyKey}
              nextPlayerName={party?.players[party.index + 1]}
              onExit={exitSession}
              onComplete={complete}
              onReplay={() => {
                if (party) exitSession();
                else start(session.mode);
              }}
              onReview={(question, input) => {
                setProgress((p) => ({
                  ...p,
                  reviews: [
                    {
                      questionId: question.id,
                      questionPrompt: question.prompt,
                      scopeKey: question.scopeKey,
                      rulesVersion: RULES_VERSION,
                      input,
                      date: new Date().toISOString(),
                    },
                    ...p.reviews,
                  ].slice(0, 100),
                }));
              }}
            />
          ) : (
            <>
              {view === "play" && (
                <div className="animate-enter">
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        LESS OBVIOUS. MORE LEGENDARY.
                      </span>
                      <h1>
                        Go beyond the main character
                        <span className="red">.</span>
                      </h1>
                      <p>
                        Your anime knowledge deserves more than a watchlist.
                      </p>
                    </div>
                    <div className="edition-label">
                      <span>ANILLION</span>
                      <b>VOL. 001</b>
                    </div>
                  </div>
                  <section className="hero">
                    <div
                      className="hero-art"
                      role="img"
                      aria-label="Original ink illustration of a swordsman beneath a crimson eclipse"
                    />
                    <div className="hero-shade" />
                    <div className="hero-content">
                      <span className="hero-kicker">
                        <span className="status-dot" />
                        FOR THE ONES WHO WATCH THE FILLER
                      </span>
                      <h2>
                        The rarer the answer.
                        <br />
                        The greater the glory.
                      </h2>
                      <p>
                        Name an anime or character. Find a deep cut.
                        <br />
                        Get rewarded for knowing a little too much.
                      </p>
                      <div className="hero-actions">
                        <button
                          className="button primary"
                          onClick={() => start("classic")}
                        >
                          Let’s play
                          <ArrowRight size={17} />
                        </button>
                        <button
                          className="hero-how"
                          onClick={() => setDialog("help")}
                        >
                          <span>
                            <Play size={11} fill="currentColor" />
                          </span>
                          How it works
                        </button>
                      </div>
                      <div className="hero-footnote">
                        <span>100% anime.</span>
                        <span>0% obvious.</span>
                      </div>
                    </div>
                    <div className="hero-stamp">
                      <span>知る人ぞ知る</span>
                      <b>
                        IF YOU KNOW,
                        <br />
                        YOU KNOW.
                      </b>
                    </div>
                    <span className="hero-coordinate">
                      35°41′22″N / ANILLION UNIVERSE
                    </span>
                  </section>
                  <div className="stats-strip">
                    <div>
                      <span className="stat-icon red-bg">
                        <Trophy size={18} />
                      </span>
                      <span>
                        <strong>
                          {best.toLocaleString()}
                          <small>pts</small>
                        </strong>
                        <span>Your personal best</span>
                      </span>
                    </div>
                    <div>
                      <span className="stat-icon gold-bg">
                        <Flame size={19} />
                      </span>
                      <span>
                        <strong>
                          {classicGames.length}
                          <small>
                            {classicGames.length === 1 ? "game" : "games"}
                          </small>
                        </strong>
                        <span>Runs completed</span>
                      </span>
                    </div>
                    <div>
                      <span className="stat-icon purple-bg">
                        <Sparkles size={18} />
                      </span>
                      <span>
                        <strong>
                          {rareFinds}
                          <small>{rareFinds === 1 ? "find" : "finds"}</small>
                        </strong>
                        <span>Epic & legendary answers</span>
                      </span>
                    </div>
                    <span className="stats-caption">
                      YOUR STORY STARTS HERE
                      <ArrowUpRight size={15} />
                    </span>
                  </div>
                  <div className="section-heading modes-heading">
                    <div>
                      <span className="eyebrow">PICK YOUR NEXT ARC</span>
                      <h2>A mode for every kind of fan.</h2>
                    </div>
                    <div
                      className="segmented-control"
                      aria-label="Filter game modes"
                    >
                      {["All modes", "Solo", "With friends"].map((f) => (
                        <button
                          key={f}
                          className={filter === f ? "selected" : ""}
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`mode-grid ${filter !== "All modes" ? "filtered" : ""}`}
                  >
                    {modes
                      .filter(
                        (m) =>
                          filter === "All modes" ||
                          (filter === "Solo"
                            ? m.id !== "multiplayer"
                            : m.id === "multiplayer"),
                      )
                      .map(
                        ({
                          id,
                          tag,
                          name,
                          description,
                          icon: Icon,
                          meta,
                          time,
                          button,
                          color,
                        }) => (
                          <article className={`mode-card ${color}`} key={id}>
                            <div className="mode-art">
                              <span className="mode-art-glyph">
                                {id === "classic"
                                  ? "独"
                                  : id === "daily"
                                    ? "日"
                                    : "友"}
                              </span>
                              <span className="mode-art-line" />
                              <span className="mode-icon">
                                <Icon size={25} />
                              </span>
                              <span className="mode-tag">{tag}</span>
                              {id === "daily" && <span className="daily-dot" />}
                            </div>
                            <div className="mode-body">
                              <h3>{name}</h3>
                              <p>{description}</p>
                              <div className="mode-meta">
                                <span>
                                  <Layers size={12} />
                                  {meta}
                                </span>
                                <span>
                                  <Clock3 size={12} />
                                  {id === "classic"
                                    ? `${progress.settings.roundSeconds} sec / round`
                                    : time}
                                </span>
                              </div>
                              <button
                                className={`button mode-play ${id === "classic" ? "primary" : "secondary"}`}
                                onClick={() =>
                                  id === "multiplayer"
                                    ? setDialog("multiplayer")
                                    : id === "daily"
                                      ? navigate("daily")
                                      : start("classic")
                                }
                              >
                                {button}
                                <ArrowUpRight size={16} />
                              </button>
                            </div>
                          </article>
                        ),
                      )}
                  </div>
                  <section className="rarity-banner">
                    <div className="rarity-banner-icon">
                      <Sparkles size={25} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        FAMOUS IS FINE. FORGOTTEN IS BETTER.
                      </span>
                      <h3>Main character energy? Overrated.</h3>
                      <p>
                        Your favorite background character might just be your
                        best answer.
                      </p>
                    </div>
                    <div className="rarity-scale">
                      <span className="rarity-common">Common</span>
                      <i />
                      <span className="rarity-rare">Rare</span>
                      <i />
                      <span className="rarity-legendary">
                        Legendary
                        <Sparkles size={12} />
                      </span>
                    </div>
                    <button
                      className="circle-arrow"
                      aria-label="Learn about rarity scoring"
                      onClick={() => setDialog("help")}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </section>
                </div>
              )}
              {view === "daily" && (
                <div className="daily-page animate-enter">
                  <PageHeading
                    eyebrow="YOUR DAILY DOSE OF DEEP CUTS"
                    title="The daily drop."
                    description="Five questions. A fresh set every day. How far does your knowledge go?"
                  />
                  <section className="daily-feature">
                    <div className="daily-feature-art" />
                    <div className="daily-feature-content">
                      <span className="mode-pill">
                        <CalendarDays size={14} />
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        }).format(new Date())}{" "}
                        · UTC
                      </span>
                      <div className="daily-emblem">
                        <Flame size={42} />
                      </div>
                      <h2>
                        One day.
                        <br />
                        Five chances for glory.
                      </h2>
                      <p>
                        Everyone gets the same generated questions.
                        <br />
                        The challenge changes at midnight UTC.
                      </p>
                      <div className="daily-specs">
                        <span>
                          <Layers size={15} />5 rounds
                        </span>
                        <span>
                          <Clock3 size={15} />
                          30 seconds
                        </span>
                        <span>
                          <Target size={15} />
                          5,000 max points
                        </span>
                      </div>
                      <button
                        className="button primary"
                        onClick={() => start("daily")}
                      >
                        {dailyGame
                          ? "Replay today’s challenge"
                          : "Start today’s challenge"}
                        <ArrowRight size={16} />
                      </button>
                      {dailyGame && (
                        <p className="daily-played">
                          <Check size={14} />
                          Completed today · {dailyGame.total.toLocaleString()}{" "}
                          points · Replays are practice
                        </p>
                      )}
                    </div>
                  </section>
                  <div className="info-card">
                    <ShieldCheck size={22} />
                    <div>
                      <h3>A level playing field.</h3>
                      <p>
                        The daily uses a fixed 30-second timer and identical
                        questions. Scores are saved locally during early access;
                        a shared daily leaderboard is coming with online play.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {view === "leaderboard" && (
                <div className="animate-enter">
                  <PageHeading
                    eyebrow="A LITTLE FRIENDLY COMPETITION"
                    title="The bragging board."
                    description="Your best runs, rarest answers, and personal rivalries. All in one place."
                  />
                  <div className="board-feature">
                    <Trophy size={32} />
                    <div>
                      <span className="eyebrow">PERSONAL BEST</span>
                      <strong>
                        {best.toLocaleString()}
                        <small>POINTS</small>
                      </strong>
                    </div>
                    <p>
                      Every deep cut
                      <br />
                      has a place in history.
                    </p>
                    <span className="board-glyph">勝</span>
                  </div>
                  <div className="section-heading">
                    <h2>Your leaderboard</h2>
                    <div className="segmented-control">
                      {["All runs", "Classic", "Daily"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setRankFilter(f)}
                          className={rankFilter === f ? "selected" : ""}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="small-note leaderboard-note">
                    <Monitor size={13} />
                    This device only · Online rankings arrive with multiplayer
                  </p>
                  <div className="leaderboard-table">
                    <div className="table-header">
                      <span>RANK</span>
                      <span>PLAYER / RUN</span>
                      <span>MODE</span>
                      <span>TOP FIND</span>
                      <span>SCORE</span>
                    </div>
                    {classicGames
                      .filter(
                        (g) =>
                          rankFilter === "All runs" ||
                          g.mode === rankFilter.toLowerCase(),
                      )
                      .sort((a, b) => b.total - a.total)
                      .map((g, i) => (
                        <div className="table-row" key={g.id}>
                          <span className={`rank rank-${i + 1}`}>
                            {i < 3 ? (
                              <Trophy size={17} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <div className="table-player">
                            <span className="mini-avatar">{g.player[0]}</span>
                            <span>
                              <b>{g.player}</b>
                              <small>
                                {new Date(g.date).toLocaleDateString()}
                              </small>
                            </span>
                          </div>
                          <span className="mode-label">{g.mode}</span>
                          <RarityBadge
                            rarity={
                              [...g.rounds].sort((a, b) => b.score - a.score)[0]
                                ?.rarity ?? null
                            }
                          />
                          <strong>{g.total.toLocaleString()}</strong>
                        </div>
                      ))}
                    {!classicGames.filter(
                      (g) =>
                        rankFilter === "All runs" ||
                        g.mode === rankFilter.toLowerCase(),
                    ).length && (
                      <EmptyState
                        icon={<Trophy size={30} />}
                        title="The top spot is wide open."
                        description="Finish your first run and put your name on the board."
                        action="Play your first game"
                        onAction={() => start("classic")}
                      />
                    )}
                  </div>
                </div>
              )}
              {view === "collection" && (
                <QuestionCollection
                  onPractice={(question) => {
                    setParty(null);
                    setSession({
                      mode: "practice",
                      questions: [question],
                      key: crypto.randomUUID(),
                    });
                  }}
                />
              )}
              {view === "profile" && (
                <div className="animate-enter">
                  <PageHeading
                    eyebrow="EVERY FAN HAS A STORY"
                    title="Your anime arc."
                    description="A little proof that all those episodes were worth it."
                  />
                  <section className="profile-card">
                    <span className="profile-avatar">
                      {progress.settings.player[0]}
                    </span>
                    <div>
                      <span className="eyebrow red">
                        {classicGames.length >= 10
                          ? "SEASONED EXPLORER"
                          : "RISING ROOKIE"}
                      </span>
                      <h2>{progress.settings.player}</h2>
                      <p>
                        {classicGames.length} completed runs · {rareFinds} epic
                        & legendary finds
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setDialog("settings")}
                    >
                      Edit profile
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                  <div className="profile-metrics">
                    <div>
                      <Trophy size={21} />
                      <strong>{best.toLocaleString()}</strong>
                      <span>Personal best</span>
                    </div>
                    <div>
                      <Gamepad2 size={21} />
                      <strong>{classicGames.length}</strong>
                      <span>Games completed</span>
                    </div>
                    <div>
                      <Sparkles size={21} />
                      <strong>{rareFinds}</strong>
                      <span>Rare discoveries</span>
                    </div>
                  </div>
                  <SectionTitle
                    title="Recent adventures"
                    action="Export progress"
                    onAction={exportProgress}
                  />
                  {progress.games.length ? (
                    <div className="history-list">
                      {progress.games.slice(0, 10).map((g) => (
                        <div key={g.id}>
                          <span className="stat-icon red-bg">
                            <History size={18} />
                          </span>
                          <span>
                            <b>
                              {g.mode === "party"
                                ? `${g.player} · Party game`
                                : g.mode === "daily"
                                  ? "The daily drop"
                                  : g.mode === "practice"
                                    ? "Practice session"
                                    : "Classic solo"}
                            </b>
                            <small>{new Date(g.date).toLocaleString()}</small>
                          </span>
                          <span>
                            {
                              g.rounds.filter((r) => r.status === "correct")
                                .length
                            }
                            /{g.rounds.length} correct
                          </span>
                          <strong>
                            {g.total.toLocaleString()}
                            <small>pts</small>
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<History size={28} />}
                      title="Your first chapter is unwritten."
                      description="Start a game and turn your anime knowledge into a story worth telling."
                      action="Start a run"
                      onAction={() => start("classic")}
                    />
                  )}
                  <div className="info-card">
                    <Flag size={21} />
                    <div>
                      <h3>
                        {progress.reviews.length}{" "}
                        {progress.reviews.length === 1 ? "answer" : "answers"}{" "}
                        flagged for review
                      </h3>
                      <p>
                        Review flags are saved on this device and included when
                        you export progress. A shared moderation queue will
                        arrive with the backend.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {view === "party-results" && party && (
                <div className="party-results animate-enter">
                  <div className="results-medal">
                    <Trophy size={40} />
                  </div>
                  <span className="eyebrow red">LOCAL PARTY COMPLETE</span>
                  <h1>Bragging rights, awarded.</h1>
                  <p className="muted">
                    Same questions. Different depths of obsession.
                  </p>
                  <div className="party-ranking">
                    {[...party.games]
                      .sort((a, b) => b.total - a.total)
                      .map((g, i) => (
                        <div key={g.id}>
                          <span>
                            {i === 0 ? "🏆" : String(i + 1).padStart(2, "0")}
                          </span>
                          <b>{g.player}</b>
                          <strong>
                            {g.total.toLocaleString()}
                            <small>pts</small>
                          </strong>
                        </div>
                      ))}
                  </div>
                  <button
                    className="button primary"
                    onClick={() => {
                      setParty(null);
                      setDialog("multiplayer");
                    }}
                  >
                    Play another party
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>
            <span className="footer-star">✦</span>Made for fans who know a
            little too much.
          </span>
          <div>
            <span>ANIME ONLY. ALWAYS.</span>
            <span className="footer-dot" />
            <button onClick={() => setDialog("help")}>
              How rarity works
              <ArrowUpRight size={12} />
            </button>
          </div>
        </footer>
      </div>
      {dialog === "help" && (
        <Modal title="Obscure knowledge. Real glory." onClose={closeDialog}>
          <div className="how-steps">
            {[
              {
                icon: BookOpen,
                title: "Read the question.",
                text: "Each round has a broad answer set from a reviewed catalog, with every rarity tier available. You have 30 seconds by default.",
              },
              {
                icon: Search,
                title: "Think a little deeper.",
                text: "Name a character or anime that fits the question. Common answers earn fewer points; deeper cuts earn more. Aliases and minor typos count.",
              },
              {
                icon: Sparkles,
                title: "Let your deep cut shine.",
                text: "Lock in your answer, reveal its rarity, and collect up to 1,000 points. Five rounds make a classic run.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <div key={title}>
                <span className="step-number">0{i + 1}</span>
                <Icon size={21} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rarity-examples">
            {(["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const).map(
              (r) => (
                <RarityBadge key={r} rarity={r} />
              ),
            )}
          </div>
          <div className="modal-note">
            <ShieldCheck size={17} />
            <p>
              Early access rarity uses editorial prominence estimates, not
              measured player percentages. The curated collection may not
              include every valid character. You can flag an unrecognized answer
              for review.
            </p>
          </div>
          <button
            className="button primary full"
            onClick={() => start("classic")}
          >
            I know a character you don’t
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {dialog === "settings" && (
        <SettingsDialog
          settings={progress.settings}
          onSave={updateSettings}
          onClose={closeDialog}
          onExport={exportProgress}
        />
      )}
      {dialog === "multiplayer" && (
        <PartyDialog
          onClose={closeDialog}
          onStart={beginParty}
          party={party}
          onNext={nextParty}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="button primary" onClick={onAction}>
        {action}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function SettingsDialog({
  settings,
  onSave,
  onClose,
  onExport,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
  onExport: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  return (
    <Modal title="Make yourself at home." onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...draft, player: draft.player.trim() || "Player One" });
        }}
      >
        <label className="field-label" htmlFor="player-name">
          DISPLAY NAME
        </label>
        <input
          className="standard-input"
          id="player-name"
          value={draft.player}
          maxLength={24}
          onChange={(e) => setDraft((s) => ({ ...s, player: e.target.value }))}
          placeholder="Player One"
        />
        <p className="small-note">Your name on this device’s leaderboard.</p>
        <label className="field-label" htmlFor="timer-setting">
          CLASSIC ROUND TIMER
        </label>
        <select
          className="standard-input"
          id="timer-setting"
          value={draft.roundSeconds}
          onChange={(e) =>
            setDraft((s) => ({ ...s, roundSeconds: Number(e.target.value) }))
          }
        >
          {[15, 30, 45, 60].map((s) => (
            <option key={s} value={s}>
              {s} seconds
            </option>
          ))}
        </select>
        <p className="small-note">Daily challenges always use 30 seconds.</p>
        <label className="toggle-row">
          <span>
            <b>Sound effects</b>
            <small>A little celebration for a good find.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.sound}
            onChange={(e) =>
              setDraft((s) => ({ ...s, sound: e.target.checked }))
            }
          />
        </label>
        <label className="toggle-row">
          <span>
            <b>Reduce motion</b>
            <small>Keep the experience a little calmer.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.reducedMotion}
            onChange={(e) =>
              setDraft((s) => ({ ...s, reducedMotion: e.target.checked }))
            }
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="text-button" onClick={onExport}>
            <Download size={15} />
            Export progress
          </button>
          <button type="submit" className="button primary">
            Save preferences
            <Check size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PartyDialog({
  onClose,
  onStart,
  party,
  onNext,
}: {
  onClose: () => void;
  onStart: (names: string[]) => void;
  party: Party | null;
  onNext: () => void;
}) {
  const [tab, setTab] = useState("Pass & play"),
    [names, setNames] = useState(["Player One", "Player Two"]),
    [error, setError] = useState("");
  if (party && party.games.length > 0 && party.index < party.players.length)
    return (
      <Modal title="Pass the screen." onClose={onClose}>
        <div className="handoff">
          <Users size={42} />
          <span className="eyebrow">
            PLAYER {party.index + 1} / {party.players.length}
          </span>
          <h3>{party.players[party.index]}, you’re up.</h3>
          <p>
            Other players: look away during this run.
            <br />
            The same five questions await.
          </p>
          <button className="button primary" onClick={onNext}>
            I’m ready
            <ArrowRight size={16} />
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal title="Gather your party." onClose={onClose}>
      <div className="party-tabs segmented-control">
        {["Pass & play", "Online rooms"].map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t === "Pass & play" ? <Monitor size={15} /> : <Globe size={15} />}{" "}
            {t}
          </button>
        ))}
      </div>
      {tab === "Pass & play" ? (
        <>
          <p className="modal-intro">
            One screen. A few rivals. Take turns playing the same five
            questions, then compare your scores.
          </p>
          <span className="field-label">
            YOUR PARTY · {names.length}/6 PLAYERS
          </span>
          <div className="party-players">
            {names.map((name, i) => (
              <div key={i}>
                <span className="mini-avatar">{i + 1}</span>
                <input
                  aria-label={`Player ${i + 1} name`}
                  value={name}
                  onChange={(e) =>
                    setNames((n) =>
                      n.map((x, j) => (i === j ? e.target.value : x)),
                    )
                  }
                  maxLength={24}
                  placeholder={`Player ${i + 1}`}
                />
                {names.length > 2 && (
                  <button
                    className="icon-button"
                    aria-label={`Remove player ${i + 1}`}
                    onClick={() => setNames((n) => n.filter((_, j) => i !== j))}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {names.length < 6 && (
            <button
              className="text-button add-player"
              onClick={() => setNames((n) => [...n, `Player ${n.length + 1}`])}
            >
              <Plus size={15} />
              Add a player
            </button>
          )}
          <div className="modal-note">
            <Users size={18} />
            <p>
              Honor system: look away while someone else plays, including their
              answer reveals. Everyone gets the same questions and timer.
            </p>
          </div>
          {error && (
            <p className="feedback-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full"
            onClick={() => {
              const clean = names.map((n, i) => n.trim() || `Player ${i + 1}`);
              if (
                new Set(clean.map((n) => n.toLowerCase())).size !== clean.length
              ) {
                setError("Give every player a different name.");
                return;
              }
              onStart(clean);
            }}
          >
            Start local party
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <div className="online-placeholder">
          <div className="online-icon">
            <Globe size={34} />
          </div>
          <span className="coming-tag">THE NEXT CHAPTER</span>
          <h3>Great rivalries cross distances.</h3>
          <p>
            Private rooms, join codes, synchronized rounds, and live rankings
            are planned for the online release. A shared backend is the next
            step.
          </p>
          <button
            className="button secondary"
            onClick={() => setTab("Pass & play")}
          >
            Try pass & play
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </Modal>
  );
}
