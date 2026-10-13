import { describe, expect, it } from "vitest";
import type { Difficulty, QuestionResult } from "../types/game";
import { nextDifficulty, resolveDifficulty, stepDifficulty } from "./difficulty";

/** solved / skipped 件数と solved の平均回答時間から session fixture を作る */
function makeSession(solved: number, skipped: number, avgDurationMs = 3000) {
  const results: QuestionResult[] = [];
  for (let i = 0; i < solved; i++) {
    results.push({
      questionId: `q-${i}`,
      status: "solved",
      durationMs: avgDurationMs,
      correctKeystrokes: 5,
      incorrectKeystrokes: 0,
      perfect: true,
    });
  }
  for (let i = 0; i < skipped; i++) {
    results.push({
      questionId: `s-${i}`,
      status: "skipped",
      durationMs: 1000,
      correctKeystrokes: 0,
      incorrectKeystrokes: 0,
      perfect: false,
    });
  }
  // timeout は分母に含めないことを確かめるため常に 1 件混ぜる
  results.push({
    questionId: "t-0",
    status: "timeout",
    durationMs: 99_999,
    correctKeystrokes: 1,
    incorrectKeystrokes: 1,
    perfect: false,
  });
  return { solved, skipped, results };
}

const auto = { difficultyMode: "auto" as const };

describe("stepDifficulty", () => {
  it("moves one step and clamps at both ends", () => {
    expect(stepDifficulty("easy", 1)).toBe("normal");
    expect(stepDifficulty("normal", 1)).toBe("hard");
    expect(stepDifficulty("hard", 1)).toBe("hard");
    expect(stepDifficulty("hard", -1)).toBe("normal");
    expect(stepDifficulty("normal", -1)).toBe("easy");
    expect(stepDifficulty("easy", -1)).toBe("easy");
    expect(stepDifficulty("normal", 0)).toBe("normal");
  });
});

describe("nextDifficulty (§7.2)", () => {
  it("goes up when accuracy >= 90% and average time <= 5000ms", () => {
    expect(nextDifficulty("normal", makeSession(9, 1, 5000), auto)).toBe("hard");
    expect(nextDifficulty("easy", makeSession(10, 0, 100), auto)).toBe("normal");
  });

  it("keeps the level when accuracy >= 90% but average time > 5000ms", () => {
    expect(nextDifficulty("normal", makeSession(9, 1, 5001), auto)).toBe("normal");
  });

  it("keeps the level when accuracy is just under 90%", () => {
    // 89 / 100 = 0.89
    expect(nextDifficulty("normal", makeSession(89, 11, 1000), auto)).toBe("normal");
  });

  it("keeps the level at exactly 70%", () => {
    expect(nextDifficulty("normal", makeSession(7, 3, 1000), auto)).toBe("normal");
  });

  it("goes down when accuracy is under 70%", () => {
    // 69 / 100 = 0.69
    expect(nextDifficulty("normal", makeSession(69, 31, 1000), auto)).toBe("easy");
    expect(nextDifficulty("hard", makeSession(1, 1, 1000), auto)).toBe("normal");
  });

  it("goes down when nothing was solved", () => {
    expect(nextDifficulty("normal", makeSession(0, 5), auto)).toBe("easy");
  });

  it("goes down when the denominator is 0 (no solved, no skipped)", () => {
    expect(nextDifficulty("hard", makeSession(0, 0), auto)).toBe("normal");
  });

  it("clamps: hard stays hard on promotion, easy stays easy on demotion", () => {
    expect(nextDifficulty("hard", makeSession(10, 0, 1000), auto)).toBe("hard");
    expect(nextDifficulty("easy", makeSession(0, 10), auto)).toBe("easy");
  });

  it("returns the fixed difficulty when the mode is not auto", () => {
    const modes: Difficulty[] = ["easy", "normal", "hard"];
    for (const mode of modes) {
      expect(nextDifficulty("normal", makeSession(10, 0, 100), { difficultyMode: mode })).toBe(
        mode,
      );
      expect(nextDifficulty("normal", makeSession(0, 10), { difficultyMode: mode })).toBe(mode);
    }
  });
});

describe("resolveDifficulty", () => {
  it("uses the progress value in auto mode", () => {
    expect(resolveDifficulty("auto", { currentDifficulty: "hard" })).toBe("hard");
  });

  it("uses the fixed value otherwise", () => {
    expect(resolveDifficulty("easy", { currentDifficulty: "hard" })).toBe("easy");
  });
});
