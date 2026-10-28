import { useRef, type PointerEvent, type RefObject } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  Flame,
  Heart,
  Home,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { GameOverReason, GameSnapshot, RunResult, TurnDirection } from "../game/engine";
import type { ScoreEntry } from "../game/scores";
import { cn } from "../utils/cn";

const numberFormatter = new Intl.NumberFormat("ru-RU");

const formatScore = (score: number) => numberFormatter.format(score);

const reasonCopy: Record<GameOverReason, { title: string; description: string }> = {
  wall: {
    title: "Не хватило одного поворота.",
    description: "Стена забрала последнее сердце. В следующий раз поверни чуть раньше.",
  },
  self: {
    title: "Хвост тебя догнал.",
    description: "Своя змейка тоже препятствие. Рассчитывай траекторию на пару клеток вперёд.",
  },
  mistakes: {
    title: "Три неточных ответа.",
    description: "Спокойнее: сначала реши пример, потом тянись к числу.",
  },
};

interface GameStageProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  snapshot: GameSnapshot;
  scores: ScoreEntry[];
  latestEntry: ScoreEntry | null;
  playerName: string;
  lastResult: RunResult | null;
  isNewRecord: boolean;
  soundOn: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onTurn: (direction: TurnDirection) => void;
  onNameChange: (name: string) => void;
  onToggleSound: () => void;
}

