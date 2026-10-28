import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Heart,
  Keyboard,
  Sparkles,
  Trophy,
} from "lucide-react";
import { GameStage } from "./components/GameStage";
import { Leaderboard } from "./components/Leaderboard";
import { SoundEngine } from "./game/audio";
import {
  createInitialSnapshot,
  SnakeEngine,
  type GameSnapshot,
  type RunResult,
  type TurnDirection,
} from "./game/engine";
import {
  cleanName,
  loadPlayerName,
  loadScores,
  savePlayerName,
  saveScores,
  type ScoreEntry,
} from "./game/scores";

const SOUND_KEY = "matzmeika:sound:v1";

const initialSoundEnabled = () => {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

function BrandMark() {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-ink bg-ink shadow-[3px_3px_0_rgba(19,32,25,0.16)] sm:h-11 sm:w-11">
      <span
        aria-hidden
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(201,247,90,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,247,90,.5) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      <svg viewBox="0 0 32 32" className="relative h-7 w-7" aria-hidden fill="none">
        <path
          d="M23 8h-8.2a5.2 5.2 0 0 0 0 10.4h4.4a4.2 4.2 0 0 1 0 8.4H11"
          stroke="#c9f75a"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <circle cx="25" cy="9" r="2.1" fill="#c9f75a" />
        <circle cx="25.4" cy="8.6" r="0.6" fill="#132019" />
        <path d="M25.8 20.4v5.2M23.2 23h5.2" stroke="#ff7a58" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  if (!soundRef.current) soundRef.current = new SoundEngine();

  const [snapshot, setSnapshot] = useState<GameSnapshot>(createInitialSnapshot);
  const [scores, setScores] = useState<ScoreEntry[]>(loadScores);
  const [playerName, setPlayerName] = useState<string>(loadPlayerName);
  const [latestEntry, setLatestEntry] = useState<ScoreEntry | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [soundOn, setSoundOn] = useState(initialSoundEnabled);

  const snapshotRef = useRef(snapshot);
  const scoresRef = useRef(scores);
  const playerNameRef = useRef(playerName);
  snapshotRef.current = snapshot;
  scoresRef.current = scores;
  playerNameRef.current = playerName;

  const recordRun = useCallback((result: RunResult) => {
    setLastResult(result);
    const currentScores = scoresRef.current;
    const previousBest = currentScores[0]?.score ?? 0;
    setIsNewRecord(result.score > previousBest && result.score > 0);

    if (result.score <= 0) {
      setLatestEntry(null);
      return;
    }

    const entry: ScoreEntry = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName(playerNameRef.current) || "Игрок",
      score: result.score,
      level: result.level,
      correct: result.correct,
      date: new Date().toISOString(),
    };

    const updated = [...currentScores, entry]
      .sort((a, b) => b.score - a.score || (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 5);
    const qualified = updated.some((saved) => saved.id === entry.id);

    setScores(updated);
    saveScores(updated);
    setLatestEntry(qualified ? entry : null);
  }, []);

  useEffect(() => {
    const audio = soundRef.current;
    if (audio) audio.enabled = soundOn;
    if (!canvasRef.current) return;

    const engine = new SnakeEngine(canvasRef.current, {
      onSnapshot: setSnapshot,
      onEvent: (event) => soundRef.current?.play(event),
      onGameOver: (result) => recordRun(result),
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) {
      (window as typeof window & { __snake?: SnakeEngine }).__snake = engine;
    }

    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [recordRun]);

  useEffect(() => {
    const audio = soundRef.current;
    if (audio) audio.enabled = soundOn;
    try {
      window.localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
    } catch {
      // Non-essential preference.
    }
  }, [soundOn]);

  const clearRoundOverlay = useCallback(() => {
    setLatestEntry(null);
    setLastResult(null);
    setIsNewRecord(false);
  }, []);

  const startGame = useCallback(() => {
    soundRef.current?.unlock();
    clearRoundOverlay();
    engineRef.current?.start();
  }, [clearRoundOverlay]);

  const restartGame = useCallback(() => {
    soundRef.current?.unlock();
    clearRoundOverlay();
    engineRef.current?.restart();
  }, [clearRoundOverlay]);

  const goHome = useCallback(() => {
    clearRoundOverlay();
    engineRef.current?.goHome();
    soundRef.current?.play("click");
  }, [clearRoundOverlay]);

  const pauseGame = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resumeGame = useCallback(() => {
    soundRef.current?.unlock();
    engineRef.current?.resume();
  }, []);

  const turn = useCallback((direction: TurnDirection) => {
    engineRef.current?.turn(direction);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((previous) => {
      const next = !previous;
      const audio = soundRef.current;
      if (audio) {
        audio.enabled = next;
        if (next) {
          audio.unlock();
          audio.play("click");
        }
      }
      return next;
    });
  }, []);

  const handleNameChange = useCallback(
    (rawName: string) => {
      const nextName = rawName.slice(0, 12);
      setPlayerName(nextName);
      savePlayerName(nextName);
      const displayName = cleanName(nextName) || "Игрок";
      if (!latestEntry) return;

      setScores((previous) => {
        const updated = previous.map((entry) =>
          entry.id === latestEntry.id ? { ...entry, name: displayName } : entry
        );
        saveScores(updated);
        return updated;
      });
      setLatestEntry((previous) => (previous ? { ...previous, name: displayName } : previous));
    },
    [latestEntry]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const isInteractive = Boolean(target?.closest("button, a"));
      const isSpace = event.code === "Space" || event.key === " ";
      const isConfirm = event.key === "Enter" || isSpace;
      if (isInteractive && isConfirm) return;

      if (isSpace || event.key.startsWith("Arrow")) event.preventDefault();
      const phase = snapshotRef.current.phase;

      if (phase === "ready") {
        if (isConfirm) startGame();
        return;
      }

      if (phase === "over") {
        if (event.code === "KeyR" || isConfirm) restartGame();
        else if (event.key === "Escape") goHome();
        return;
      }

      if (phase === "paused") {
        if (event.code === "KeyR") restartGame();
        else if (event.code === "KeyP" || event.key === "Escape" || isConfirm) resumeGame();
        return;
      }

      if (event.code === "KeyP" || event.key === "Escape" || isSpace) {
        pauseGame();
        return;
      }
      if (event.code === "KeyR") {
        restartGame();
        return;
      }

      const directionByCode: Record<string, TurnDirection | undefined> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        KeyW: "up",
        KeyS: "down",
        KeyA: "left",
        KeyD: "right",
      };
      const direction = directionByCode[event.code] ?? directionByCode[event.key];
      if (direction) turn(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goHome, pauseGame, restartGame, resumeGame, startGame, turn]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && snapshotRef.current.phase === "playing") {
        engineRef.current?.pause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const bestScore = scores[0]?.score ?? 0;

  return (
    <div className="page-bg min-h-[100dvh]">
      <header className="mx-auto flex w-full max-w-[1216px] items-center justify-between gap-4 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5 lg:px-8">
        <a
          href="#game"
          className="group flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:gap-3"
          aria-label="Матзмейка — на главную"
        >
          <BrandMark />
          <span className="min-w-0">
            <h1 className="font-display text-[15px] font-semibold leading-none tracking-[-0.055em] text-ink sm:text-[18px]">
              МАТЗМЕЙКА
            </h1>
            <p className="mt-1 truncate text-[8px] font-extrabold uppercase tracking-[0.18em] text-ink/44 sm:text-[9px]">
              математическая змейка
            </p>
          </span>
        </a>

        <div className="hidden items-center gap-1.5 rounded-full border border-ink/10 bg-white/45 px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-ink/45 xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7aa81a]" />
          реши
          <ChevronRight className="h-3 w-3 text-ink/25" />
          поверни
          <ChevronRight className="h-3 w-3 text-ink/25" />
          расти
        </div>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Навигация">
          <a
            href="#rules"
            className="hidden rounded-full border border-ink/15 bg-white/45 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink/60 transition hover:border-ink/40 hover:text-ink sm:inline-flex"
          >
            Правила
          </a>
          <a
            href="#author"
            className="hidden rounded-full border border-ink/15 bg-white/45 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink/60 transition hover:border-ink/40 hover:text-ink md:inline-flex"
          >
            Об авторе
          </a>
          <a
            href="#records"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-paper transition hover:bg-[#24392c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Trophy className="h-3 w-3 text-acid" strokeWidth={2.4} />
            Рекорды
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1216px] px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_356px] xl:gap-6">
          <GameStage
            canvasRef={canvasRef}
            snapshot={snapshot}
            scores={scores}
            latestEntry={latestEntry}
            playerName={playerName}
            lastResult={lastResult}
            isNewRecord={isNewRecord}
            soundOn={soundOn}
            onStart={startGame}
            onPause={pauseGame}
            onResume={resumeGame}
            onRestart={restartGame}
            onHome={goHome}
            onTurn={turn}
            onNameChange={handleNameChange}
            onToggleSound={toggleSound}
          />

          <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:gap-5" aria-label="Правила и рекорды">
            <section
              id="rules"
              className="paper-card relative scroll-mt-4 overflow-hidden bg-acid p-4 sm:p-5"
              aria-labelledby="rules-title"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-4 -top-8 select-none font-display text-[118px] leading-none text-ink/[0.07]"
              >
                π
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-5 left-[42%] select-none font-display text-[74px] leading-none text-ink/[0.055]"
              >
                ×
              </span>

              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink/50">
                    Правила клуба
                  </div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/20 bg-white/35">
                    <Sparkles className="h-3.5 w-3.5 text-ink/65" />
                  </span>
                </div>
                <h2
                  id="rules-title"
                  className="mt-1 font-display text-[22px] leading-[1.05] tracking-[-0.06em] text-ink sm:text-[24px]"
                >
                  Думай на ходу.
                </h2>
                <p className="mt-1.5 text-[11px] font-semibold leading-snug text-ink/58 sm:text-[12px]">
                  Змейка не останавливается. Зато у каждого примера есть ровно один ответ.
                </p>

                <ol className="mt-3 space-y-1.5">
                  {[
                    ["01", "Вычисли ответ на табло."],
                    ["02", "Съешь шар с этим числом."],
                    ["03", "Не врезайся в хвост и стены."],
                  ].map(([number, text]) => (
                    <li
                      key={number}
                      className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-white/32 px-2.5 py-1.5"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink font-display text-[8px] text-acid">
                        {number}
                      </span>
                      <span className="text-[11px] font-bold leading-tight text-ink/75 sm:text-xs">
                        {text}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.06em] text-ink/55">
                    <Heart className="h-3 w-3 fill-coral text-coral" />
                    +1 сердце за серию ×5
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.06em] text-ink/55">
                    <Keyboard className="h-3 w-3" />
                    свайп управляет
                  </span>
                </div>
              </div>
            </section>

            <Leaderboard scores={scores} latestEntry={latestEntry} />

            <section
              id="author"
              className="paper-card relative scroll-mt-4 overflow-hidden p-4 sm:p-5"
              aria-labelledby="author-title"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-ink/50">
                  <GraduationCap className="h-3.5 w-3.5 text-ink/65" />
                  Авторская разработка
                </div>
                <span className="rounded-full border border-ink/15 bg-white/70 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink/65">
                  2026 г.
                </span>
              </div>

              <h3
                id="author-title"
                className="mt-2 font-display text-[17px] leading-tight tracking-[-0.04em] text-ink sm:text-[18px]"
              >
                Рычкова Екатерина
              </h3>
              <div className="mt-0.5 text-[11px] font-bold text-ink/60">
                Учитель информатики и математики
              </div>

              <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink/70">
                Автор игры принадлежит учителю информатики и математики Рычковой Екатерине. Создано в 2026 г. — это авторская разработка для увлекательного развития математического мышления и устного счёта.
              </p>

              <a
                href="https://m.vk.ru/katyrychkova_stem"
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 flex items-center justify-between gap-2 rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-[11px] font-bold text-ink shadow-[2px_2px_0_rgba(19,32,25,0.1)] transition hover:border-ink hover:bg-white active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                aria-label="ВКонтакте автора: Рычкова Екатерина (откроется в новой вкладке)"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0077ff] text-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
                      <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.072-3.875.98-4.27 1.838-2.618.955 1.837 1.637 2.946 2.87 3.328.618.192 1.25.172 1.779.037.114-.029.215-.091.272-.186.075-.126.059-.286-.03-.437-.308-.521-1.391-2.096-2.019-3.085-.689-1.085-.724-1.397.042-2.38 1.815-2.327 2.658-3.923 2.646-4.295-.011-.341-.339-.427-.665-.427h-2.102c-.365 0-.585.163-.73.493-.852 1.932-1.921 3.738-2.642 4.195-.456.289-.705.158-.781-.301-.339-2.03.144-4.148-.718-4.387h-2.947c-.52 0-.847.288-.847.575 0 .616.924.757 1.018 2.484.072 1.325-.333 1.57-.866 1.57-.743 0-1.879-1.728-2.62-3.708-.18-.48-.485-.705-.884-.705h-2.06c-.347 0-.518.156-.6.389-.136.388.077 1.554 1.282 3.864 1.939 3.718 4.298 6.425 7.425 6.495z" />
                    </svg>
                  </span>
                  <span>ВКонтакте автора</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/50 group-hover:text-ink">
                  <span>katyrychkova_stem</span>
                  <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            </section>

            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-ink/10 bg-white/36 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-acid">
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-ink/40">
                    цель клуба
                  </div>
                  <div className="font-display text-[13px] leading-tight text-ink">
                    побей {bestScore.toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>
              <a
                href="#game"
                className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-ink/55 transition hover:text-ink"
              >
                играть
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </aside>
        </div>

        <footer className="mt-8 border-t border-ink/12 pb-6 pt-5">
          <div className="flex flex-col gap-3 rounded-[20px] border border-ink/10 bg-paper/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ink text-acid">
                  <GraduationCap className="h-3.5 w-3.5" />
                </span>
                <span className="font-display text-[13px] font-semibold tracking-[-0.03em] text-ink sm:text-[14px]">
                  Авторская разработка · 2026 г.
                </span>
              </div>
              <p className="text-[11px] font-medium leading-relaxed text-ink/75 sm:text-xs">
                Автор игры принадлежит учителю информатики и математики{" "}
                <span className="font-bold text-ink">Рычковой Екатерине</span>. Создано в 2026 г. — это авторская разработка.
              </p>
            </div>

            <a
              href="https://m.vk.ru/katyrychkova_stem"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-ink bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-[2px_2px_0_#132019] transition hover:bg-acid active:translate-y-0.5 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded bg-[#0077ff] text-white">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
                  <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.072-3.875.98-4.27 1.838-2.618.955 1.837 1.637 2.946 2.87 3.328.618.192 1.25.172 1.779.037.114-.029.215-.091.272-.186.075-.126.059-.286-.03-.437-.308-.521-1.391-2.096-2.019-3.085-.689-1.085-.724-1.397.042-2.38 1.815-2.327 2.658-3.923 2.646-4.295-.011-.341-.339-.427-.665-.427h-2.102c-.365 0-.585.163-.73.493-.852 1.932-1.921 3.738-2.642 4.195-.456.289-.705.158-.781-.301-.339-2.03.144-4.148-.718-4.387h-2.947c-.52 0-.847.288-.847.575 0 .616.924.757 1.018 2.484.072 1.325-.333 1.57-.866 1.57-.743 0-1.879-1.728-2.62-3.708-.18-.48-.485-.705-.884-.705h-2.06c-.347 0-.518.156-.6.389-.136.388.077 1.554 1.282 3.864 1.939 3.718 4.298 6.425 7.425 6.495z" />
                </svg>
              </span>
              <span>ВКонтакте автора</span>
              <ExternalLink className="h-3 w-3 text-ink/60" />
            </a>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-ink/38 sm:flex-row sm:items-center sm:justify-between">
            <span>Матзмейка © 2026 · авторская математическая игра</span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-ink/25" />
              <span className="text-ink/45">реши · поверни · расти</span>
              <span className="h-1 w-1 rounded-full bg-ink/25" />
              <span>Рычкова Екатерина</span>
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
