/**
 * 学習履歴の集計（docs/spec.md §4.4）。React 非依存の純関数。
 */
import {
  DIFFICULTIES,
  GAME_DURATION_MS,
  type Difficulty,
  type GameSession,
  type UserProgress,
} from "../types/game";
import { localDateKey, previousDateKey } from "./habit";
import { calcStars } from "./scoring";

export interface DayActivity {
  /** `YYYY-MM-DD`（端末ローカル） */
  dateKey: string;
  count: number;
}

export interface DifficultyAccuracy {
  sessions: number;
  /** solved / (solved + skipped) の合計ベース。分母 0 は 0 */
  accuracy: number;
}

export interface RecentSession {
  id: string;
  startedAt: string;
  difficulty: Difficulty;
  score: number;
  stars: number;
}

export interface HistorySummary {
  totalSessions: number;
  totalPlayTimeMs: number;
  totalXP: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  /** 古い → 今日の順で 7 件 */
  last7Days: DayActivity[];
  accuracyByDifficulty: Record<Difficulty, DifficultyAccuracy>;
  /** 直近 10 件、startedAt 降順 */
  recent: RecentSession[];
}

export const RECENT_LIMIT = 10;
const DAYS = 7;

function sessionPlayTime(session: GameSession): number {
  if (session.completedAt !== null) return GAME_DURATION_MS;
  return session.results.reduce((sum, r) => sum + r.durationMs, 0);
}

export function summarizeSessions(
  sessions: GameSession[],
  progress: UserProgress,
  today: Date,
): HistorySummary {
  const keys: string[] = [];
  let key = localDateKey(today);
  for (let i = 0; i < DAYS; i++) {
    keys.unshift(key);
    key = previousDateKey(key);
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const s of sessions) {
    const k = localDateKey(new Date(s.startedAt));
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const totals = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, { sessions: 0, solved: 0, skipped: 0 }]),
  ) as Record<Difficulty, { sessions: number; solved: number; skipped: number }>;
  for (const s of sessions) {
    const t = totals[s.difficulty];
    t.sessions += 1;
    t.solved += s.solved;
    t.skipped += s.skipped;
  }
  const accuracyByDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => {
      const t = totals[d];
      const denom = t.solved + t.skipped;
      return [d, { sessions: t.sessions, accuracy: denom === 0 ? 0 : t.solved / denom }];
    }),
  ) as Record<Difficulty, DifficultyAccuracy>;

  const recent = [...sessions]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
    .slice(0, RECENT_LIMIT)
    .map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      difficulty: s.difficulty,
      score: s.score,
      stars: calcStars(s),
    }));

  return {
    totalSessions: progress.totalSessions,
    totalPlayTimeMs: sessions.reduce((sum, s) => sum + sessionPlayTime(s), 0),
    totalXP: progress.totalXP,
    bestScore: progress.bestScore,
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    last7Days: keys.map((k) => ({ dateKey: k, count: counts.get(k) ?? 0 })),
    accuracyByDifficulty,
    recent,
  };
}

/** "1時間23分" / "5分" */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}時間${rest}分` : `${rest}分`;
}

/** "10/13 20:05"（端末ローカル） */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
