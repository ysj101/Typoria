/**
 * 連続学習日数（Streak）とデイリーミッションの純粋なロジック。
 * 仕様: docs/spec.md §8.1 連続学習日数、§8.2 デイリーミッション
 * 日時は引数で注入し、副作用を持たない。
 */
import type {
  DailyMission,
  DailyMissionId,
  DailyMissionProgress,
  DailyMissionProgressEntry,
  GameSession,
  UserProgress,
} from "../types/game";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 端末ローカルタイムゾーンの `YYYY-MM-DD`（§8.1） */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** `YYYY-MM-DD` の 1 日前（ローカル日付） */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
}

export type StreakFields = Pick<UserProgress, "currentStreak" | "longestStreak" | "lastPlayedDate">;

/**
 * Streak を更新する（§8.1）。
 * 同日 → 変化なし、前日 → +1、それ以外（未プレイ含む）→ 1。
 */
export function updateStreak(progress: StreakFields, todayKey: string): StreakFields {
  let currentStreak: number;
  if (progress.lastPlayedDate === todayKey) {
    currentStreak = progress.currentStreak;
  } else if (progress.lastPlayedDate === previousDateKey(todayKey)) {
    currentStreak = progress.currentStreak + 1;
  } else {
    currentStreak = 1;
  }
  return {
    currentStreak,
    longestStreak: Math.max(progress.longestStreak, currentStreak),
    lastPlayedDate: todayKey,
  };
}

/** デイリーミッション定義（§8.2） */
export const DAILY_MISSIONS: readonly DailyMission[] = [
  { id: "play_once", title: "1 回プレイする", target: 1, rewardXP: 20 },
  { id: "solve_10", title: "10 問クリアする", target: 10, rewardXP: 30 },
  { id: "perfect_5", title: "PERFECT を 5 回出す", target: 5, rewardXP: 30 },
];

/** 指定日の新しいミッション進捗 */
export function missionsForDate(dateKey: string): DailyMissionProgress {
  return {
    dateKey,
    missions: DAILY_MISSIONS.map((m): DailyMissionProgressEntry => ({
      id: m.id,
      current: 0,
      completed: false,
      rewarded: false,
    })),
  };
}

export type MissionSessionInput = Pick<GameSession, "solved" | "perfectSolved" | "completedAt">;

export interface ApplyMissionsResult {
  mission: DailyMissionProgress;
  /** 今回新たに付与する報酬 XP の合計 */
  rewardXP: number;
  newlyCompleted: DailyMissionId[];
}

function sessionIncrement(id: DailyMissionId, session: MissionSessionInput): number {
  switch (id) {
    case "play_once":
      return session.completedAt !== null ? 1 : 0;
    case "solve_10":
      return session.solved;
    case "perfect_5":
      return session.perfectSolved;
  }
}

/**
 * セッション結果をミッション進捗に反映する（§8.2）。
 * 複数プレイにまたがって累積し、報酬は 1 日 1 回のみ付与する。
 */
export function applySessionToMissions(
  mission: DailyMissionProgress,
  session: MissionSessionInput,
): ApplyMissionsResult {
  let rewardXP = 0;
  const newlyCompleted: DailyMissionId[] = [];
  const missions = mission.missions.map((entry): DailyMissionProgressEntry => {
    const def = DAILY_MISSIONS.find((m) => m.id === entry.id);
    if (!def) return entry;
    const current = entry.current + sessionIncrement(entry.id, session);
    const completed = current >= def.target;
    let rewarded = entry.rewarded;
    if (completed && !rewarded) {
      rewarded = true;
      rewardXP += def.rewardXP;
      newlyCompleted.push(entry.id);
    }
    return { id: entry.id, current, completed, rewarded };
  });
  return { mission: { dateKey: mission.dateKey, missions }, rewardXP, newlyCompleted };
}

/** 保存済み進捗が今日のものでなければ新しい進捗を返す（0 時で更新） */
export function resolveMissionForDate(
  stored: DailyMissionProgress | undefined,
  todayKey: string,
): DailyMissionProgress {
  return stored && stored.dateKey === todayKey ? stored : missionsForDate(todayKey);
}
