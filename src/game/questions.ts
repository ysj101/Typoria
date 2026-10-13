/**
 * 問題選択ロジック（§13.3 問題選択、§7.3 苦手問題の復習、§3.3 スキップ、§5.1 出題比率）。
 * React 非依存。乱数は注入してテスト可能にする。
 */
import { WORD_RATIO, type Difficulty, type Question, type QuestionStat } from "../types/game";

/** [0, 1) の乱数を返す関数 */
export type Rng = () => number;

/** 固定 seed の乱数生成器（mulberry32） */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface QuestionPicker {
  /** 次の問題を返す */
  next(): Question;
  /** スキップされた問題を同一セッション内で再出題しないよう記録する（§3.3） */
  markSkipped(id: string): void;
}

export interface CreateQuestionPickerOptions {
  questions: Question[];
  difficulty: Difficulty;
  /** 優先出題する苦手問題の id（§7.3） */
  weakQuestionIds?: string[];
  rng?: Rng;
}

/** 誤入力が多いと判定する 1 回あたりの平均誤入力数（§7.3） */
const WEAK_INCORRECT_PER_ATTEMPT = 3;
/** 正答率がこれ未満なら苦手（§7.3） */
const WEAK_ACCURACY = 0.8;

function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function createQuestionPicker({
  questions,
  difficulty,
  weakQuestionIds = [],
  rng = Math.random,
}: CreateQuestionPickerOptions): QuestionPicker {
  if (questions.length === 0) throw new Error("createQuestionPicker: questions must not be empty");

  const byDifficulty = questions.filter((q) => q.difficulty === difficulty);
  const pool = byDifficulty.length > 0 ? byDifficulty : questions;
  const weak = new Set(weakQuestionIds);

  const used = new Set<string>();
  let lastId: string | null = null;

  const remaining = () => pool.filter((q) => !used.has(q.id));

  const pickFrom = (candidates: Question[]): Question => {
    const words = candidates.filter((q) => q.type === "word");
    const blanks = candidates.filter((q) => q.type === "fill_blank");
    let bucket: Question[];
    if (words.length === 0) bucket = blanks;
    else if (blanks.length === 0) bucket = words;
    else bucket = rng() < WORD_RATIO ? words : blanks;
    return bucket[Math.floor(rng() * bucket.length)]!;
  };

  return {
    next() {
      let candidates = remaining();
      if (candidates.length === 0) {
        // 使い切ったらシャッフルして再利用（§13.3）。直前の問題は連続させない
        used.clear();
        candidates = shuffle(pool, rng);
        if (candidates.length > 1 && lastId !== null) {
          candidates = candidates.filter((q) => q.id !== lastId);
        }
      }
      const weakCandidates = candidates.filter((q) => weak.has(q.id));
      const chosen = pickFrom(weakCandidates.length > 0 ? weakCandidates : candidates);
      used.add(chosen.id);
      lastId = chosen.id;
      return chosen;
    },
    markSkipped(id) {
      used.add(id);
    },
  };
}

/** 復習対象の苦手問題を返す（§7.3） */
export function selectWeakQuestions(stats: QuestionStat[]): string[] {
  const ids: string[] = [];
  for (const s of stats) {
    if (s.attempts <= 0) continue;
    const hasSkip = s.skipped > 0;
    const manyMistakes = s.incorrectKeystrokes / s.attempts >= WEAK_INCORRECT_PER_ATTEMPT;
    const lowAccuracy = s.solved / s.attempts < WEAK_ACCURACY;
    if ((hasSkip || manyMistakes || lowAccuracy) && !ids.includes(s.questionId)) {
      ids.push(s.questionId);
    }
  }
  return ids;
}
