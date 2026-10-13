import { DIFFICULTIES, type Difficulty, type Question, type QuestionType } from "../types/game";
import questionsJson from "./questions.json";

const QUESTION_TYPES: readonly QuestionType[] = ["word", "fill_blank"];

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

/** JSON の 1 要素を `Question` として検証する。形式不正は起動時に例外にする */
function toQuestion(raw: unknown, index: number): Question {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`questions.json[${index}]: not an object`);
  }
  const q = raw as Record<string, unknown>;
  if (
    typeof q.id !== "string" ||
    !isQuestionType(q.type) ||
    !isDifficulty(q.difficulty) ||
    typeof q.japanese !== "string" ||
    typeof q.english !== "string" ||
    typeof q.answer !== "string" ||
    !Array.isArray(q.tags) ||
    !q.tags.every((t) => typeof t === "string") ||
    (q.hint !== undefined && typeof q.hint !== "string")
  ) {
    throw new Error(`questions.json[${index}]: invalid question (${String(q.id)})`);
  }
  return {
    id: q.id,
    type: q.type,
    difficulty: q.difficulty,
    japanese: q.japanese,
    english: q.english,
    answer: q.answer,
    tags: q.tags as string[],
    ...(q.hint !== undefined ? { hint: q.hint } : {}),
  };
}

/** 全問題データ（§5.1, §7.1）。静的 JSON に固定する（§18.4） */
export const QUESTIONS: Question[] = questionsJson.map(toQuestion);

/** 指定難易度の問題を返す */
export function getQuestionsByDifficulty(difficulty: Difficulty): Question[] {
  return QUESTIONS.filter((q) => q.difficulty === difficulty);
}
