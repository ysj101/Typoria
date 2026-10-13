import { describe, expect, it } from "vitest";
import { makeSession } from "../test/factories";
import {
  baseScore,
  calcQuestionScore,
  calcStars,
  calcXp,
  comboMultiplier,
  isFeverActive,
  isPerfect,
  overallRate,
  problemAccuracy,
  typingAccuracy,
} from "./scoring";

describe("baseScore (§6.1)", () => {
  it.each([
    ["easy", 100],
    ["normal", 150],
    ["hard", 200],
  ] as const)("%s → %d", (difficulty, expected) => {
    expect(baseScore(difficulty)).toBe(expected);
  });
});

describe("comboMultiplier (§6.2)", () => {
  it.each([
    [-1, 1.0],
    [0, 1.0],
    [1, 1.0],
    [4, 1.0],
    [5, 1.2],
    [9, 1.2],
    [10, 1.5],
    [19, 1.5],
    [20, 2.0],
    [21, 2.0],
  ])("combo %d → x%s", (combo, expected) => {
    expect(comboMultiplier(combo)).toBe(expected);
  });
});

describe("calcQuestionScore (§6.3)", () => {
  it("Normal・10 コンボ目・PERFECT → 255", () => {
    expect(calcQuestionScore({ difficulty: "normal", combo: 10, incorrectKeystrokes: 0 })).toBe(
      255,
    );
  });

  it("adds no bonus when there were incorrect keystrokes", () => {
    expect(calcQuestionScore({ difficulty: "normal", combo: 10, incorrectKeystrokes: 1 })).toBe(
      225,
    );
  });

  it("floors the multiplied base without floating point drift", () => {
    expect(calcQuestionScore({ difficulty: "easy", combo: 5, incorrectKeystrokes: 2 })).toBe(120);
    expect(calcQuestionScore({ difficulty: "hard", combo: 5, incorrectKeystrokes: 2 })).toBe(240);
  });

  it("uses x1.0 at combo 1", () => {
    expect(calcQuestionScore({ difficulty: "hard", combo: 1, incorrectKeystrokes: 0 })).toBe(230);
  });
});

describe("isPerfect / isFeverActive (§5.3, §6.4)", () => {
  it("is perfect only with zero incorrect keystrokes", () => {
    expect(isPerfect(0)).toBe(true);
    expect(isPerfect(1)).toBe(false);
  });

  it("starts FEVER at 10 combo", () => {
    expect(isFeverActive(9)).toBe(false);
    expect(isFeverActive(10)).toBe(true);
    expect(isFeverActive(25)).toBe(true);
  });
});

describe("accuracy (§6.5)", () => {
  it("problemAccuracy ignores timeout (only solved + skipped)", () => {
    expect(problemAccuracy(makeSession({ solved: 8, skipped: 2 }))).toBe(0.8);
  });

  it("problemAccuracy is 0 when the denominator is 0", () => {
    expect(problemAccuracy(makeSession({ solved: 0, skipped: 0 }))).toBe(0);
  });

  it("typingAccuracy uses keystrokes", () => {
    expect(typingAccuracy(makeSession({ correctKeystrokes: 90, incorrectKeystrokes: 10 }))).toBe(
      0.9,
    );
  });

  it("typingAccuracy is 0 when the denominator is 0", () => {
    expect(typingAccuracy(makeSession({ correctKeystrokes: 0, incorrectKeystrokes: 0 }))).toBe(0);
  });

  it("overallRate weights 0.6 / 0.4", () => {
    const session = makeSession({
      solved: 5,
      skipped: 5,
      correctKeystrokes: 100,
      incorrectKeystrokes: 0,
    });
    expect(overallRate(session)).toBeCloseTo(0.5 * 0.6 + 1 * 0.4, 10);
  });
});

describe("calcStars (§6.5)", () => {
  /** 問題正答率 1.0 に固定し、タイピング正確率で総合率を狙う */
  const withOverall = (overall: number) => {
    const typing = (overall - 0.6) / 0.4;
    const total = 10_000;
    const correct = Math.round(typing * total);
    return makeSession({
      solved: 10,
      skipped: 0,
      correctKeystrokes: correct,
      incorrectKeystrokes: total - correct,
    });
  };

  it.each([
    [1.0, 5],
    [0.95, 5],
    [0.9499, 4],
    [0.9, 4],
    [0.8999, 3],
    [0.8, 3],
    [0.7999, 2],
    [0.7, 2],
    [0.6999, 1],
    [0.61, 1],
  ])("overall %s → %d stars", (overall, stars) => {
    expect(calcStars(withOverall(overall))).toBe(stars);
  });

  it("returns 0 stars when nothing was solved", () => {
    expect(calcStars(makeSession({ solved: 0, skipped: 0, correctKeystrokes: 10 }))).toBe(0);
    expect(calcStars(makeSession({ solved: 0, skipped: 3 }))).toBe(0);
  });

  it("gives 1 star even at 0 typing accuracy as long as something was solved", () => {
    expect(
      calcStars(
        makeSession({ solved: 1, skipped: 9, correctKeystrokes: 0, incorrectKeystrokes: 0 }),
      ),
    ).toBe(1);
  });
});

describe("calcXp (§6.6)", () => {
  it("= 20 + solved * 5 + perfectSolved * 2", () => {
    expect(calcXp(makeSession({ solved: 10, perfectSolved: 4 }))).toBe(20 + 50 + 8);
  });

  it("gives the base 20 XP for a completed session with no solves", () => {
    expect(calcXp(makeSession({ solved: 0, perfectSolved: 0 }))).toBe(20);
  });

  it("gives 0 XP for an aborted session", () => {
    expect(calcXp(makeSession({ completedAt: null, solved: 10, perfectSolved: 4 }))).toBe(0);
  });
});
