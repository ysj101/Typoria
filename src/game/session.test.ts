import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type TyporiaDatabase } from "../storage/database";
import { makeQuestionResult, makeSession } from "../test/factories";
import { DEFAULT_SETTINGS, type GameSession } from "../types/game";
import { accumulateQuestionStats, applySessionResult } from "./session";

let counter = 0;
let db: TyporiaDatabase;

/** ローカル 2026-10-13 12:00 */
const day1 = () => new Date(2026, 9, 13, 12, 0, 0);
const day2 = () => new Date(2026, 9, 14, 12, 0, 0);
const day4 = () => new Date(2026, 9, 16, 12, 0, 0);

beforeEach(() => {
  db = openDatabase(`typoria-session-test-${Date.now()}-${counter++}`);
});

let sessionSeq = 0;

function goodSession(overrides: Partial<GameSession> = {}): GameSession {
  // 10 問正解・PERFECT 5 回、平均 3 秒 → 難易度は上がる
  const results = Array.from({ length: 10 }, (_, i) =>
    makeQuestionResult({
      questionId: `normal-00${i % 3}`,
      durationMs: 3_000,
      incorrectKeystrokes: i < 5 ? 0 : 1,
      perfect: i < 5,
    }),
  );
  return makeSession({
    id: `s-${sessionSeq++}`,
    difficulty: "normal",
    score: 1500,
    solved: 10,
    skipped: 0,
    perfectSolved: 5,
    correctKeystrokes: 50,
    incorrectKeystrokes: 5,
    results,
    ...overrides,
  });
}

