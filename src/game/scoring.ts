/**
 * スコア・星評価・XP の計算（React 非依存の純関数）。
 * 仕様: docs/spec.md §6
 */
import {
  BASE_SCORE,
  COMBO_MULTIPLIERS,
  FEVER_COMBO,
  PERFECT_BONUS,
  STAR_THRESHOLDS,
  XP_BASE,
  XP_PER_PERFECT,
  XP_PER_SOLVED,
  type Difficulty,
  type GameSession,
} from "../types/game";

/** 星の数 */
export type Stars = 0 | 1 | 2 | 3 | 4 | 5;

/** 問題正答率の計算に必要なフィールド（§6.5） */
export type ProblemAccuracyInput = Pick<GameSession, "solved" | "skipped">;

/** タイピング正確率の計算に必要なフィールド（§6.5） */
export type TypingAccuracyInput = Pick<GameSession, "correctKeystrokes" | "incorrectKeystrokes">;

/** 星評価の計算に必要なフィールド（§6.5） */
export type StarsInput = ProblemAccuracyInput & TypingAccuracyInput;

/** XP の計算に必要なフィールド（§6.6） */
export type XpInput = Pick<GameSession, "solved" | "perfectSolved" | "completedAt">;

/** 難易度別の基本スコア（§6.1） */
export function baseScore(difficulty: Difficulty): number {
  return BASE_SCORE[difficulty];
}

/** コンボ倍率（§6.2）。コンボ 0 以下は 1.0 */
export function comboMultiplier(combo: number): number {
  const entry = COMBO_MULTIPLIERS.find((c) => combo >= c.minCombo);
  return entry?.multiplier ?? 1.0;
}

/** 誤入力 0 なら PERFECT（§5.3） */
export function isPerfect(incorrectKeystrokes: number): boolean {
  return incorrectKeystrokes === 0;
}

/** コンボ 10 以上で FEVER（§6.4） */
export function isFeverActive(combo: number): boolean {
  return combo >= FEVER_COMBO;
}

export interface QuestionScoreInput {
  difficulty: Difficulty;
  /** この問題をクリアした時点のコンボ数（1 問目のクリアで 1） */
  combo: number;
  incorrectKeystrokes: number;
}

/**
 * 1 問のスコア（§6.3）: `floor(base * multiplier) + perfectBonus`
 * 例: Normal・10 コンボ目・PERFECT → floor(150 * 1.5) + 30 = 255
 */
export function calcQuestionScore({
  difficulty,
  combo,
  incorrectKeystrokes,
}: QuestionScoreInput): number {
  // 浮動小数点の誤差（100 * 1.2 = 120.00000000000001 など）で floor がずれないよう丸めてから切り捨てる
  const multiplied = Math.round(baseScore(difficulty) * comboMultiplier(combo) * 1e6) / 1e6;
  const bonus = isPerfect(incorrectKeystrokes) ? PERFECT_BONUS : 0;
  return Math.floor(multiplied) + bonus;
}

/** 分母 0 のときは 0 を返す割り算 */
function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** 問題正答率 = solved / (solved + skipped)。timeout は分母に含めない（§6.5） */
export function problemAccuracy({ solved, skipped }: ProblemAccuracyInput): number {
  return safeRatio(solved, solved + skipped);
}

/** タイピング正確率 = correct / (correct + incorrect)（§6.5） */
export function typingAccuracy({
  correctKeystrokes,
  incorrectKeystrokes,
}: TypingAccuracyInput): number {
  return safeRatio(correctKeystrokes, correctKeystrokes + incorrectKeystrokes);
}

/** 総合率 = 問題正答率 * 0.6 + タイピング正確率 * 0.4（§6.5） */
export function overallRate(session: StarsInput): number {
  return problemAccuracy(session) * 0.6 + typingAccuracy(session) * 0.4;
}

/** 星評価（§6.5）。solved = 0 は 0 */
export function calcStars(session: StarsInput): Stars {
  if (session.solved === 0) return 0;
  const rate = overallRate(session);
  const entry = STAR_THRESHOLDS.find((t) => rate >= t.minRate);
  return (entry?.stars ?? 1) as Stars;
}

/** XP = 20 + solved * 5 + perfectSolved * 2。途中終了は 0（§6.6） */
export function calcXp({ solved, perfectSolved, completedAt }: XpInput): number {
  if (completedAt === null) return 0;
  return XP_BASE + solved * XP_PER_SOLVED + perfectSolved * XP_PER_PERFECT;
}
