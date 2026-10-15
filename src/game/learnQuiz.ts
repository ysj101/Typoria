/**
 * 学習ラウンド終了後の理解度クイズ。
 * React 非依存。出題する用語と 4 択の表示順は注入した乱数で決める。
 * シャッフル後も正解は `TermQuiz.answerIndex`（元の添字）で判定する。
 * 永続化は #76。ここはラウンド結果を返すところまで。
 */
import type { Term } from "../types/term";
import { shuffle, type Rng } from "./questions";

/** `TermQuiz.choices` の元の添字 */
export type QuizChoiceIndex = 0 | 1 | 2 | 3;

export interface LearnQuizChoice {
  /** シャッフル前の添字。正誤判定はこちらを使う */
  sourceIndex: QuizChoiceIndex;
  text: string;
}

export interface LearnQuizQuestion {
  termId: string;
  termName: string;
  question: string;
  /** 表示順。`sourceIndex` は元の並び */
  choices: readonly LearnQuizChoice[];
  answerSourceIndex: QuizChoiceIndex;
  explanation: string;
}

/** #76 が受け取るクイズ結果 */
export interface LearnQuizResult {
  termId: string;
  correct: boolean;
  /** ISO 8601 */
  answeredAt: string;
}

/** リザルトに出す、今日学んだ 1 語 */
export interface LearnedTermSummary {
  termId: string;
  name: string;
  /** `explanation` の最初の一文 */
  summary: string;
}

/**
 * ラウンド結果。`quiz` が理解度クイズの正誤。
 * `terms` は出題順の「今日学んだ用語」。
 */
export interface LearnRoundResult {
  terms: readonly LearnedTermSummary[];
  quiz: LearnQuizResult;
}

export interface LearnQuizState {
  phase: "asking" | "feedback";
  question: LearnQuizQuestion;
  /** 回答後の、選んだ選択肢の元添字 */
  selectedSourceIndex: QuizChoiceIndex | null;
  result: LearnQuizResult | null;
}

export interface CreateLearnQuizOptions {
  /** 未指定なら `Math.random`。1 回目が出題用語、続きが選択肢のシャッフル */
  rng?: Rng;
}

export function isQuizChoiceIndex(value: unknown): value is QuizChoiceIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** 解説の最初の一文。句点で終わらないときは全文 */
export function termSummary(explanation: string): string {
  const trimmed = explanation.trim();
  const end = trimmed.indexOf("。");
  if (end === -1) return trimmed;
  return trimmed.slice(0, end + 1);
}

function shuffleChoices(choices: readonly string[], rng: Rng): LearnQuizChoice[] {
  return shuffle(
    choices.map((text, index) => ({ sourceIndex: index as QuizChoiceIndex, text })),
    rng,
  );
}

/**
 * ラウンドで扱った用語から 1 問作る。
 * 乱数の消費順は、出題用語の選択が 1 回、その後 Fisher–Yates で 4 択をシャッフルする。
 */
export function createLearnQuiz(
  terms: readonly Term[],
  { rng = Math.random }: CreateLearnQuizOptions = {},
): LearnQuizState {
  const picked = terms[Math.floor(rng() * terms.length)];
  if (!picked) throw new Error("createLearnQuiz: terms must not be empty");

  return {
    phase: "asking",
    question: {
      termId: picked.id,
      termName: picked.name,
      question: picked.quiz.question,
      choices: shuffleChoices(picked.quiz.choices, rng),
      answerSourceIndex: picked.quiz.answerIndex,
      explanation: picked.quiz.explanation,
    },
    selectedSourceIndex: null,
    result: null,
  };
}

/**
 * 1 回だけ回答する。正誤は表示位置ではなく `sourceIndex` で決める。
 * 回答済みの状態へ再度呼んでも変えない。
 */
export function answerLearnQuiz(
  state: LearnQuizState,
  sourceIndex: number,
  now: () => Date = () => new Date(),
): LearnQuizState {
  if (state.phase !== "asking" || !isQuizChoiceIndex(sourceIndex)) return state;
  return {
    ...state,
    phase: "feedback",
    selectedSourceIndex: sourceIndex,
    result: {
      termId: state.question.termId,
      correct: sourceIndex === state.question.answerSourceIndex,
      answeredAt: now().toISOString(),
    },
  };
}

/** クイズ結果と、ラウンドで読んだ用語の一言解説をまとめる */
export function createLearnRoundResult(
  terms: readonly Term[],
  quiz: LearnQuizResult,
): LearnRoundResult {
  return {
    terms: terms.map((term) => ({
      termId: term.id,
      name: term.name,
      summary: termSummary(term.explanation),
    })),
    quiz,
  };
}

function isLearnedTermSummary(value: unknown): value is LearnedTermSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.termId === "string" && typeof v.name === "string" && typeof v.summary === "string"
  );
}

export function isLearnQuizResult(value: unknown): value is LearnQuizResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.termId === "string" &&
    v.termId.length > 0 &&
    typeof v.correct === "boolean" &&
    typeof v.answeredAt === "string" &&
    v.answeredAt.length > 0
  );
}

/** リザルトの route state が学習ラウンドの結果か */
export function isLearnRoundResult(value: unknown): value is LearnRoundResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.terms) &&
    v.terms.length > 0 &&
    v.terms.every(isLearnedTermSummary) &&
    isLearnQuizResult(v.quiz)
  );
}
