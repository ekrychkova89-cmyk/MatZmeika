import { generateQuestion, makeChoices, type Question } from "./questions";

export const GRID_SIZE = 11;

export type Phase = "ready" | "playing" | "paused" | "over";
export type TurnDirection = "up" | "down" | "left" | "right";
export type GameOverReason = "wall" | "self" | "mistakes";
export type GameEvent = "start" | "correct" | "wrong" | "level" | "over" | "pause" | "resume";

export interface GameSnapshot {
  phase: Phase;
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  level: number;
  correct: number;
  question: Question;
  nextLevelIn: number;
  speed: number;
}

export interface RunResult {
  score: number;
  level: number;
  correct: number;
  bestCombo: number;
  reason: GameOverReason;
}

interface Point {
  x: number;
  y: number;
}

interface Orb extends Point {
  value: number;
  correct: boolean;
  bornAt: number;
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "dot" | "glyph" | "ring";
  glyph?: string;
  rotation: number;
  spin: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface EngineCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEvent: (event: GameEvent) => void;
  onGameOver: (result: RunResult) => void;
}

const DIRECTION_VECTORS: Record<TurnDirection, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const INITIAL_SNAKE: Point[] = [
  { x: 3, y: 8 },
  { x: 2, y: 8 },
  { x: 1, y: 8 },
  { x: 0, y: 8 },
];

