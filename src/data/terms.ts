/**
 * IT 基礎用語の読み込み、バリデーション、ラウンド出題。
 * 既存の英単語データ（questions.json）とは別データ。
 */
import {
  TERM_CATEGORIES,
  TERM_EXPLANATION_MAX_CHARS,
  TERM_EXPLANATION_MIN_CHARS,
  TERM_LEVELS,
  TERM_TYPING_TEXT_MAX_CHARS,
  isTermCategory,
  type Term,
  type TermCategory,
  type TermLevel,
  type TermQuiz,
} from "../types/term";
import termsJson from "./terms.json";

/** 1 ラウンドの既定出題数 */
export const TERMS_PER_ROUND = 3;

const TERM_ID_PATTERN = new RegExp(`^(?:${TERM_CATEGORIES.join("|")})-\\d{3}$`);
const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;
const JAPANESE_CHAR = /[\u3040-\u30ff\u3400-\u9fff]/;

const TERM_KEYS = [
  "id",
  "category",
  "level",
  "name",
  "explanation",
  "typingText",
  "quiz",
  "related",
] as const;

const QUIZ_KEYS = ["question", "choices", "answerIndex", "explanation"] as const;

/** [0, 1) の乱数を返す関数 */
export type TermRng = () => number;

export interface SelectTermsOptions {
  /** 未指定なら全カテゴリ */
  category?: TermCategory;
  /** 既定は {@link TERMS_PER_ROUND} */
  count?: number;
  /** テストでは固定 seed の乱数を渡す */
  rng?: TermRng;
  /** 未指定なら {@link TERMS} */
  terms?: readonly Term[];
}

