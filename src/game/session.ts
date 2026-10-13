import type { TyporiaDatabase } from "../storage/database";
import type {
  DailyMissionId,
  DailyMissionProgress,
  Difficulty,
  GameSession,
  QuestionResult,
  QuestionStat,
  UserProgress,
} from "../types/game";
import { nextDifficulty } from "./difficulty";
import {
  DAILY_MISSIONS,
  applySessionToMissions,
  localDateKey,
  resolveMissionForDate,
  updateStreak,
} from "./habit";
import { calcXp } from "./scoring";

/**
 * セッション確定処理（docs/spec.md §6.6, §7.2, §7.3, §8、AC-10〜AC-13）。
 * ゲーム終了時に GameSession を受け取り、永続化と進捗更新をまとめて行う。
 */

export type SessionDatabase = Pick<
  TyporiaDatabase,
  | "saveSession"
  | "getProgress"
  | "putProgress"
  | "getSettings"
  | "getQuestionStats"
  | "bulkPutQuestionStats"
  | "getMission"
  | "putMission"
>;

export interface ApplySessionDeps {
  db: SessionDatabase;
  /** 現在日時。既定は `() => new Date()` */
  now?: () => Date;
}

export interface MissionReward {
  id: DailyMissionId;
  rewardXP: number;
}

export interface ApplySessionResult {
  /** 保存したセッション（xpEarned を埋めたもの） */
  session: GameSession;
  /** 更新後の進捗 */
  progress: UserProgress;
  /** 自己ベストを更新したか */
  isNewRecord: boolean;
  /** セッション自体の XP（ミッション報酬は含まない） */
  xpEarned: number;
  /** 今回新たに付与されたミッション報酬 */
  missionRewards: MissionReward[];
  nextDifficulty: Difficulty;
  /** 更新後の連続学習日数 */
  streak: number;
  /** 更新後の当日ミッション進捗 */
  mission: DailyMissionProgress;
}

function emptyStat(questionId: string): QuestionStat {
  return {
    questionId,
    attempts: 0,
    solved: 0,
    skipped: 0,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    lastAttemptedAt: null,
  };
}

/**
 * 問題別統計にセッション結果を累積する（§7.3 の復習判定用）。
 * timeout は attempts に数えるが solved / skipped は増やさない。
 */
export function accumulateQuestionStats(
  existing: readonly QuestionStat[],
  results: readonly QuestionResult[],
  attemptedAt: string,
): QuestionStat[] {
  const byId = new Map<string, QuestionStat>();
  for (const r of results) {
    const base =
      byId.get(r.questionId) ??
      existing.find((s) => s.questionId === r.questionId) ??
      emptyStat(r.questionId);
    byId.set(r.questionId, {
      ...base,
      attempts: base.attempts + 1,
      solved: base.solved + (r.status === "solved" ? 1 : 0),
      skipped: base.skipped + (r.status === "skipped" ? 1 : 0),
      correctKeystrokes: base.correctKeystrokes + r.correctKeystrokes,
      incorrectKeystrokes: base.incorrectKeystrokes + r.incorrectKeystrokes,
      lastAttemptedAt: attemptedAt,
    });
  }
  return [...byId.values()];
}

export async function applySessionResult(
  input: GameSession,
  { db, now = () => new Date() }: ApplySessionDeps,
): Promise<ApplySessionResult> {
  const current = now();
  const nowIso = current.toISOString();
  const todayKey = localDateKey(current);
  const aborted = input.completedAt === null;

  const xpEarned = aborted ? 0 : input.xpEarned > 0 ? input.xpEarned : calcXp(input);
  const session: GameSession = { ...input, xpEarned };

  await db.saveSession(session);

  // 問題別統計は途中終了でも更新する（§7.3）
  const existingStats = await db.getQuestionStats();
  const updatedStats = accumulateQuestionStats(existingStats, session.results, nowIso);
  if (updatedStats.length > 0) await db.bulkPutQuestionStats(updatedStats);

  const progress = await db.getProgress();
  const mission = resolveMissionForDate(await db.getMission(todayKey), todayKey);

  if (aborted) {
    return {
      session,
      progress,
      isNewRecord: false,
      xpEarned: 0,
      missionRewards: [],
      nextDifficulty: progress.currentDifficulty,
      streak: progress.currentStreak,
      mission,
    };
  }

  const settings = await db.getSettings();
  const missionResult = applySessionToMissions(mission, session);
  await db.putMission(missionResult.mission);
  const missionRewards: MissionReward[] = missionResult.newlyCompleted.flatMap((id) => {
    const def = DAILY_MISSIONS.find((m) => m.id === id);
    return def ? [{ id, rewardXP: def.rewardXP }] : [];
  });

  const streak = updateStreak(progress, todayKey);
  const isNewRecord = session.score > progress.bestScore;
  const next = nextDifficulty(session.difficulty, session, settings);

  const updatedProgress: UserProgress = {
    ...progress,
    totalXP: progress.totalXP + xpEarned + missionResult.rewardXP,
    totalSessions: progress.totalSessions + 1,
    bestScore: Math.max(progress.bestScore, session.score),
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastPlayedDate: streak.lastPlayedDate,
    currentDifficulty: next,
  };
  await db.putProgress(updatedProgress);

  return {
    session,
    progress: updatedProgress,
    isNewRecord,
    xpEarned,
    missionRewards,
    nextDifficulty: next,
    streak: updatedProgress.currentStreak,
    mission: missionResult.mission,
  };
}
