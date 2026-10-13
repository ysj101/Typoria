import { describe, expect, it } from "vitest";
import { makeQuestionResult, makeSession } from "../test/factories";
import { DEFAULT_PROGRESS, GAME_DURATION_MS, type UserProgress } from "../types/game";
import { formatDateTime, formatDuration, summarizeSessions } from "./stats";

const today = new Date(2026, 9, 13, 20, 0, 0); // 2026-10-13 ローカル

function localIso(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

describe("summarizeSessions (§4.4)", () => {
  it("handles empty data", () => {
    const s = summarizeSessions([], DEFAULT_PROGRESS, today);
    expect(s.totalSessions).toBe(0);
    expect(s.totalPlayTimeMs).toBe(0);
    expect(s.last7Days).toHaveLength(7);
    expect(s.last7Days.every((d) => d.count === 0)).toBe(true);
    expect(s.last7Days[6].dateKey).toBe("2026-10-13");
    expect(s.last7Days[0].dateKey).toBe("2026-10-07");
    expect(s.accuracyByDifficulty.easy).toEqual({ sessions: 0, accuracy: 0 });
    expect(s.recent).toEqual([]);
  });

  it("takes totals and streak from progress", () => {
    const progress: UserProgress = {
      ...DEFAULT_PROGRESS,
      totalSessions: 12,
      totalXP: 345,
      bestScore: 9999,
      currentStreak: 3,
      longestStreak: 7,
    };
    const s = summarizeSessions([], progress, today);
    expect(s).toMatchObject({
      totalSessions: 12,
      totalXP: 345,
      bestScore: 9999,
      currentStreak: 3,
      longestStreak: 7,
    });
  });

  it("counts play time: completed = GAME_DURATION_MS, aborted = sum of results", () => {
    const sessions = [
      makeSession({ id: "a", completedAt: "x" }),
      makeSession({
        id: "b",
        completedAt: null,
        results: [
          makeQuestionResult({ durationMs: 1_000 }),
          makeQuestionResult({ durationMs: 2_500 }),
        ],
      }),
    ];
    expect(summarizeSessions(sessions, DEFAULT_PROGRESS, today).totalPlayTimeMs).toBe(
      GAME_DURATION_MS + 3_500,
    );
  });

  it("aggregates the last 7 days by local date, ignoring older sessions", () => {
    const sessions = [
      makeSession({ id: "1", startedAt: localIso(2026, 10, 13, 9) }),
      makeSession({ id: "2", startedAt: localIso(2026, 10, 13, 21) }),
      makeSession({ id: "3", startedAt: localIso(2026, 10, 7, 0) }),
      makeSession({ id: "4", startedAt: localIso(2026, 10, 6, 23) }),
    ];
    const s = summarizeSessions(sessions, DEFAULT_PROGRESS, today);
    expect(s.last7Days[6]).toEqual({ dateKey: "2026-10-13", count: 2 });
    expect(s.last7Days[0]).toEqual({ dateKey: "2026-10-07", count: 1 });
    expect(s.last7Days.reduce((a, d) => a + d.count, 0)).toBe(3);
  });

  it("computes accuracy per difficulty from solved / (solved + skipped) totals", () => {
    const sessions = [
      makeSession({ id: "1", difficulty: "easy", solved: 8, skipped: 2 }),
      makeSession({ id: "2", difficulty: "easy", solved: 10, skipped: 0 }),
      makeSession({ id: "3", difficulty: "hard", solved: 0, skipped: 0 }),
    ];
    const s = summarizeSessions(sessions, DEFAULT_PROGRESS, today);
    expect(s.accuracyByDifficulty.easy).toEqual({ sessions: 2, accuracy: 0.9 });
    expect(s.accuracyByDifficulty.normal).toEqual({ sessions: 0, accuracy: 0 });
    expect(s.accuracyByDifficulty.hard).toEqual({ sessions: 1, accuracy: 0 });
  });

  it("lists the 10 most recent sessions in descending order with stars", () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSession({
        id: `s${i}`,
        startedAt: localIso(2026, 10, 1 + i),
        score: i * 100,
        solved: 10,
        correctKeystrokes: 100,
      }),
    );
    const s = summarizeSessions(sessions, DEFAULT_PROGRESS, today);
    expect(s.recent).toHaveLength(10);
    expect(s.recent[0].id).toBe("s11");
    expect(s.recent[9].id).toBe("s2");
    expect(s.recent[0]).toMatchObject({ difficulty: "normal", score: 1100, stars: 5 });
  });
});

describe("formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("0分");
    expect(formatDuration(5 * 60_000)).toBe("5分");
    expect(formatDuration(83 * 60_000)).toBe("1時間23分");
    expect(formatDuration(90_000)).toBe("1分");
  });

  it("formatDateTime", () => {
    expect(formatDateTime(new Date(2026, 9, 13, 20, 5).toISOString())).toBe("10/13 20:05");
  });
});
