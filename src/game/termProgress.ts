/**
 * 用語の学習状態、ラウンド結果の反映、おまかせ出題。
 * 状態は未学習 / 学習中（読んだがクイズ未正解）/ 習得（クイズに 1 回以上正解）。
 */
import type { LearnQuizResult, LearnRoundResult } from "./learnQuiz";
import { TERMS, TERMS_PER_ROUND, selectTerms, type TermRng } from "../data/terms";
import type { Term, TermCategory, TermProgress, TermStudyStatus } from "../types/term";

export interface TermProgressStorage {
  listTermProgress(): Promise<readonly TermProgress[]>;
  putTermProgress(records: readonly TermProgress[]): Promise<void>;
}

const chains = new WeakMap<object, Promise<void>>();

export function termStudyStatus(progress: TermProgress | undefined): TermStudyStatus {
  if (!progress) return "unseen";
  if (progress.quizCorrect >= 1) return "mastered";
  if (progress.seenCount > 0 || progress.quizIncorrect > 0) return "learning";
  return "unseen";
}

export interface CategoryStudyCount {
  mastered: number;
  total: number;
}

/** カテゴリごとの「習得 n / 全 m 語」 */
export function categoryStudyCounts(
  terms: readonly Term[],
  progress: readonly TermProgress[],
): Record<TermCategory, CategoryStudyCount> {
  const byId = new Map(progress.map((row) => [row.termId, row]));
  const counts: Record<TermCategory, CategoryStudyCount> = {
    ai: { mastered: 0, total: 0 },
    cloud: { mastered: 0, total: 0 },
    security: { mastered: 0, total: 0 },
    network: { mastered: 0, total: 0 },
    web: { mastered: 0, total: 0 },
    database: { mastered: 0, total: 0 },
    dev: { mastered: 0, total: 0 },
  };
  for (const term of terms) {
    const bucket = counts[term.category];
    bucket.total += 1;
    if (termStudyStatus(byId.get(term.id)) === "mastered") bucket.mastered += 1;
  }
  return counts;
}

function copyMap(current: readonly TermProgress[]): Map<string, TermProgress> {
  const map = new Map<string, TermProgress>();
  for (const row of current) map.set(row.termId, { ...row });
  return map;
}

function touch(map: Map<string, TermProgress>, termId: string, studiedAt: string): TermProgress {
  const existing = map.get(termId);
  if (existing) return existing;
  const created: TermProgress = {
    termId,
    seenCount: 0,
    quizCorrect: 0,
    quizIncorrect: 0,
    lastStudiedAt: studiedAt,
  };
  map.set(termId, created);
  return created;
}

function laterTimestamp(current: string, next: string): string {
  return next > current ? next : current;
}

/** ラウンドで読んだ用語の seenCount を 1 増やす */
export function applyTermsSeen(
  current: readonly TermProgress[],
  termIds: readonly string[],
  studiedAt: string,
): TermProgress[] {
  const map = copyMap(current);
  for (const termId of termIds) {
    const row = touch(map, termId, studiedAt);
    row.seenCount += 1;
    row.lastStudiedAt = laterTimestamp(row.lastStudiedAt, studiedAt);
  }
  return [...map.values()];
}

/** 理解度クイズの `{ termId, correct, answeredAt }` を記録する */
export function applyQuizResult(
  current: readonly TermProgress[],
  quiz: LearnQuizResult,
): TermProgress[] {
  const map = copyMap(current);
  const row = touch(map, quiz.termId, quiz.answeredAt);
  if (quiz.correct) row.quizCorrect += 1;
  else row.quizIncorrect += 1;
  row.lastStudiedAt = laterTimestamp(row.lastStudiedAt, quiz.answeredAt);
  return [...map.values()];
}

/**
 * #75 のラウンド結果を学習記録へ反映する。
 * 読んだ用語は seenCount、クイズ対象は正誤カウント。入力の配列は変更しない。
 */
export function applyLearnRoundResult(
  current: readonly TermProgress[],
  result: LearnRoundResult,
): TermProgress[] {
  const seen = applyTermsSeen(
    current,
    result.terms.map((term) => term.termId),
    result.quiz.answeredAt,
  );
  return applyQuizResult(seen, result.quiz);
}

/**
 * 同じストレージへの更新を直列化する。
 * ラウンド完了の seen 更新と、その直後のクイズ結果が互いを上書きしない。
 */
export function enqueueTermProgressUpdate(
  storage: TermProgressStorage,
  update: (current: readonly TermProgress[]) => readonly TermProgress[],
): Promise<void> {
  const previous = chains.get(storage) ?? Promise.resolve();
  const run = previous.then(async () => {
    const current = await storage.listTermProgress();
    await storage.putTermProgress(update(current));
  });
  chains.set(
    storage,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export interface SelectOmakaseOptions {
  count?: number;
  rng?: TermRng;
  terms?: readonly Term[];
  progress?: readonly TermProgress[];
}

/**
 * おまかせ出題。未学習と学習中を習得より先に選び、足りない分だけ習得で埋める。
 * 同じ優先度の中の順番は注入した乱数で決まる。
 */
export function selectOmakaseTerms({
  count = TERMS_PER_ROUND,
  rng = Math.random,
  terms = TERMS,
  progress = [],
}: SelectOmakaseOptions = {}): Term[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("selectOmakaseTerms: count must be a non-negative integer");
  }
  const byId = new Map(progress.map((row) => [row.termId, row]));
  const preferred: Term[] = [];
  const mastered: Term[] = [];
  for (const term of terms) {
    if (termStudyStatus(byId.get(term.id)) === "mastered") mastered.push(term);
    else preferred.push(term);
  }
  const preferredCount = Math.min(count, preferred.length);
  const first =
    preferredCount === 0 ? [] : selectTerms({ terms: preferred, count: preferredCount, rng });
  const restCount = count - first.length;
  if (restCount === 0) return first;
  if (restCount > mastered.length) {
    throw new Error(
      `selectOmakaseTerms: requested ${count} terms but only ${terms.length} are available`,
    );
  }
  return [...first, ...selectTerms({ terms: mastered, count: restCount, rng })];
}