const palette = {
  board: "#14231d",
  acid: "#c9f75a",
  acidSoft: "#e6ff9f",
  coral: "#ff7a58",
  mint: "#86e8c5",
  periwinkle: "#bcc8ff",
  cream: "#fff9e8",
  ink: "#0a1610",
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const easeOutBack = (value: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const clamped = clamp(value, 0, 1);
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

const initialQuestion = (): Question => ({ id: 0, text: "3 + 4", answer: 7 });

export function createInitialSnapshot(): GameSnapshot {
  return {
    phase: "ready",
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 3,
    level: 1,
    correct: 0,
    question: initialQuestion(),
    nextLevelIn: 4,
    speed: 1,
  };
}

export class SnakeEngine {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame = 0;
  private lastFrameTime = 0;
  private time = 0;

  private phase: Phase = "ready";
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private lives = 3;
  private level = 1;
  private correct = 0;
  private question: Question = initialQuestion();
  private snake: Point[] = INITIAL_SNAKE.map((point) => ({ ...point }));
  private previousSnake: Point[] = INITIAL_SNAKE.map((point) => ({ ...point }));
  private orbs: Orb[] = [];
  private direction: Point = { x: 1, y: 0 };
  private queue: Point[] = [];
  private accumulator = 0;
  private thinkPause = 0;
  private stepInterval = 205;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private shake = 0;
  private flashAlpha = 0;
  private flashColor = palette.coral;
  private reducedMotion = false;
  private width = 0;
  private height = 0;
  private gameOverReason: GameOverReason = "wall";
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is not available in this browser.");
    this.context = context;
    this.callbacks = callbacks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    this.prepareRound();
    this.phase = "ready";
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.animationFrame = requestAnimationFrame(this.frame);
    this.emit();
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      bestCombo: this.bestCombo,
      lives: this.lives,
      level: this.level,
      correct: this.correct,
      question: this.question,
      nextLevelIn: 4 - (this.correct % 4),
      speed: Math.round((1000 / this.stepInterval) * 10) / 10,
    };
  }

  start() {
    this.prepareRound();
    this.phase = "playing";
    this.accumulator = 0;
    this.emit();
    this.callbacks.onEvent("start");
  }

  restart() {
    this.start();
  }

  getDebugState() {
    return {
      phase: this.phase,
      question: this.question.text,
      answer: this.question.answer,
      orbs: this.orbs.map((orb) => ({ x: orb.x, y: orb.y, value: orb.value, correct: orb.correct })),
      snake: this.snake.map((segment) => ({ ...segment })),
      direction: { ...this.direction },
      result: {
        phase: this.phase,
        score: this.score,
        lives: this.lives,
        level: this.level,
      },
    };
  }

  goHome() {
    this.prepareRound();
    this.phase = "ready";
    this.accumulator = 0;
    this.emit();
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.emit();
    this.callbacks.onEvent("pause");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.accumulator = 0;
    this.emit();
    this.callbacks.onEvent("resume");
  }

  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  turn(direction: TurnDirection) {
    if (this.phase !== "playing") return;
    const vector = DIRECTION_VECTORS[direction];
    const reference = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;

    if (reference.x === vector.x && reference.y === vector.y) return;
    if (reference.x + vector.x === 0 && reference.y + vector.y === 0) return;
    if (this.queue.length >= 2) return;
    this.queue.push(vector);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private prepareRound() {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lives = 3;
    this.level = 1;
    this.correct = 0;
    this.snake = INITIAL_SNAKE.map((point) => ({ ...point }));
    this.previousSnake = INITIAL_SNAKE.map((point) => ({ ...point }));
    this.direction = { x: 1, y: 0 };
    this.queue = [];
    this.accumulator = 0;
    this.thinkPause = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.shake = 0;
    this.flashAlpha = 0;
    // A guaranteed, friendly first equation keeps the opening beat quick.
    this.question = initialQuestion();
    this.refreshSpeed();
    this.spawnOrbs(true);
  }

  private refreshSpeed() {
    this.stepInterval = Math.max(
      88,
      205 - (this.level - 1) * 9 - Math.min(this.correct, 24) * 0.35
    );
  }

  private emit() {
    this.callbacks.onSnapshot(this.getSnapshot());
  }

  private frame = (timestamp: number) => {
    if (this.destroyed) return;
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const delta = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;
    if (this.phase !== "paused") this.time += delta;

    if (this.phase === "playing") {
      if (this.thinkPause > 0) {
        this.thinkPause = Math.max(0, this.thinkPause - delta);
      } else {
        this.accumulator += delta * 1000;
      }
      let safety = 0;
      while (this.accumulator >= this.stepInterval && safety < 4) {
        this.accumulator -= this.stepInterval;
        this.step();
        safety += 1;
        if (this.phase !== "playing") break;
      }
    }

    if (this.phase !== "paused") {
      this.updateEffects(delta);
    } else {
      this.shake *= Math.exp(-delta * 12);
      this.flashAlpha *= Math.exp(-delta * 8);
    }

    this.render(timestamp);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private step() {
    while (this.queue.length) {
      const candidate = this.queue.shift();
      if (!candidate) break;
      if (candidate.x + this.direction.x === 0 && candidate.y + this.direction.y === 0) continue;
      this.direction = candidate;
      break;
    }

    this.previousSnake = this.snake.map((point) => ({ ...point }));
    const head = this.snake[0];
    let next = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    if (this.isOutside(next)) {
      this.hitHazard(
        "wall",
        { x: clamp(next.x, 0, GRID_SIZE - 1), y: clamp(next.y, 0, GRID_SIZE - 1) }
      );
      return;
    }

    const hitsBody = this.snake
      .slice(0, Math.max(0, this.snake.length - 1))
      .some((segment) => segment.x === next.x && segment.y === next.y);

    if (hitsBody) {
      this.hitHazard("self", next);
      return;
    }

    this.snake.unshift(next);
    const collectedOrb = this.orbs.find((orb) => orb.x === next.x && orb.y === next.y);

    if (collectedOrb?.correct) {
      this.collectCorrect(collectedOrb);
    } else if (collectedOrb) {
      this.snake.pop();
      this.collectWrong(collectedOrb);
    } else {
      this.snake.pop();
    }
  }

  private isOutside(cell: Point) {
    return cell.x < 0 || cell.y < 0 || cell.x >= GRID_SIZE || cell.y >= GRID_SIZE;
  }

  private hitHazard(reason: "wall" | "self", collisionCell: Point) {
    this.lives -= 1;
    this.combo = 0;
    this.queue = [];
    this.burst(
      clamp(collisionCell.x + 0.5, 0.3, GRID_SIZE - 0.3),
      clamp(collisionCell.y + 0.5, 0.3, GRID_SIZE - 0.3),
      26,
      palette.coral,
      true
    );
    this.floatingTexts.push({
      x: clamp(collisionCell.x + 0.5, 1, GRID_SIZE - 1),
      y: clamp(collisionCell.y, 1, GRID_SIZE - 1),
      text: "−1 ♥",
      color: palette.coral,
      life: 1.15,
      maxLife: 1.15,
      size: 0.58,
    });
    this.shake = Math.min(24, this.shake + 16);
    this.flashColor = palette.coral;
    this.flashAlpha = 0.22;
    this.callbacks.onEvent("wrong");

    if (this.lives <= 0) {
      this.finish(reason, collisionCell);
      return;
    }

    this.respawnSnake();
    this.thinkPause = 0.55;
    this.emit();
  }

  private respawnSnake() {
    const occupiedByOrb = (x: number, y: number) =>
      this.orbs.some((orb) => orb.x === x && orb.y === y);

    let spawnRow = Math.floor(GRID_SIZE / 2);
    let spawnHeadX = 3;

    outer: for (let offset = 0; offset < GRID_SIZE; offset += 1) {
      for (const y of [spawnRow + offset, spawnRow - offset]) {
        if (y < 1 || y >= GRID_SIZE) continue;
        for (let x = 3; x < GRID_SIZE - 2; x += 1) {
          const cells = [x, x - 1, x - 2, x - 3, x + 1, x + 2];
          if (cells.every((cellX) => !occupiedByOrb(cellX, y))) {
            spawnRow = y;
            spawnHeadX = x;
            break outer;
          }
        }
      }
    }

    this.snake = [0, 1, 2, 3].map((index) => ({
      x: spawnHeadX - index,
      y: spawnRow,
    }));
    this.previousSnake = this.snake.map((segment) => ({ ...segment }));
    this.direction = { x: 1, y: 0 };
    this.accumulator = 0;
  }

  private collectCorrect(orb: Orb) {
    this.combo += 1;
    this.correct += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const nextLevel = 1 + Math.floor(this.correct / 4);
    const leveledUp = nextLevel > this.level;
    this.level = nextLevel;
    const gain = 100 + Math.min(this.combo - 1, 10) * 25 + (this.level - 1) * 10;
    this.score += gain;

    if (this.combo % 5 === 0 && this.lives < 3) {
      this.lives += 1;
      this.floatingTexts.push({
        x: orb.x + 0.5,
        y: orb.y + 0.1,
        text: "+1 ♥",
        color: palette.mint,
        life: 1.2,
        maxLife: 1.2,
        size: 0.54,
      });
    }

    this.refreshSpeed();
    this.burst(orb.x + 0.5, orb.y + 0.5, leveledUp ? 34 : 22, palette.acid);
    this.floatingTexts.push({
      x: orb.x + 0.5,
      y: orb.y,
      text: `+${gain}`,
      color: palette.acidSoft,
      life: 1.05,
      maxLife: 1.05,
      size: 0.64,
    });
    if (this.combo >= 2) {
      this.floatingTexts.push({
        x: orb.x + 0.5,
        y: orb.y + 0.75,
        text: `СЕРИЯ ×${this.combo}`,
        color: palette.cream,
        life: 1.1,
        maxLife: 1.1,
        size: 0.34,
      });
    }

    this.shake = Math.min(16, this.shake + (leveledUp ? 11 : 5));
    this.flashColor = palette.acid;
    this.flashAlpha = Math.max(this.flashAlpha, leveledUp ? 0.16 : 0.07);

    this.callbacks.onEvent("correct");
    if (leveledUp) {
      this.shake = Math.min(20, this.shake + 7);
      this.burst(orb.x + 0.5, orb.y + 0.5, 22, palette.periwinkle);
      this.callbacks.onEvent("level");
    }

    this.thinkPause = 0.42;
    this.question = generateQuestion(this.level);
    this.spawnOrbs();
    this.emit();
  }

  private collectWrong(orb: Orb) {
    this.lives -= 1;
    this.combo = 0;
    this.orbs = this.orbs.filter((item) => item !== orb);
    this.snake = this.snake.slice(0, Math.max(4, this.snake.length - 2));

    this.burst(orb.x + 0.5, orb.y + 0.5, 24, palette.coral, true);
    this.floatingTexts.push({
      x: orb.x + 0.5,
      y: orb.y,
      text: "−1 ♥",
      color: palette.coral,
      life: 1.1,
      maxLife: 1.1,
      size: 0.58,
    });
    this.floatingTexts.push({
      x: orb.x + 0.5,
      y: orb.y + 0.72,
      text: "СЕРИЯ СБРОШЕНА",
      color: palette.cream,
      life: 1.15,
      maxLife: 1.15,
      size: 0.29,
    });
    this.shake = Math.min(22, this.shake + 14);
    this.flashColor = palette.coral;
    this.flashAlpha = 0.2;
    this.callbacks.onEvent("wrong");

    if (this.lives <= 0) {
      this.finish("mistakes", orb);
      return;
    }

    this.thinkPause = 0.62;
    this.addReplacementOrb();
    this.emit();
  }

  private finish(reason: GameOverReason, collisionCell: Point) {
    if (this.phase === "over") return;
    this.phase = "over";
    this.gameOverReason = reason;
    this.queue = [];
    this.burst(collisionCell.x + 0.5, collisionCell.y + 0.5, 30, palette.coral, true);
    this.floatingTexts.push({
      x: clamp(collisionCell.x + 0.5, 1, GRID_SIZE - 1),
      y: clamp(collisionCell.y, 1, GRID_SIZE - 1),
      text: reason === "mistakes" ? "0 ♥" : "×",
      color: palette.coral,
      life: 1.4,
      maxLife: 1.4,
      size: 0.76,
    });
    this.shake = Math.min(24, this.shake + 20);
    this.flashColor = palette.coral;
    this.flashAlpha = 0.28;
    this.emit();
    this.callbacks.onEvent("over");
    this.callbacks.onGameOver({
      score: this.score,
      level: this.level,
      correct: this.correct,
      bestCombo: this.bestCombo,
      reason: this.gameOverReason,
    });
  }

  private spawnOrbs(firstQuestion = false) {
    this.orbs = [];
    const choices = makeChoices(this.question, this.level);
    const free: Point[] = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (this.snake.some((segment) => segment.x === x && segment.y === y)) continue;
        free.push({ x, y });
      }
    }

    const head = this.snake[0];
    const laneLength = firstQuestion ? 6 : 3;
    const inHeadLane = (cell: Point) => {
      const dx = cell.x - head.x;
      const dy = cell.y - head.y;
      const along = dx * this.direction.x + dy * this.direction.y;
      const lateral = Math.abs(dx * this.direction.y - dy * this.direction.x);
      return along > 0 && along <= laneLength && lateral === 0;
    };
    const correctValue = this.question.answer;
    let correctPosition: Point | undefined;

    if (firstQuestion) {
      const targetX = clamp(head.x + 5, 0, GRID_SIZE - 1);
      if (!this.snake.some((segment) => segment.x === targetX && segment.y === head.y)) {
        correctPosition = { x: targetX, y: head.y };
      }
    }

    if (!correctPosition) {
      const distant = free.filter(
        (cell) =>
          Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) >= 3 &&
          !inHeadLane(cell) &&
          !this.orbs.some((orb) => orb.x === cell.x && orb.y === cell.y)
      );
      const pool = distant.length ? distant : free.filter((cell) => !inHeadLane(cell));
      const fallbackPool = pool.length ? pool : free;
      correctPosition = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || { x: 1, y: 1 };
    }

    this.orbs.push(this.makeOrb(correctPosition, correctValue, true));
    const occupied = new Set<string>([`${correctPosition.x},${correctPosition.y}`]);
    const distractors = choices.filter((value) => value !== correctValue);

    distractors.forEach((value, index) => {
      let position: Point | undefined;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const candidate =
          free[Math.floor(Math.random() * free.length)] || { x: 1 + index, y: 2 };
        const key = `${candidate.x},${candidate.y}`;
        const distanceFromHead =
          Math.abs(candidate.x - head.x) + Math.abs(candidate.y - head.y);
        const tooCloseToOrb = [...occupied].some((occupiedKey) => {
          const [x, y] = occupiedKey.split(",").map(Number);
          return Math.abs(candidate.x - x) + Math.abs(candidate.y - y) < 2;
        });
        if (!occupied.has(key) && distanceFromHead >= 3 && !tooCloseToOrb && !inHeadLane(candidate)) {
          position = candidate;
          break;
        }
      }
      if (!position) position = free.find((cell) => !occupied.has(`${cell.x},${cell.y}`)) || free[0];
      if (!position) return;
      occupied.add(`${position.x},${position.y}`);
      this.orbs.push(this.makeOrb(position, value, false));
    });
  }

  private addReplacementOrb() {
    const head = this.snake[0];
    const existing = new Set(this.orbs.map((orb) => orb.value));
    const inHeadLane = (cell: Point) => {
      const dx = cell.x - head.x;
      const dy = cell.y - head.y;
      const along = dx * this.direction.x + dy * this.direction.y;
      const lateral = Math.abs(dx * this.direction.y - dy * this.direction.x);
      return along > 0 && along <= 3 && lateral === 0;
    };
    let value = this.question.answer;
    while (value === this.question.answer || existing.has(value)) {
      value = Math.max(1, Math.round(this.question.answer + rand(-9, 9)));
      if (Math.random() > 0.82) value += 10;
    }

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const cell = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = this.snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
      const onOrb = this.orbs.some((orb) => orb.x === cell.x && orb.y === cell.y);
      const farEnough = Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) >= 2;
      if (!onSnake && !onOrb && farEnough && !inHeadLane(cell)) {
        this.orbs.push(this.makeOrb(cell, value, false));
        return;
      }
    }
  }

  private makeOrb(position: Point, value: number, correct: boolean): Orb {
    return {
      x: position.x,
      y: position.y,
      value,
      correct,
      bornAt: performance.now(),
      seed: Math.random() * Math.PI * 2,
    };
  }

  private burst(x: number, y: number, amount: number, primary: string, danger = false) {
    const count = this.reducedMotion ? Math.ceil(amount * 0.35) : amount;
    const glyphs = ["+", "−", "×", "÷", "=", "π"];
    const colors = danger
      ? [palette.coral, "#ffb199", palette.cream, "#ff9b82"]
      : [primary, palette.cream, palette.mint, palette.periwinkle, palette.acidSoft];

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(1.4, danger ? 6.4 : 5.2);
      const isGlyph = Math.random() > 0.66;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0.2, 1.8),
        life: rand(0.48, 1.05),
        maxLife: 1,
        size: isGlyph ? rand(0.28, 0.52) : rand(0.07, 0.19),
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: isGlyph ? "glyph" : "dot",
        glyph: isGlyph ? glyphs[Math.floor(Math.random() * glyphs.length)] : undefined,
        rotation: rand(-0.4, 0.4),
        spin: rand(-4, 4),
      });
    }

    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.36,
      maxLife: 0.36,
      size: 0.3,
      color: primary,
      kind: "ring",
      rotation: 0,
      spin: 0,
    });

    if (this.particles.length > 190) {
      this.particles.splice(0, this.particles.length - 190);
    }
  }

  private updateEffects(delta: number) {
    const drag = Math.pow(0.08, delta);
    this.particles = this.particles.filter((particle) => {
      particle.life -= delta;
      if (particle.life <= 0) return false;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= drag;
      particle.vy = particle.vy * drag + 2.6 * delta;
      particle.rotation += particle.spin * delta;
      return true;
    });

    this.floatingTexts = this.floatingTexts.filter((floating) => {
      floating.life -= delta;
      floating.y -= delta * 1.15;
      return floating.life > 0;
    });

    this.shake *= Math.exp(-delta * 7.2);
    if (this.shake < 0.15) this.shake = 0;
    this.flashAlpha *= Math.exp(-delta * 6.4);
    if (this.flashAlpha < 0.003) this.flashAlpha = 0;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }
    this.width = rect.width;
    this.height = rect.height;
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private render(timestamp: number) {
    const context = this.context;
    if (!this.width || !this.height) return;

    const cell = Math.min(this.width, this.height) / GRID_SIZE;
    const originX = (this.width - cell * GRID_SIZE) / 2;
    const originY = (this.height - cell * GRID_SIZE) / 2;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    context.fillStyle = palette.board;
    context.fillRect(0, 0, this.width, this.height);

    const boardGlow = context.createRadialGradient(
      centerX,
      centerY * 0.72,
      cell,
      centerX,
      centerY,
      cell * 10
    );
    boardGlow.addColorStop(0, "rgba(50, 92, 70, 0.31)");
    boardGlow.addColorStop(0.65, "rgba(20, 35, 29, 0.12)");
    boardGlow.addColorStop(1, "rgba(5, 12, 9, 0.34)");
    context.fillStyle = boardGlow;
    context.fillRect(0, 0, this.width, this.height);

    this.drawGrid(cell, originX, originY);

    const shakeX = this.shake ? Math.sin(timestamp * 0.083) * this.shake : 0;
    const shakeY = this.shake ? Math.cos(timestamp * 0.071) * this.shake * 0.8 : 0;

    context.save();
    context.translate(shakeX, shakeY);

    this.drawAmbientGlyphs(cell, originX, originY);
    this.orbs.forEach((orb, index) => this.drawOrb(orb, index, timestamp, cell, originX, originY));
    const progress =
      this.phase === "playing" ? clamp(this.accumulator / this.stepInterval, 0, 1) : 1;
    this.drawSnake(progress, cell, originX, originY);
    this.drawParticles(cell, originX, originY);
    this.drawFloatingTexts(cell, originX, originY);

    context.restore();
    this.drawBoardEdge(cell, originX, originY);

    if (this.flashAlpha > 0) {
      context.globalAlpha = this.flashAlpha;
      context.fillStyle = this.flashColor;
      context.fillRect(0, 0, this.width, this.height);
      context.globalAlpha = 1;
    }
  }

  private drawGrid(cell: number, originX: number, originY: number) {
    const context = this.context;
    context.save();
    context.translate(originX, originY);
    context.lineWidth = 1;

    for (let i = 1; i < GRID_SIZE; i += 1) {
      const coordinate = i * cell + 0.5;
      context.strokeStyle = i % 5 === 0 ? "rgba(205, 238, 212, 0.1)" : "rgba(205, 238, 212, 0.052)";
      context.beginPath();
      context.moveTo(coordinate, 0);
      context.lineTo(coordinate, GRID_SIZE * cell);
      context.stroke();
      context.beginPath();
      context.moveTo(0, coordinate);
      context.lineTo(GRID_SIZE * cell, coordinate);
      context.stroke();
    }

    context.fillStyle = "rgba(220, 246, 221, 0.13)";
    for (let y = 2; y < GRID_SIZE; y += 5) {
      for (let x = 2; x < GRID_SIZE; x += 5) {
        context.beginPath();
        context.arc(x * cell, y * cell, 1.1, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.setLineDash([cell * 0.18, cell * 0.22]);
    context.strokeStyle = "rgba(201, 247, 90, 0.09)";
    context.lineWidth = 1.5;
    context.strokeRect(
      cell * 0.23,
      cell * 0.23,
      cell * (GRID_SIZE - 0.46),
      cell * (GRID_SIZE - 0.46)
    );
    context.setLineDash([]);
    context.restore();
  }

  private drawAmbientGlyphs(cell: number, originX: number, originY: number) {
    const context = this.context;
    const glyphs: Array<[number, number, string]> = [
      [1.4, 1.6, "π"],
      [9.55, 1.35, "∑"],
      [9.4, 9.6, "√"],
      [1.45, 9.4, "∞"],
      [5.55, 1.8, "÷"],
      [3.1, 8.7, "×"],
      [7.9, 5.15, "≈"],
    ];
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    glyphs.forEach(([x, y, glyph], index) => {
      context.font = `${cell * 0.76}px Georgia, serif`;
      const pulse = 0.045 + (Math.sin(this.time * 0.75 + index) + 1) * 0.012;
      context.fillStyle = `rgba(210, 240, 210, ${pulse})`;
      context.fillText(glyph, originX + x * cell, originY + y * cell);
    });
    context.restore();
  }

  private drawOrb(
    orb: Orb,
    index: number,
    timestamp: number,
    cell: number,
    originX: number,
    originY: number
  ) {
    const context = this.context;
    const age = timestamp - orb.bornAt;
    const spawn = easeOutBack(clamp(age / 280, 0, 1));
    const bob = Math.sin(this.time * 2 + orb.seed) * cell * 0.045;
    const x = originX + (orb.x + 0.5) * cell;
    const y = originY + (orb.y + 0.5) * cell + bob;
    const radius = cell * 0.435;
    const colors = [palette.periwinkle, palette.mint, palette.acid, "#ffbd91"];
    const ringColor = colors[index % colors.length];

    context.save();
    context.translate(x, y);
    context.scale(spawn, spawn);
    context.globalAlpha = clamp(age / 160, 0, 1);

    context.beginPath();
    context.ellipse(0, radius * 0.72, radius * 0.76, radius * 0.25, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(0, 0, 0, 0.24)";
    context.fill();

    context.beginPath();
    context.arc(0, 0, radius * 1.17, 0, Math.PI * 2);
    context.strokeStyle = ringColor;
    context.globalAlpha = 0.22;
    context.lineWidth = 1.4;
    context.stroke();
    context.globalAlpha = clamp(age / 160, 0, 1);

    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = palette.cream;
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = Math.max(1.5, cell * 0.045);
    context.stroke();

    context.beginPath();
    context.arc(-radius * 0.3, -radius * 0.34, radius * 0.17, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.8)";
    context.fill();

    const valueText = String(orb.value);
    const fontSize = cell * (valueText.length >= 3 ? 0.35 : valueText.length === 2 ? 0.46 : 0.53);
    context.fillStyle = palette.ink;
    context.font = `800 ${fontSize}px Manrope, Unbounded, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(valueText, 0, cell * 0.014);
    context.restore();
  }

  private drawSnake(progress: number, cell: number, originX: number, originY: number) {
    const context = this.context;
    if (!this.snake.length) return;

    const eased = this.phase === "playing" ? progress : 1;
    const segments = this.snake.map((segment, index) => {
      const previous = this.previousSnake[index] || segment;
      return {
        x: originX + (lerp(previous.x, segment.x, eased) + 0.5) * cell,
        y: originY + (lerp(previous.y, segment.y, eased) + 0.5) * cell,
      };
    });

    const head = segments[0];
    const tail = segments[segments.length - 1];
    const gradient = context.createLinearGradient(head.x, head.y, tail.x, tail.y);
    gradient.addColorStop(0, palette.acid);
    gradient.addColorStop(0.5, "#93d99b");
    gradient.addColorStop(1, "#5b9f8a");

    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";

    context.beginPath();
    context.moveTo(segments[0].x, segments[0].y);
    for (let i = 1; i < segments.length; i += 1) {
      context.lineTo(segments[i].x, segments[i].y);
    }
    context.strokeStyle = "rgba(201, 247, 90, 0.12)";
    context.lineWidth = cell * 1.02;
    context.stroke();

    context.strokeStyle = palette.ink;
    context.lineWidth = cell * 0.74;
    context.stroke();

    context.strokeStyle = gradient;
    context.lineWidth = cell * 0.58;
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.13)";
    context.lineWidth = cell * 0.08;
    context.stroke();

    for (let i = 2; i < segments.length; i += 2) {
      context.beginPath();
      context.arc(segments[i].x, segments[i].y, cell * 0.085, 0, Math.PI * 2);
      context.fillStyle = "rgba(11, 35, 22, 0.24)";
      context.fill();
    }

    const direction = this.phase === "ready" ? { x: 1, y: 0 } : this.direction;
    const sideX = -direction.y;
    const sideY = direction.x;
    const eyeForward = cell * 0.11;
    const eyeSide = cell * 0.135;

    context.beginPath();
    context.arc(head.x, head.y, cell * 0.365, 0, Math.PI * 2);
    context.fillStyle = palette.acid;
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = Math.max(1.7, cell * 0.055);
    context.stroke();

    for (const side of [-1, 1]) {
      const eyeX = head.x + direction.x * eyeForward + sideX * eyeSide * side;
      const eyeY = head.y + direction.y * eyeForward + sideY * eyeSide * side;
      context.beginPath();
      context.arc(eyeX, eyeY, cell * 0.095, 0, Math.PI * 2);
      context.fillStyle = palette.cream;
      context.fill();
      context.beginPath();
      context.arc(
        eyeX + direction.x * cell * 0.028,
        eyeY + direction.y * cell * 0.028,
        cell * 0.048,
        0,
        Math.PI * 2
      );
      context.fillStyle = palette.ink;
      context.fill();
    }

    context.restore();
  }

  private drawParticles(cell: number, originX: number, originY: number) {
    const context = this.context;
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      const x = originX + particle.x * cell;
      const y = originY + particle.y * cell;
      context.save();
      context.globalAlpha = alpha;
      context.translate(x, y);
      context.rotate(particle.rotation);

      if (particle.kind === "ring") {
        const ringScale = 1 + (1 - alpha) * 4.2;
        context.beginPath();
        context.arc(0, 0, cell * particle.size * ringScale, 0, Math.PI * 2);
        context.strokeStyle = particle.color;
        context.lineWidth = 2;
        context.stroke();
      } else if (particle.kind === "glyph") {
        context.fillStyle = particle.color;
        context.font = `700 ${cell * particle.size}px Unbounded, Manrope, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(particle.glyph || "+", 0, 0);
      } else {
        context.beginPath();
        context.arc(0, 0, cell * particle.size, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.fill();
      }
      context.restore();
    }
  }

  private drawFloatingTexts(cell: number, originX: number, originY: number) {
    const context = this.context;
    for (const floating of this.floatingTexts) {
      const progress = 1 - floating.life / floating.maxLife;
      const appear = easeOutCubic(clamp(progress / 0.16, 0, 1));
      const fade = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;
      context.save();
      context.globalAlpha = fade * appear;
      context.translate(originX + floating.x * cell, originY + floating.y * cell);
      context.scale(lerp(0.75, 1, appear), lerp(0.75, 1, appear));
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `700 ${cell * floating.size}px Unbounded, Manrope, sans-serif`;
      context.lineWidth = Math.max(3, cell * 0.13);
      context.strokeStyle = "rgba(8, 18, 12, 0.82)";
      context.strokeText(floating.text, 0, 0);
      context.fillStyle = floating.color;
      context.fillText(floating.text, 0, 0);
      context.restore();
    }
  }

  private drawBoardEdge(cell: number, originX: number, originY: number) {
    const context = this.context;
    const size = GRID_SIZE * cell;
    context.save();
    context.strokeStyle = "rgba(201, 247, 90, 0.22)";
    context.lineWidth = 1.5;
    const corner = cell * 0.72;
    const positions: Array<[number, number, number, number]> = [
      [originX, originY, 1, 1],
      [originX + size, originY, -1, 1],
      [originX, originY + size, 1, -1],
      [originX + size, originY + size, -1, -1],
    ];
    for (const [x, y, sx, sy] of positions) {
      context.beginPath();
      context.moveTo(x + sx * cell * 0.12, y + sy * corner);
      context.lineTo(x + sx * cell * 0.12, y + sy * cell * 0.12);
      context.lineTo(x + sx * corner, y + sy * cell * 0.12);
      context.stroke();
    }
    context.restore();
  }

  // Kept intentionally small and local: useful in dev to verify the current round state.
  debugSummary() {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      level: this.level,
      snake: this.snake.length,
      orbs: this.orbs.length,
      reason: this.gameOverReason,
    };
  }
}
