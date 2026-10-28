export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  correct: number;
  date: string | null;
  seed?: boolean;
}

const STORAGE_KEY = "matzmeika:leaderboard:v1";
const NAME_KEY = "matzmeika:player-name:v1";

const seedScores: ScoreEntry[] = [
  {
    id: "seed-euler",
    name: "Эйлер",
    score: 1240,
    level: 7,
    correct: 21,
    date: null,
    seed: true,
  },
  {
    id: "seed-ada",
    name: "Ада Л.",
    score: 860,
    level: 5,
    correct: 15,
    date: null,
    seed: true,
  },
  {
    id: "seed-gauss",
    name: "Гаусс",
    score: 540,
    level: 4,
    correct: 10,
    date: null,
    seed: true,
  },
  {
    id: "seed-fibonacci",
    name: "Фибо",
    score: 280,
    level: 2,
    correct: 6,
    date: null,
    seed: true,
  },
  {
    id: "seed-pythagoras",
    name: "Пифагор",
    score: 60,
    level: 1,
    correct: 2,
    date: null,
    seed: true,
  },
];

const cloneSeeds = () => seedScores.map((entry) => ({ ...entry }));

const isScoreEntry = (value: unknown): value is ScoreEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ScoreEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.score === "number" &&
    typeof entry.level === "number" &&
    typeof entry.correct === "number"
  );
};

export function loadScores(): ScoreEntry[] {
  if (typeof window === "undefined") return cloneSeeds();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeeds();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneSeeds();
    const entries = parsed.filter(isScoreEntry).slice(0, 5);
    return entries.length ? entries : cloneSeeds();
  } catch {
    return cloneSeeds();
  }
}

export function saveScores(scores: ScoreEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(0, 5)));
  } catch {
    // Private browsing or a full storage quota should never break the game.
  }
}

export function loadPlayerName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) || "Игрок";
  } catch {
    return "Игрок";
  }
}

export function savePlayerName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Naming is a nice-to-have; gameplay must continue regardless.
  }
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[<>]/g, "").slice(0, 12).trim();
}

export function formatRecordDate(date: string | null): string {
  if (!date) return "клубный зачёт";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "недавно";
  const today = new Date();
  const sameDay =
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear();

  if (sameDay) return "сегодня";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(parsed);
}
