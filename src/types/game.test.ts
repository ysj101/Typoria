import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BASE_SCORE,
  COMBO_MULTIPLIERS,
  COUNTDOWN_MS,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  FEVER_COMBO,
  GAME_DURATION_MS,
  STAR_THRESHOLDS,
  type Difficulty,
  type GameState,
  type Settings,
  type UserProgress,
} from "./game";

describe("game constants (§3, §6, §13)", () => {
  it("uses 90 seconds per game and a 3 second countdown", () => {
    expect(GAME_DURATION_MS).toBe(90_000);
    expect(COUNTDOWN_MS).toBe(3_000);
  });

  it("starts FEVER at 10 combo", () => {
    expect(FEVER_COMBO).toBe(10);
  });

  it("defines base scores per difficulty (§6.1)", () => {
    expect(BASE_SCORE).toEqual({ easy: 100, normal: 150, hard: 200 });
  });

  it("orders combo multipliers and star thresholds descending", () => {
    const combos = COMBO_MULTIPLIERS.map((c) => c.minCombo);
    expect(combos).toEqual([...combos].sort((a, b) => b - a));
    const rates = STAR_THRESHOLDS.map((s) => s.minRate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });

  it("lists difficulties from easy to hard", () => {
    expect(DIFFICULTIES).toEqual(["easy", "normal", "hard"]);
  });
});

describe("DEFAULT_SETTINGS (§4.5)", () => {
  it("matches the spec initial values", () => {
    expect(DEFAULT_SETTINGS).toEqual<Settings>({
      sfxEnabled: true,
      sfxVolume: 70,
      bgmEnabled: true,
      bgmVolume: 40,
      screenShake: "weak",
      particles: true,
      difficultyMode: "auto",
    });
  });
});

describe("DEFAULT_PROGRESS (§12.3)", () => {
  it("starts with no history", () => {
    expect(DEFAULT_PROGRESS).toEqual<UserProgress>({
      totalXP: 0,
      totalSessions: 0,
      bestScore: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedDate: null,
      currentDifficulty: "easy",
    });
  });
});

describe("types", () => {
  it("restricts Difficulty and GameState to the spec unions", () => {
    expectTypeOf<Difficulty>().toEqualTypeOf<"easy" | "normal" | "hard">();
    expectTypeOf<GameState>().toEqualTypeOf<
      "IDLE" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "FINISHED" | "RESULT"
    >();
  });
});