describe("applySessionResult (§6.6, §8, AC-10〜13)", () => {
  it("saves the session and fills xpEarned", async () => {
    const result = await applySessionResult(goodSession(), { db, now: day1 });
    const stored = await db.listSessions();
    expect(stored).toHaveLength(1);
    // 20 + 10*5 + 5*2 = 80
    expect(result.xpEarned).toBe(80);
    expect(stored[0].xpEarned).toBe(80);
  });

  it("updates XP, totalSessions, bestScore and reports a new record", async () => {
    const result = await applySessionResult(goodSession(), { db, now: day1 });
    expect(result.isNewRecord).toBe(true);
    // 80 + play_once 20 + solve_10 30 + perfect_5 30 = 160
    expect(result.progress.totalXP).toBe(160);
    expect(result.progress.totalSessions).toBe(1);
    expect(result.progress.bestScore).toBe(1500);
    expect(result.missionRewards.map((m) => m.id).sort()).toEqual([
      "perfect_5",
      "play_once",
      "solve_10",
    ]);
    expect(await db.getProgress()).toEqual(result.progress);
  });

  it("is not a new record when the score does not exceed the best", async () => {
    await applySessionResult(goodSession({ score: 1500 }), { db, now: day1 });
    const second = await applySessionResult(goodSession({ score: 1500 }), { db, now: day1 });
    expect(second.isNewRecord).toBe(false);
    expect(second.progress.bestScore).toBe(1500);
  });

  it("awards mission rewards only once per day", async () => {
    await applySessionResult(goodSession(), { db, now: day1 });
    const second = await applySessionResult(goodSession(), { db, now: day1 });
    expect(second.missionRewards).toEqual([]);
    // 160 + 80 = 240
    expect(second.progress.totalXP).toBe(240);
    expect(second.mission.missions.every((m) => m.rewarded)).toBe(true);
  });

  it("accumulates missions across plays on the same day", async () => {
    const small = () => goodSession({ solved: 6, perfectSolved: 2, results: [] });
    const first = await applySessionResult(small(), { db, now: day1 });
    expect(first.missionRewards.map((m) => m.id)).toEqual(["play_once"]);
    const second = await applySessionResult(small(), { db, now: day1 });
    expect(second.missionRewards.map((m) => m.id)).toEqual(["solve_10"]);
  });

  it("increments streak on consecutive days and keeps it on the same day", async () => {
    const a = await applySessionResult(goodSession(), { db, now: day1 });
    expect(a.streak).toBe(1);
    const b = await applySessionResult(goodSession(), { db, now: day1 });
    expect(b.streak).toBe(1);
    const c = await applySessionResult(goodSession(), { db, now: day2 });
    expect(c.streak).toBe(2);
    expect(c.progress.longestStreak).toBe(2);
    expect(c.progress.lastPlayedDate).toBe("2026-10-14");
    const d = await applySessionResult(goodSession(), { db, now: day4 });
    expect(d.streak).toBe(1);
    expect(d.progress.longestStreak).toBe(2);
  });

  it("starts a fresh mission progress on a new day", async () => {
    await applySessionResult(goodSession(), { db, now: day1 });
    const next = await applySessionResult(goodSession(), { db, now: day2 });
    expect(next.mission.dateKey).toBe("2026-10-14");
    expect(next.missionRewards).toHaveLength(3);
  });

  it("accumulates question stats across sessions", async () => {
    await applySessionResult(goodSession(), { db, now: day1 });
    await applySessionResult(
      goodSession({
        results: [
          makeQuestionResult({ questionId: "normal-000", status: "skipped", correctKeystrokes: 1 }),
          makeQuestionResult({ questionId: "normal-000", status: "timeout", correctKeystrokes: 2 }),
        ],
      }),
      { db, now: day2 },
    );
    const stat = await db.getQuestionStat("normal-000");
    // 1st session: i=0,3,6,9 → 4 attempts; 2nd: 2 attempts
    expect(stat).toMatchObject({ attempts: 6, solved: 4, skipped: 1 });
    expect(stat?.correctKeystrokes).toBe(4 * 5 + 1 + 2);
    expect(stat?.lastAttemptedAt).toBe(day2().toISOString());
  });

  it("applies auto difficulty adjustment", async () => {
    const result = await applySessionResult(goodSession(), { db, now: day1 });
    expect(result.nextDifficulty).toBe("hard");
    expect(result.progress.currentDifficulty).toBe("hard");
  });

  it("respects a fixed difficulty setting", async () => {
    await db.putSettings({ ...DEFAULT_SETTINGS, difficultyMode: "easy" });
    const result = await applySessionResult(goodSession(), { db, now: day1 });
    expect(result.nextDifficulty).toBe("easy");
  });

  it("only saves an aborted session without granting XP or progress", async () => {
    const result = await applySessionResult(goodSession({ completedAt: null, xpEarned: 0 }), {
      db,
      now: day1,
    });
    expect(result.xpEarned).toBe(0);
    expect(result.isNewRecord).toBe(false);
    expect(result.missionRewards).toEqual([]);
    const progress = await db.getProgress();
    expect(progress.totalXP).toBe(0);
    expect(progress.totalSessions).toBe(0);
    expect(progress.currentStreak).toBe(0);
    expect(progress.lastPlayedDate).toBeNull();
    expect(await db.listSessions()).toHaveLength(1);
    expect(await db.getMission("2026-10-13")).toBeUndefined();
    // 統計は更新される
    expect((await db.getQuestionStat("normal-000"))?.attempts).toBe(4);
  });
});

describe("accumulateQuestionStats", () => {
  it("counts timeout as an attempt without solved/skipped", () => {
    const stats = accumulateQuestionStats(
      [],
      [makeQuestionResult({ questionId: "q", status: "timeout", incorrectKeystrokes: 2 })],
      "2026-10-13T00:00:00.000Z",
    );
    expect(stats).toEqual([
      {
        questionId: "q",
        attempts: 1,
        solved: 0,
        skipped: 0,
        correctKeystrokes: 5,
        incorrectKeystrokes: 2,
        lastAttemptedAt: "2026-10-13T00:00:00.000Z",
      },
    ]);
  });
});
