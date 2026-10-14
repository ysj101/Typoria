/**
 * 新人向け IT 基礎用語のデータモデル。
 * 1 語は「解説を読む → 打つ → 理解度クイズ」の単位。
 */

/** 用語カテゴリ */
export const TERM_CATEGORIES = [
  "ai",
  "cloud",
  "security",
  "network",
  "web",
  "database",
  "dev",
] as const;

export type TermCategory = (typeof TERM_CATEGORIES)[number];

/** 画面に出すカテゴリ名 */
export const TERM_CATEGORY_LABELS: Readonly<Record<TermCategory, string>> = {
  ai: "AI",
  cloud: "クラウド",
  security: "セキュリティ",
  network: "ネットワーク",
  web: "Web",
  database: "データベース",
  dev: "開発基礎",
};

/** 新人研修レベル。1 が入門 */
export type TermLevel = 1 | 2 | 3;

export const TERM_LEVELS: readonly TermLevel[] = [1, 2, 3];

/** 解説の字数。スマホ 1 画面で読める量 */
export const TERM_EXPLANATION_MIN_CHARS = 120;
export const TERM_EXPLANATION_MAX_CHARS = 200;

/** 既存の英字入力へ流す打鍵対象の上限 */
export const TERM_TYPING_TEXT_MAX_CHARS = 80;

/** 理解度クイズ（解説を読んでいれば答えられる 4 択） */
export interface TermQuiz {
  question: string;
  choices: [string, string, string, string];
  /** `choices` の 0 始まりの添字 */
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

/** IT 基礎用語 */
export interface Term {
  /** `{category}-{nnn}` 形式で一意 */
  id: string;
  category: TermCategory;
  level: TermLevel;
  /** 用語名（例: ロードバランサ） */
  name: string;
  /** 日本語の解説（120〜200 字程度） */
  explanation: string;
  /**
   * 打鍵対象。ASCII の英語で、用語の英語表記と解説の要点を短く書く。
   * 長さは 80 文字以内。
   */
  typingText: string;
  quiz: TermQuiz;
  /** 関連用語の id */
  related?: string[];
}

export function isTermCategory(value: unknown): value is TermCategory {
  return typeof value === "string" && (TERM_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 用語ごとの学習記録。
 * 未学習はレコードが無い（または回数ゼロ）。学習中は読んだがクイズ未正解。習得はクイズに 1 回以上正解。
 */
export interface TermProgress {
  termId: string;
  seenCount: number;
  quizCorrect: number;
  quizIncorrect: number;
  /** ISO 8601 */
  lastStudiedAt: string;
}

/** 用語の学習状態 */
export type TermStudyStatus = "unseen" | "learning" | "mastered";

export const TERM_STUDY_STATUS_LABELS: Readonly<Record<TermStudyStatus, string>> = {
  unseen: "未学習",
  learning: "学習中",
  mastered: "習得",
};

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isTermProgress(value: unknown): value is TermProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.termId === "string" &&
    record.termId.length > 0 &&
    isNonNegativeInt(record.seenCount) &&
    isNonNegativeInt(record.quizCorrect) &&
    isNonNegativeInt(record.quizIncorrect) &&
    typeof record.lastStudiedAt === "string" &&
    record.lastStudiedAt.length > 0
  );
}
