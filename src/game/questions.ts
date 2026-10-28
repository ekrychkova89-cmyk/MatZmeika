export interface Question {
  id: number;
  text: string;
  answer: number;
}

let questionId = 0;

const randInt = (min: number, max: number, rng: () => number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const pick = <T,>(items: T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)];

interface RawQuestion {
  text: string;
  answer: number;
}

function simpleQuestion(level: number, rng: () => number): RawQuestion {
  const operators = level <= 1 ? ["+", "−", "×"] : ["+", "−", "×", "÷"];
  const operator = pick(operators, rng);

  if (operator === "+") {
    const maxSum = Math.min(12 + level * 6, 99);
    const a = randInt(3, Math.min(9 + level * 3, maxSum - 2), rng);
    const b = randInt(2, Math.max(3, maxSum - a), rng);
    return { text: `${a} + ${b}`, answer: a + b };
  }

  if (operator === "−") {
    const ceiling = Math.min(10 + level * 6, 90);
    const a = randInt(7, ceiling, rng);
    const b = randInt(2, a - 2, rng);
    return { text: `${a} − ${b}`, answer: a - b };
  }

  if (operator === "×") {
    const factorA = randInt(2, Math.min(2 + level, 9), rng);
    const factorB = randInt(2, Math.min(2 + level, 9), rng);
    return { text: `${factorA} × ${factorB}`, answer: factorA * factorB };
  }

  const divisor = randInt(2, Math.min(3 + level, 9), rng);
  const answer = randInt(2, Math.min(3 + level, 9), rng);
  return { text: `${divisor * answer} ÷ ${divisor}`, answer };
}

function compoundQuestion(level: number, rng: () => number): RawQuestion {
  const style = randInt(0, 2, rng);

  if (style === 0) {
    const a = randInt(2, Math.min(4 + level, 8), rng);
    const b = randInt(2, 6, rng);
    const c = randInt(2, 9, rng);
    return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
  }

  if (style === 1) {
    const a = randInt(3, 9, rng);
    const b = randInt(2, Math.min(3 + level, 8), rng);
    const subtrahend = randInt(1, a * b - 2, rng);
    return { text: `${a} × ${b} − ${subtrahend}`, answer: a * b - subtrahend };
  }

  const a = randInt(2, 8, rng);
  const b = randInt(2, Math.min(4 + level, 9), rng);
  const c = randInt(2, Math.min(3 + level, 9), rng);
  return { text: `${a} + ${b} × ${c}`, answer: a + b * c };
}

export function generateQuestion(level: number, rng: () => number = Math.random): Question {
  const useCompound = level >= 4 && rng() < Math.min(0.22 + level * 0.035, 0.52);
  const raw = useCompound ? compoundQuestion(level, rng) : simpleQuestion(level, rng);
  questionId += 1;
  return { id: questionId, text: raw.text, answer: raw.answer };
}

export function makeChoices(
  question: Question,
  level: number,
  rng: () => number = Math.random
): number[] {
  const distractorCount = level <= 2 ? 2 : level <= 5 ? 3 : 4;
  const correct = question.answer;
  const offsets = [1, -1, 2, -2, 3, -3, 10, -10, 11, -11];
  const candidates: number[] = [];

  for (const offset of offsets.sort(() => rng() - 0.5)) {
    const candidate = correct + offset;
    if (candidate > 0 && candidate <= 144) candidates.push(candidate);
  }

  while (candidates.length < distractorCount + 4) {
    const candidate = randInt(1, Math.max(18, correct + 12), rng);
    if (candidate !== correct) candidates.push(candidate);
  }

  const unique: number[] = [];
  for (const candidate of candidates) {
    if (candidate !== correct && !unique.includes(candidate)) unique.push(candidate);
    if (unique.length === distractorCount) break;
  }

  const choices = [correct, ...unique];
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
