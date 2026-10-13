import { describe, expect, it } from "vitest";
import {
  DAILY_MISSIONS,
  applySessionToMissions,
  localDateKey,
  missionsForDate,
  previousDateKey,
  resolveMissionForDate,
  updateStreak,
} from "./habit";

describe("localDateKey (§8.1)", () => {
  it("formats local date as YYYY-MM-DD with zero padding", () => {
    expect(localDateKey(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
    expect(localDateKey(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
    expect(localDateKey(new Date(2026, 9, 5, 12))).toBe("2026-10-05");
  });
});

describe("previousDateKey", () => {
  it("goes back one day across month and year boundaries", () => {
    expect(previousDateKey("2026-10-13")).toBe("2026-10-12");
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDateKey("2024-03-01")).toBe("2024-02-29");
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
  });
});

describe("updateStreak (§8.1)", () => {
  const base = { currentStreak: 3, longestStreak: 5, lastPlayedDate: "2026-10-12" };

  it("does not change on the same day", () => {
    expect(updateStreak({ ...base, lastPlayedDate: "2026-10-13" }, "2026-10-13")).toEqual({
      currentStreak: 3,
      longestStreak: 5,
      lastPlayedDate: "2026-10-13",
    });
  });

  it("increments when last played yesterday", () => {
    expect(updateStreak(base, "2026-10-13")).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      lastPlayedDate: "2026-10-13",
    });
  });

  it("resets to 1 after a gap", () => {
    expect(updateStreak(base, "2026-10-15").currentStreak).toBe(1);
  });

  it("starts at 1 when never played", () => {
    expect(
      updateStreak({ currentStreak: 0, longestStreak: 0, lastPlayedDate: null }, "2026-10-13"),
    ).toEqual({ currentStreak: 1, longestStreak: 1, lastPlayedDate: "2026-10-13" });
  });

  it("updates longestStreak when exceeded", () => {
    expect(updateStreak({ ...base, currentStreak: 5 }, "2026-10-13").longestStreak).toBe(6);
  });
});

describe("daily missions (§8.2)", () => {
  it("defines three missions with spec rewards", () => {
    expect(DAILY_MISSIONS.map((m) => [m.id, m.target, m.rewardXP])).toEqual([
      ["play_once", 1, 20],
      ["solve_10", 10, 30],
      ["perfect_5", 5, 30],
    ]);
  });

  it("creates fresh progress for a date", () => {
    const p = missionsForDate("2026-10-13");
    expect(p.dateKey).toBe("2026-10-13");
    expect(p.missions).toHaveLength(3);
    expect(p.missions.every((m) => m.current === 0 && !m.completed && !m.rewarded)).toBe(true);
  });

  it("accumulates across multiple plays and rewards once", () => {
    const first = applySessionToMissions(missionsForDate("2026-10-13"), {
      solved: 6,
      perfectSolved: 3,
      completedAt: "2026-10-13T10:00:00.000Z",
    });
    expect(first.rewardXP).toBe(20);
    expect(first.newlyCompleted).toEqual(["play_once"]);

    const second = applySessionToMissions(first.mission, {
      solved: 6,
      perfectSolved: 3,
      completedAt: "2026-10-13T11:00:00.000Z",
    });
    expect(second.rewardXP).toBe(60);
    expect(second.newlyCompleted).toEqual(["solve_10", "perfect_5"]);
    expect(second.mission.missions.find((m) => m.id === "play_once")?.current).toBe(2);
    expect(second.mission.missions.find((m) => m.id === "solve_10")?.current).toBe(12);

    const third = applySessionToMissions(second.mission, {
      solved: 10,
      perfectSolved: 10,
      completedAt: "2026-10-13T12:00:00.000Z",
    });
    expect(third.rewardXP).toBe(0);
    expect(third.newlyCompleted).toEqual([]);
    expect(third.mission.missions.every((m) => m.completed && m.rewarded)).toBe(true);
  });

  it("does not count an aborted session as a play", () => {
    const r = applySessionToMissions(missionsForDate("2026-10-13"), {
      solved: 10,
      perfectSolved: 0,
      completedAt: null,
    });
    expect(r.mission.missions.find((m) => m.id === "play_once")?.current).toBe(0);
    expect(r.newlyCompleted).toEqual(["solve_10"]);
    expect(r.rewardXP).toBe(30);
  });

  it("does not mutate the input mission", () => {
    const input = missionsForDate("2026-10-13");
    applySessionToMissions(input, { solved: 1, perfectSolved: 1, completedAt: "x" });
    expect(input.missions[0].current).toBe(0);
  });

  it("resolves a new progress when the date changes", () => {
    const stored = applySessionToMissions(missionsForDate("2026-10-12"), {
      solved: 1,
      perfectSolved: 0,
      completedAt: "x",
    }).mission;
    expect(resolveMissionForDate(stored, "2026-10-12")).toBe(stored);
    const next = resolveMissionForDate(stored, "2026-10-13");
    expect(next.dateKey).toBe("2026-10-13");
    expect(next.missions.every((m) => m.current === 0)).toBe(true);
    expect(resolveMissionForDate(undefined, "2026-10-13").dateKey).toBe("2026-10-13");
  });
});