function Hearts({ lives }: { lives: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Жизни: ${lives} из 3`}>
      {[0, 1, 2].map((index) => (
        <Heart
          key={index}
          className={cn(
            "h-4 w-4 transition-all duration-300 sm:h-[18px] sm:w-[18px]",
            index < lives
              ? "scale-100 fill-coral text-coral drop-shadow-[0_0_6px_rgba(255,122,88,0.32)]"
              : "scale-90 text-white/18"
          )}
          strokeWidth={2.1}
          aria-hidden
        />
      ))}
    </div>
  );
}

function DirectionPad({ onTurn }: { onTurn: (direction: TurnDirection) => void }) {
  const press = (direction: TurnDirection) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onTurn(direction);
  };

  return (
    <div
      className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1"
      style={{ width: 126, height: 126 }}
      aria-label="Сенсорное управление змейкой"
    >
      <span />
      <button
        type="button"
        className="dpad-button"
        onPointerDown={press("up")}
        aria-label="Повернуть вверх"
      >
        <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <span />
      <button
        type="button"
        className="dpad-button"
        onPointerDown={press("left")}
        aria-label="Повернуть влево"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <span className="flex items-center justify-center rounded-[14px] border border-acid/25 bg-acid/10 text-acid">
        <span className="font-display text-[15px] leading-none">×</span>
      </span>
      <button
        type="button"
        className="dpad-button"
        onPointerDown={press("right")}
        aria-label="Повернуть вправо"
      >
        <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <span />
      <button
        type="button"
        className="dpad-button"
        onPointerDown={press("down")}
        aria-label="Повернуть вниз"
      >
        <ArrowDown className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <span />
    </div>
  );
}

export function GameStage({
  canvasRef,
  snapshot,
  scores,
  latestEntry,
  playerName,
  lastResult,
  isNewRecord,
  soundOn,
  onStart,
  onPause,
  onResume,
  onRestart,
  onHome,
  onTurn,
  onNameChange,
  onToggleSound,
}: GameStageProps) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);
  const canPause = snapshot.phase === "playing" || snapshot.phase === "paused";
  const progress = snapshot.correct % 4;
  const topCut = scores[scores.length - 1]?.score ?? 0;
  const missedTop = lastResult ? Math.max(0, topCut - lastResult.score + 1) : 0;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (snapshot.phase !== "playing") return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swipeHandled.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || swipeHandled.current || snapshot.phase !== "playing") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    swipeHandled.current = true;
    if (Math.abs(dx) > Math.abs(dy)) onTurn(dx > 0 ? "right" : "left");
    else onTurn(dy > 0 ? "down" : "up");
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || swipeHandled.current || snapshot.phase !== "playing") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    if (Math.abs(dx) > Math.abs(dy)) onTurn(dx > 0 ? "right" : "left");
    else onTurn(dy > 0 ? "down" : "up");
  };

  return (
    <section
      id="game"
      className="game-card rounded-[24px] p-2.5 sm:rounded-[30px] sm:p-4 lg:p-5"
      aria-label="Математическая змейка"
    >
      <div className="mx-auto w-full max-w-[560px] lg:max-w-[492px]">
        <div className="flex items-center gap-2 px-1 pb-2.5 pt-0.5 sm:gap-4 sm:pb-3">
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.19em] text-muted sm:text-[10px]">
              Счёт
            </div>
            <div
              key={snapshot.score}
              className="score-bump font-display text-[25px] leading-none tracking-[-0.05em] text-acid sm:text-[30px]"
              aria-live="polite"
            >
              {formatScore(snapshot.score)}
            </div>
            <div className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.14em] text-white/35 sm:block">
              рекорд {formatScore(scores[0]?.score ?? 0)}
            </div>
          </div>

          <div className="mx-1 hidden h-8 w-px bg-white/10 sm:mx-0 sm:block" aria-hidden />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.19em] text-muted sm:text-[10px]">
              <Flame className="h-3 w-3 text-coral" aria-hidden />
              Серия
            </div>
            <div
              key={snapshot.combo}
              className={cn(
                "combo-pop mt-0.5 font-display text-[19px] leading-none tracking-[-0.04em] sm:text-[22px]",
                snapshot.combo >= 2 ? "text-acid" : "text-white/72"
              )}
            >
              {snapshot.combo > 0 ? `×${snapshot.combo}` : "—"}
            </div>
          </div>

          <div className="ml-0.5 min-w-0 sm:ml-1">
            <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.19em] text-muted sm:text-[10px]">
              Жизни
            </div>
            <Hearts lives={snapshot.lives} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleSound}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/65 transition hover:border-acid/50 hover:text-acid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid sm:h-9 sm:w-9"
              aria-label={soundOn ? "Выключить звук" : "Включить звук"}
              title={soundOn ? "Выключить звук" : "Включить звук"}
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <VolumeX className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
            <button
              type="button"
              onClick={snapshot.phase === "paused" ? onResume : onPause}
              disabled={!canPause}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/65 transition enabled:hover:border-acid/50 enabled:hover:text-acid disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid sm:h-9 sm:w-9"
              aria-label={snapshot.phase === "paused" ? "Продолжить игру" : "Пауза"}
              title={snapshot.phase === "paused" ? "Продолжить" : "Пауза"}
            >
              {snapshot.phase === "paused" ? (
                <Play className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <Pause className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
          </div>
        </div>

        <div className="question-card relative flex items-center gap-2 rounded-[17px] px-3 py-2.5 sm:gap-4 sm:rounded-[20px] sm:px-5 sm:py-3">
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-ink/50 sm:text-[10px]">
              <Sparkles className="h-3 w-3 text-ink/45" aria-hidden />
              Реши пример
            </div>
            <div className="whitespace-nowrap font-display text-[clamp(1rem,5.3vw,2rem)] leading-none tracking-[-0.055em] text-ink">
              {snapshot.question.text}
              <span className="ml-1.5 text-coral">= ?</span>
            </div>
          </div>

          <div className="ml-auto shrink-0 border-l border-ink/12 pl-3 sm:pl-4">
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                ур.
              </span>
              <span className="font-display text-lg leading-none text-ink sm:text-xl">
                {String(snapshot.level).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 w-2.5 rounded-full transition-all duration-300",
                    index < progress ? "bg-ink" : "bg-ink/15"
                  )}
                />
              ))}
            </div>
            <div className="mt-1 hidden text-[8px] font-bold uppercase tracking-[0.1em] text-ink/40 sm:block">
              {progress === 3 ? "ещё 1 — уровень" : `до уровня ${snapshot.nextLevelIn}`}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "game-board relative mt-2.5 aspect-square w-full overflow-hidden rounded-[18px] sm:mt-3 sm:rounded-[22px]",
            snapshot.phase === "playing" ? "touch-none" : "touch-auto"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStart.current = null;
            swipeHandled.current = false;
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Игровое поле. Собери число, которое является ответом на пример."
          />

          {snapshot.phase === "ready" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#08120d]/50 p-2.5 sm:p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="start-title"
                className="overlay-card overlay-in hide-scrollbar relative max-h-full w-full max-w-[390px] overflow-y-auto rounded-[21px] bg-paper p-3.5 text-ink sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-ink/55 sm:text-[10px]">
                    <span className="h-2 w-2 rounded-full bg-ink" />
                    Аркада для ума
                  </div>
                  <div className="flex h-7 w-7 -rotate-6 items-center justify-center rounded-lg border border-ink bg-acid font-display text-sm shadow-[2px_2px_0_#132019]">
                    π
                  </div>
                </div>

                <h2
                  id="start-title"
                  className="mt-2.5 font-display text-[clamp(1.48rem,5.8vw,2.15rem)] leading-[1.04] tracking-[-0.055em] sm:mt-3"
                >
                  Съешь
                  <br />
                  правильный ответ.
                </h2>
                <p className="mt-2 max-w-[20rem] text-[12px] font-medium leading-relaxed text-ink/65 sm:text-[13px]">
                  Реши пример на табло и направь змейку к ответу. Каждые 4 верных ответа
                  ускоряют игру. Ошибка или столкновение отнимают сердце.
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-ink/65">
                    <Heart className="h-2.5 w-2.5 fill-coral text-coral" /> 3 жизни
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-ink/65">
                    <Trophy className="h-2.5 w-2.5 text-ink/60" /> топ-5
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-ink/65">
                    <Flame className="h-2.5 w-2.5 text-coral" /> серии
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onStart}
                  className="group mt-3.5 flex w-full items-center justify-between gap-3 rounded-[13px] bg-ink px-4 py-3.5 text-left text-paper shadow-[0_4px_0_#07100b] transition hover:bg-[#22392b] active:translate-y-0.5 active:shadow-[0_2px_0_#07100b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="font-display text-[13px] tracking-[-0.03em]">Начать игру</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-acid text-ink transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>

                <div className="mt-2.5 flex items-center justify-between gap-2 text-[9px] font-bold text-ink/45 sm:text-[10px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="rounded border border-ink/25 border-b-2 bg-white px-1 py-0.5 font-extrabold text-ink/70">
                      Enter
                    </span>
                    или кнопка
                  </span>
                  <span className="hidden sm:inline">свайп / стрелки / D-pad</span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[9px] font-medium text-ink/65">
                  <span className="truncate">
                    Автор: учитель инф. и мат. <span className="font-bold text-ink">Рычкова Екатерина</span> (2026 г.)
                  </span>
                  <a
                    href="https://m.vk.ru/katyrychkova_stem"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-bold text-ink hover:underline"
                    aria-label="ВК автора: Рычкова Екатерина (откроется в новой вкладке)"
                  >
                    <span>ВК</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {snapshot.phase === "paused" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#08120d]/72 p-3 backdrop-blur-[3px] sm:p-5">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pause-title"
                className="overlay-card overlay-in w-full max-w-[330px] rounded-[20px] bg-paper p-5 text-ink"
              >
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink/50">
                  <span className="h-2 w-2 rounded-full bg-coral" />
                  Не спеши
                </div>
                <h2
                  id="pause-title"
                  className="mt-1.5 font-display text-[clamp(1.75rem,6vw,2.15rem)] leading-none tracking-[-0.06em]"
                >
                  Пауза
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-ink/10 bg-white/65 p-2.5">
                  <div>
                    <div className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-ink/40">
                      Счёт
                    </div>
                    <div className="font-display text-sm">{formatScore(snapshot.score)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-ink/40">
                      Уровень
                    </div>
                    <div className="font-display text-sm">{snapshot.level}</div>
                  </div>
                  <div>
                    <div className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-ink/40">
                      Серия
                    </div>
                    <div className="font-display text-sm">×{snapshot.combo}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onResume}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-display text-xs text-paper shadow-[0_4px_0_#07100b] transition hover:bg-[#22392b] active:translate-y-0.5 active:shadow-[0_2px_0_#07100b]"
                >
                  <Play className="h-4 w-4 fill-acid text-acid" />
                  Продолжить
                </button>
                <div className="mt-2.5 flex items-center justify-between text-[9px] font-bold text-ink/45">
                  <button
                    type="button"
                    onClick={onRestart}
                    className="inline-flex items-center gap-1 transition hover:text-ink"
                  >
                    <RotateCcw className="h-3 w-3" /> Заново
                  </button>
                  <span>P / Esc — продолжить</span>
                </div>
              </div>
            </div>
          )}

          {snapshot.phase === "over" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#08120d]/74 p-2.5 backdrop-blur-[3px] sm:p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="gameover-title"
                className="overlay-card overlay-in hide-scrollbar max-h-full w-full max-w-[410px] overflow-y-auto rounded-[20px] bg-paper p-4 text-ink sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.17em] text-ink/50 sm:text-[10px]">
                    <span className="h-2 w-2 rounded-full bg-coral" />
                    Раунд завершён
                  </div>
                  {isNewRecord ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-acid">
                      <Trophy className="h-2.5 w-2.5" /> новый рекорд
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-ink/35">
                      {latestEntry ? "в топ-5" : `до топ-5: ${missedTop}`}
                    </span>
                  )}
                </div>

                <h2
                  id="gameover-title"
                  className="mt-1.5 font-display text-[clamp(1.2rem,4.6vw,1.65rem)] leading-[1.1] tracking-[-0.055em]"
                >
                  {lastResult ? reasonCopy[lastResult.reason].title : "Игра окончена."}
                </h2>
                {lastResult && (
                  <p className="mt-1 text-[10px] font-semibold leading-snug text-ink/50 sm:text-[11px]">
                    {reasonCopy[lastResult.reason].description}
                  </p>
                )}

                <div className="mt-2.5 flex items-end gap-3">
                  <div>
                    <div className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-ink/40">
                      итоговый счёт
                    </div>
                    <div className="font-display text-[34px] leading-none tracking-[-0.07em] sm:text-[40px]">
                      {formatScore(snapshot.score)}
                    </div>
                  </div>
                  <div className="mb-0.5 grid flex-1 grid-cols-3 gap-1.5">
                    <div className="rounded-lg border border-ink/10 bg-white/70 px-1.5 py-1.5">
                      <div className="font-display text-xs">{snapshot.correct}</div>
                      <div className="text-[7px] font-bold uppercase tracking-[0.06em] text-ink/40">
                        верных
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink/10 bg-white/70 px-1.5 py-1.5">
                      <div className="font-display text-xs">{snapshot.level}</div>
                      <div className="text-[7px] font-bold uppercase tracking-[0.06em] text-ink/40">
                        уровень
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink/10 bg-white/70 px-1.5 py-1.5">
                      <div className="font-display text-xs">×{snapshot.bestCombo}</div>
                      <div className="text-[7px] font-bold uppercase tracking-[0.06em] text-ink/40">
                        серия
                      </div>
                    </div>
                  </div>
                </div>

                {latestEntry && (
                  <label className="mt-3 flex items-center gap-2 rounded-xl border border-ink/12 bg-acid/24 px-2.5 py-2">
                    <span className="shrink-0 text-[8px] font-extrabold uppercase leading-tight tracking-[0.1em] text-ink/55">
                      Имя
                      <br />
                      в топ-5
                    </span>
                    <input
                      value={playerName}
                      onChange={(event) => onNameChange(event.target.value)}
                      onKeyDown={(event) => event.stopPropagation()}
                      maxLength={12}
                      placeholder="Игрок"
                      aria-label="Имя для таблицы рекордов"
                      className="min-w-0 flex-1 select-text rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                    />
                    <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-ink/35">
                      сохранено
                    </span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={onRestart}
                  className="group mt-3 flex w-full items-center justify-between gap-3 rounded-[13px] bg-ink px-4 py-3 text-left text-paper shadow-[0_4px_0_#07100b] transition hover:bg-[#22392b] active:translate-y-0.5 active:shadow-[0_2px_0_#07100b]"
                >
                  <span className="font-display text-[12px] tracking-[-0.03em]">Ещё раунд</span>
                  <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">
                    Enter
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-acid text-ink transition-transform group-hover:translate-x-0.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>

                <div className="mt-2.5 flex items-center justify-between gap-2 text-[9px] font-bold text-ink/40">
                  <button
                    type="button"
                    onClick={onHome}
                    className="inline-flex items-center gap-1 transition hover:text-ink"
                  >
                    <Home className="h-3 w-3" /> На главную
                  </button>
                  <span>R / Enter — сразу ещё раз</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[16px] border border-white/8 bg-white/[0.035] px-3 py-2 sm:mt-3 sm:gap-4 sm:px-3.5">
          <div className="hidden min-w-0 sm:block">
            <div className="text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/35">
              Управление
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="keycap">←</span>
              <span className="keycap">↑</span>
              <span className="keycap">↓</span>
              <span className="keycap">→</span>
              <span className="mx-1 text-[9px] font-bold text-white/30">или</span>
              <span className="keycap">WASD</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-white/35">
              <span className="keycap">P</span>
              пауза
              <span className="ml-1.5 keycap">R</span>
              заново
            </div>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:hidden">
            <div className="max-w-[130px]">
              <div className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/35">
                Свайп по полю
              </div>
              <div className="mt-1 text-[10px] font-semibold leading-snug text-white/48">
                или кнопки справа
              </div>
              <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-white/30">
                <span className="keycap">WASD</span> тоже работают
              </div>
            </div>
            <DirectionPad onTurn={onTurn} />
          </div>

          <div className="hidden flex-1 items-center justify-end gap-3 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-acid/20 bg-acid/10">
              <Heart className="h-3.5 w-3.5 fill-acid text-acid" />
            </div>
            <div>
              <div className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-white/35">
                серия ×5
              </div>
              <div className="text-[10px] font-semibold text-white/55">вернёт сердце</div>
            </div>
            <span className="h-7 w-px bg-white/10" />
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/38">
              свайп · можно
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
