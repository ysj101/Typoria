/**
 * 難易度自動調整（docs/spec.md §7.2、§4.5）。React 非依存の純関数。
 */
import {
  DIFFICULTIES,
  type Difficulty,
  type DifficultyMode,
  type GameSession,
  type Settings,
  type UserProgress,
} from "../types/game";

/** 1 段階上げるための問題正答率の下限（§7.2） */
export const PROMOTE_ACCURACY = 0.9;
/** 1 段階上げるための平均回答時間の上限（ms）（§7.2） */
export const PROMOTE_AVG_DURATION_MS = 5000;
/** 維持するための問題正答率の下限。これ未満は 1 段階下げる（§7.2） */
export const KEEP_ACCURACY = 0.7;

type SessionLike = Pick<GameSession, "solved" | "skipped" | "results">;

/** 難易度を `delta` 段階動かし、Easy〜Hard でクランプする */
export function stepDifficulty(current: Difficulty, delta: -1 | 0 | 1): Difficulty {
  const index = DIFFICULTIES.indexOf(current);
  const next = Math.min(DIFFICULTIES.length - 1, Math.max(0, index + delta));
  return DIFFICULTIES[next];
}

/** 問題正答率 = solved / (solved + skipped)。timeout は分母に含めない。分母 0 は 0 */
function problemAccuracy(session: SessionLike): number {
  const denominator = session.solved + session.skipped;
  return denominator === 0 ? 0 : session.solved / denominator;
}

/** solved の durationMs の平均。solved が無ければ Infinity（昇格条件を満たさない） */
function averageSolvedDurationMs(session: SessionLike): number {
  const solved = session.results.filter((r) => r.status === "solved");
  if (solved.length === 0) return Number.POSITIVE_INFINITY;
  return solved.reduce((sum, r) => sum + r.durationMs, 0) / solved.length;
}

/**
 * セッション終了時の成績から次回難易度を決める（§7.2）。
 * - 設定が固定難易度ならその値
 * - 正解 0 件 → 1 段階下げる
 * - 正答率 90% 以上かつ平均回答時間 5 秒以内 → 1 段階上げる
 * - 正答率 70% 以上 → 維持、70% 未満 → 1 段階下げる
 */
export function nextDifficulty(
  current: Difficulty,
  session: SessionLike,
  settings: Pick<Settings, "difficultyMode">,
): Difficulty {
  if (settings.difficultyMode !== "auto") return settings.difficultyMode;
  if (session.solved === 0) return stepDifficulty(current, -1);

  const accuracy = problemAccuracy(session);
  if (accuracy >= PROMOTE_ACCURACY && averageSolvedDurationMs(session) <= PROMOTE_AVG_DURATION_MS) {
    return stepDifficulty(current, 1);
  }
  if (accuracy >= KEEP_ACCURACY) return current;
  return stepDifficulty(current, -1);
}

/** ゲーム開始時に使う難易度（§4.5）。auto なら進捗の現在値、それ以外は固定値 */
export function resolveDifficulty(
  mode: DifficultyMode,
  progress: Pick<UserProgress, "currentDifficulty">,
): Difficulty {
  return mode === "auto" ? progress.currentDifficulty : mode;
}
