import { Crown, Lock, Trophy } from "lucide-react";
import type { ScoreEntry } from "../game/scores";
import { formatRecordDate } from "../game/scores";
import { cn } from "../utils/cn";

const avatarColors = [
  "bg-acid text-ink",
  "bg-periwinkle text-ink",
  "bg-mint text-ink",
  "bg-[#ffbd91] text-ink",
  "bg-white text-ink",
];

export function Leaderboard({
  scores,
  latestEntry,
}: {
  scores: ScoreEntry[];
  latestEntry: ScoreEntry | null;
}) {
  return (
    <section
      id="records"
      className="paper-card relative scroll-mt-4 overflow-hidden p-4 sm:p-5"
      aria-labelledby="records-title"
    >
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full border border-ink/10 bg-acid/20" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink/42">
            Зал славы
          </div>
          <h2
            id="records-title"
            className="mt-0.5 font-display text-[21px] leading-none tracking-[-0.055em] text-ink sm:text-[23px]"
          >
            Рекорды
          </h2>
          <p className="mt-1.5 max-w-[15rem] text-[11px] font-medium leading-snug text-ink/48">
            Лучшие раунды на этом устройстве. Твоё имя может оказаться сверху.
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink bg-ink text-acid shadow-[2px_2px_0_rgba(19,32,25,0.18)]">
          <Trophy className="h-4 w-4" strokeWidth={2.2} />
        </div>
      </div>

      <ol className="relative mt-3 space-y-1" aria-label="Таблица рекордов">
        {scores.map((entry, index) => {
          const isYou = latestEntry?.id === entry.id;
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors duration-300",
                isYou
                  ? "border-ink bg-ink text-paper shadow-[2px_2px_0_#0b1610]"
                  : "border-transparent hover:border-ink/8 hover:bg-ink/[0.035]"
              )}
            >
              <span
                className={cn(
                  "w-5 shrink-0 text-center font-display text-[10px] tabular-nums",
                  isYou ? "text-acid" : index === 0 ? "text-ink" : "text-ink/30"
                )}
              >
                {index === 0 ? (
                  <Crown
                    className={cn("mx-auto h-3.5 w-3.5", isYou ? "text-acid" : "text-[#c0912d]")}
                    strokeWidth={2.3}
                  />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold",
                  isYou ? "border-acid/40 bg-acid text-ink" : `border-ink/10 ${avatarColors[index % avatarColors.length]}`
                )}
                aria-hidden
              >
                {entry.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-extrabold leading-tight sm:text-xs">
                    {entry.name}
                  </span>
                  {isYou && (
                    <span className="rounded-sm bg-acid px-1 py-px text-[7px] font-extrabold uppercase tracking-[0.08em] text-ink">
                      ты
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.06em]",
                    isYou ? "text-white/40" : "text-ink/35"
                  )}
                >
                  ур. {entry.level} · {formatRecordDate(entry.date)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-display text-[13px] tabular-nums tracking-[-0.04em]",
                  isYou ? "text-acid" : "text-ink"
                )}
              >
                {entry.score.toLocaleString("ru-RU")}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="relative mt-2.5 flex items-center justify-between border-t border-dashed border-ink/15 pt-2">
        <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.09em] text-ink/35">
          <Lock className="h-2.5 w-2.5" /> только этот браузер
        </span>
        <span className="font-display text-[9px] text-ink/35">ТОП-5</span>
      </div>
    </section>
  );
}
