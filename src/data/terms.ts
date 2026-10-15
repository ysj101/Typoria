/**
 * IT 基礎用語の読み込み、バリデーション、ラウンド出題。
 * 既存の英単語データ（questions.json）とは別データ。
 */
import { shuffle, type Rng } from "../game/questions";
import {
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

export interface SelectTermsOptions {
  /** 未指定なら全カテゴリ */
  category?: TermCategory;
  /** 既定は {@link TERMS_PER_ROUND} */
  count?: number;
  /** テストでは固定 seed の乱数を渡す */
  rng?: Rng;
  /** 未指定なら {@link TERMS} */
  terms?: readonly Term[];
}

type Fail = (message: string) => never;

function failAt(index: number, id?: string): Fail {
  const label = id ?? `#${index}`;
  return (message) => {
    throw new Error(`terms.json[${index}] (${label}): ${message}`);
  };
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

function assertKeys(obj: Record<string, unknown>, allowed: readonly string[], fail: Fail): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail(`unexpected property ${key}`);
  }
}

function requiredString(value: unknown, field: string, fail: Fail): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    fail(`${field} must be a non-empty string`);
  }
  return value;
}

function toQuiz(raw: unknown, fail: Fail): TermQuiz {
  if (!isRecord(raw)) fail("quiz must be an object");
  assertKeys(raw, QUIZ_KEYS, fail);
  const question = requiredString(raw.question, "quiz.question", fail);
  const explanation = requiredString(raw.explanation, "quiz.explanation", fail);
  if (!Array.isArray(raw.choices) || raw.choices.length !== 4) {
    fail("quiz.choices must have exactly 4 items");
  }
  const choices = raw.choices.map((choice, choiceIndex) =>
    requiredString(choice, `quiz.choices[${choiceIndex}]`, fail),
  );
  if (new Set(choices).size !== choices.length) fail("quiz.choices must be unique");
  if (!isAnswerIndex(raw.answerIndex)) {
    fail("quiz.answerIndex must be an integer from 0 to 3");
  }
  return {
    question,
    choices: choices as TermQuiz["choices"],
    answerIndex: raw.answerIndex,
    explanation,
  };
}

function toRelated(raw: unknown, id: string, fail: Fail): string[] {
  if (
    !Array.isArray(raw) ||
    !raw.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    fail("related must be an array of term ids");
  }
  const related = raw as string[];
  if (related.length === 0) fail("related must be omitted when empty");
  if (new Set(related).size !== related.length) fail("related ids must be unique");
  if (related.includes(id)) fail("related must not include its own id");
  return related;
}

function toTerm(raw: unknown, index: number, seenIds: Set<string>): Term {
  const failRaw: Fail = failAt(index);
  if (!isRecord(raw)) failRaw("expected an object");
  const id = requiredString(raw.id, "id", failRaw);
  const fail: Fail = failAt(index, id);
  assertKeys(raw, TERM_KEYS, fail);
  if (seenIds.has(id)) fail("duplicate id");
  seenIds.add(id);

  if (!isTermCategory(raw.category)) fail("category is invalid");
  if (!new RegExp(`^${raw.category}-\\d{3}$`).test(id)) {
    fail("id must match {category}-{nnn} with the term's own category");
  }
  if (!isTermLevel(raw.level)) fail("level must be 1, 2, or 3");

  const name = requiredString(raw.name, "name", fail);
  const explanation = requiredString(raw.explanation, "explanation", fail);
  const explanationChars = charCount(explanation);
  if (
    explanationChars < TERM_EXPLANATION_MIN_CHARS ||
    explanationChars > TERM_EXPLANATION_MAX_CHARS
  ) {
    fail(
      `explanation must be ${TERM_EXPLANATION_MIN_CHARS}-${TERM_EXPLANATION_MAX_CHARS} characters (got ${explanationChars})`,
    );
  }
  if (!JAPANESE_CHAR.test(explanation)) fail("explanation must be Japanese");

  const typingText = requiredString(raw.typingText, "typingText", fail);
  if (!ASCII_PRINTABLE.test(typingText)) fail("typingText must be printable ASCII");
  if (typingText.length > TERM_TYPING_TEXT_MAX_CHARS) {
    fail(
      `typingText must be at most ${TERM_TYPING_TEXT_MAX_CHARS} characters (got ${typingText.length})`,
    );
  }
  if (!/[A-Za-z]/.test(typingText)) fail("typingText must contain English letters");

  const term: Term = {
    id,
    category: raw.category,
    level: raw.level,
    name,
    explanation,
    typingText,
    quiz: toQuiz(raw.quiz, fail),
  };
  if (raw.related !== undefined) term.related = toRelated(raw.related, id, fail);
  return term;
}

function assertRelatedIds(terms: readonly Term[], ids: ReadonlySet<string>): void {
  for (const [index, term] of terms.entries()) {
    for (const relatedId of term.related ?? []) {
      if (!ids.has(relatedId)) failAt(index, term.id)(`related id not found: ${relatedId}`);
    }
  }
}

/** JSON を `Term[]` として検証する。形式不正は例外にする */
export function parseTerms(raw: unknown): Term[] {
  if (!Array.isArray(raw)) throw new Error("terms.json: expected an array");
  const seenIds = new Set<string>();
  const terms = raw.map((item, index) => toTerm(item, index, seenIds));
  assertRelatedIds(terms, seenIds);
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

  const pool = category === undefined ? terms : terms.filter((term) => term.category === category);
  if (count > pool.length) {
    throw new Error(`selectTerms: requested ${count} terms but only ${pool.length} are available`);
  }

  return shuffle(pool, rng).slice(0, count);
}