function fail(index: number, id: string | undefined, message: string): never {
  const label = id ?? `#${index}`;
  throw new Error(`terms.json[${index}] (${label}): ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function charCount(value: string): number {
  return [...value].length;
}

function isTermLevel(value: unknown): value is TermLevel {
  return (TERM_LEVELS as readonly unknown[]).includes(value);
}

function isAnswerIndex(value: unknown): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function assertKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  index: number,
  id: string | undefined,
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail(index, id, `unexpected property ${key}`);
  }
}

function requiredString(
  value: unknown,
  index: number,
  id: string | undefined,
  field: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    fail(index, id, `${field} must be a non-empty string`);
  }
  return value;
}

function toQuiz(raw: unknown, index: number, id: string | undefined): TermQuiz {
  if (!isRecord(raw)) fail(index, id, "quiz must be an object");
  assertKeys(raw, QUIZ_KEYS, index, id);
  const question = requiredString(raw.question, index, id, "quiz.question");
  const explanation = requiredString(raw.explanation, index, id, "quiz.explanation");
  if (!Array.isArray(raw.choices) || raw.choices.length !== 4) {
    fail(index, id, "quiz.choices must have exactly 4 items");
  }
  const choices = raw.choices.map((choice, choiceIndex) =>
    requiredString(choice, index, id, `quiz.choices[${choiceIndex}]`),
  );
  if (new Set(choices).size !== choices.length) {
    fail(index, id, "quiz.choices must be unique");
  }
  if (!isAnswerIndex(raw.answerIndex)) {
    fail(index, id, "quiz.answerIndex must be an integer from 0 to 3");
  }
  return {
    question,
    choices: [choices[0]!, choices[1]!, choices[2]!, choices[3]!],
    answerIndex: raw.answerIndex,
    explanation,
  };
}

function toTerm(raw: unknown, index: number, seenIds: Set<string>): Term {
  if (!isRecord(raw)) fail(index, undefined, "expected an object");
  assertKeys(raw, TERM_KEYS, index, typeof raw.id === "string" ? raw.id : undefined);
  const id = requiredString(raw.id, index, undefined, "id");
  if (!TERM_ID_PATTERN.test(id)) {
    fail(index, id, "id must match {category}-{nnn}");
  }
  if (seenIds.has(id)) fail(index, id, "duplicate id");
  seenIds.add(id);

  if (!isTermCategory(raw.category)) fail(index, id, "category is invalid");
  if (!id.startsWith(`${raw.category}-`)) {
    fail(index, id, "id prefix must match category");
  }
  if (!isTermLevel(raw.level)) fail(index, id, "level must be 1, 2, or 3");

  const name = requiredString(raw.name, index, id, "name");
  const explanation = requiredString(raw.explanation, index, id, "explanation");
  const explanationChars = charCount(explanation);
  if (
    explanationChars < TERM_EXPLANATION_MIN_CHARS ||
    explanationChars > TERM_EXPLANATION_MAX_CHARS
  ) {
    fail(
      index,
      id,
      `explanation must be ${TERM_EXPLANATION_MIN_CHARS}-${TERM_EXPLANATION_MAX_CHARS} characters (got ${explanationChars})`,
    );
  }
  if (!JAPANESE_CHAR.test(explanation)) {
    fail(index, id, "explanation must be Japanese");
  }

  const typingText = requiredString(raw.typingText, index, id, "typingText");
  if (!ASCII_PRINTABLE.test(typingText)) {
    fail(index, id, "typingText must be printable ASCII");
  }
  if (typingText.length > TERM_TYPING_TEXT_MAX_CHARS) {
    fail(
      index,
      id,
      `typingText must be at most ${TERM_TYPING_TEXT_MAX_CHARS} characters (got ${typingText.length})`,
    );
  }
  if (!/[A-Za-z]/.test(typingText)) {
    fail(index, id, "typingText must contain English letters");
  }

  const quiz = toQuiz(raw.quiz, index, id);
  const term: Term = {
    id,
    category: raw.category,
    level: raw.level,
    name,
    explanation,
    typingText,
    quiz,
  };

  if (raw.related !== undefined) {
    if (!Array.isArray(raw.related)) fail(index, id, "related must be an array of term ids");
    const related: string[] = [];
    for (const item of raw.related) {
      if (typeof item !== "string" || item.trim().length === 0) {
        fail(index, id, "related must be an array of term ids");
      }
      related.push(item);
    }
    if (related.length === 0) fail(index, id, "related must be omitted when empty");
    if (new Set(related).size !== related.length) {
      fail(index, id, "related ids must be unique");
    }
    if (related.includes(id)) fail(index, id, "related must not include its own id");
    term.related = related;
  }

  return term;
}

function assertRelatedIds(terms: readonly Term[]): void {
  const ids = new Set(terms.map((term) => term.id));
  for (const [index, term] of terms.entries()) {
    for (const relatedId of term.related ?? []) {
      if (!ids.has(relatedId)) {
        fail(index, term.id, `related id not found: ${relatedId}`);
      }
    }
  }
}

/** JSON を `Term[]` として検証する。形式不正は例外にする */
export function parseTerms(raw: unknown): Term[] {
  if (!Array.isArray(raw)) throw new Error("terms.json: expected an array");
  const seenIds = new Set<string>();
  const terms = raw.map((item, index) => toTerm(item, index, seenIds));
  assertRelatedIds(terms);
  return terms;
}

/** 全用語。読み込み時に検証する */
export const TERMS: Term[] = parseTerms(termsJson);

/**
 * 1 ラウンド分の用語を重複なく選ぶ。
 * `category` を省くと全カテゴリから選ぶ。既定の出題数は 3。
 */
export function selectTerms({
  category,
  count = TERMS_PER_ROUND,
  rng = Math.random,
  terms = TERMS,
}: SelectTermsOptions = {}): Term[] {
  if (category !== undefined && !isTermCategory(category)) {
    throw new Error(`selectTerms: unknown category (${String(category)})`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("selectTerms: count must be a non-negative integer");
  }
  if (typeof rng !== "function") {
    throw new Error("selectTerms: rng must be a function");
  }

  const pool = category === undefined ? terms : terms.filter((term) => term.category === category);
  if (count > pool.length) {
    throw new Error(`selectTerms: requested ${count} terms but only ${pool.length} are available`);
  }

  const arr = pool.slice();
  for (let i = 0; i < count; i++) {
    const sample = rng();
    if (!(sample >= 0 && sample < 1)) {
      throw new Error("selectTerms: rng must return a number in [0, 1)");
    }
    const j = i + Math.floor(sample * (arr.length - i));
    const left = arr[i];
    const right = arr[j];
    if (left === undefined || right === undefined) {
      throw new Error("selectTerms: failed to pick a term");
    }
    arr[i] = right;
    arr[j] = left;
  }
  return arr.slice(0, count);
}
