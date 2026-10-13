import { describe, expect, it } from "vitest";
import type { Question, QuestionStat } from "../types/game";
import { createQuestionPicker, createSeededRng, selectWeakQuestions } from "./questions";

function q(id: string, type: Question["type"], difficulty: Question["difficulty"]): Question {
  return { id, type, difficulty, japanese: "j", english: "e", answer: "a", tags: [] };
}

function fixture(): Question[] {
  const list: Question[] = [];
  for (const d of ["easy", "normal", "hard"] as const) {
    for (let i = 0; i < 3; i++) list.push(q(`${d}-w${i}`, "word", d));
    for (let i = 0; i < 7; i++) list.push(q(`${d}-f${i}`, "fill_blank", d));
  }
  return list;
}

function stat(partial: Partial<QuestionStat> & { questionId: string }): QuestionStat {
  return {
    attempts: 0,
    solved: 0,
    skipped: 0,
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
    lastAttemptedAt: null,
    ...partial,
  };
}

describe("createSeededRng", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createQuestionPicker (§13.3)", () => {
  it("only picks questions of the current difficulty", () => {
    const picker = createQuestionPicker({
      questions: fixture(),
      difficulty: "normal",
      rng: createSeededRng(1),
    });
    for (let i = 0; i < 30; i++) expect(picker.next().difficulty).toBe("normal");
  });

  it("falls back to all questions when the difficulty has none", () => {
    const only = fixture().filter((x) => x.difficulty === "easy");
    const picker = createQuestionPicker({
      questions: only,
      difficulty: "hard",
      rng: createSeededRng(1),
    });
    expect(picker.next().difficulty).toBe("easy");
  });

  it("does not repeat a question until the pool is exhausted", () => {
    const picker = createQuestionPicker({
      questions: fixture(),
      difficulty: "easy",
      rng: createSeededRng(7),
    });
    const ids = Array.from({ length: 10 }, () => picker.next().id);
    expect(new Set(ids).size).toBe(10);
  });

  it("does not re-ask skipped questions within the pool", () => {
    const picker = createQuestionPicker({
      questions: fixture(),
      difficulty: "easy",
      rng: createSeededRng(3),
    });
    const first = picker.next();
    picker.markSkipped(first.id);
    const rest = Array.from({ length: 9 }, () => picker.next().id);
    expect(rest).not.toContain(first.id);
    expect(new Set(rest).size).toBe(9);
  });

  it("asks weak questions of the current difficulty first", () => {
    const picker = createQuestionPicker({
      questions: fixture(),
      difficulty: "easy",
      weakQuestionIds: ["easy-f2", "easy-w1", "hard-f0"],
      rng: createSeededRng(5),
    });
    const firstTwo = [picker.next().id, picker.next().id].sort();
    expect(firstTwo).toEqual(["easy-f2", "easy-w1"]);
    expect(["easy-f2", "easy-w1"]).not.toContain(picker.next().id);
  });

  it("draws word : fill_blank at roughly 3 : 7", () => {
    const questions: Question[] = [];
    for (let i = 0; i < 300; i++) questions.push(q(`easy-w${i}`, "word", "easy"));
    for (let i = 0; i < 700; i++) questions.push(q(`easy-f${i}`, "fill_blank", "easy"));
    const picker = createQuestionPicker({
      questions,
      difficulty: "easy",
      rng: createSeededRng(11),
    });
    let words = 0;
    const n = 500;
    for (let i = 0; i < n; i++) if (picker.next().type === "word") words++;
    expect(words / n).toBeGreaterThan(0.2);
    expect(words / n).toBeLessThan(0.4);
  });

  it("serves the other type when one type runs out", () => {
    const questions = [
      q("easy-w0", "word", "easy"),
      ...[0, 1, 2, 3, 4].map((i) => q(`easy-f${i}`, "fill_blank", "easy")),
    ];
    const picker = createQuestionPicker({ questions, difficulty: "easy", rng: createSeededRng(2) });
    const ids = Array.from({ length: 6 }, () => picker.next().id);
    expect(new Set(ids).size).toBe(6);
  });

  it("reshuffles and reuses questions after exhausting the pool without immediate repeat", () => {
    const questions = [
      q("easy-w0", "word", "easy"),
      q("easy-f0", "fill_blank", "easy"),
      q("easy-f1", "fill_blank", "easy"),
    ];
    const picker = createQuestionPicker({ questions, difficulty: "easy", rng: createSeededRng(9) });
    const ids = Array.from({ length: 30 }, () => picker.next().id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(new Set(ids).size).toBe(3);
  });

  it("uses only the injected rng", () => {
    let calls = 0;
    const rng = () => {
      calls++;
      return 0.5;
    };
    const picker = createQuestionPicker({ questions: fixture(), difficulty: "easy", rng });
    picker.next();
    expect(calls).toBeGreaterThan(0);
  });

  it("throws when there are no questions", () => {
    expect(() => createQuestionPicker({ questions: [], difficulty: "easy" })).toThrow();
  });
});

describe("selectWeakQuestions (§7.3)", () => {
  it("returns questions with skip history", () => {
    expect(
      selectWeakQuestions([stat({ questionId: "a", attempts: 1, solved: 1, skipped: 1 })]),
    ).toEqual(["a"]);
  });

  it("returns questions with 3 or more incorrect keystrokes per attempt (boundary inclusive)", () => {
    const stats = [
      stat({ questionId: "a", attempts: 2, solved: 2, incorrectKeystrokes: 6 }),
      stat({ questionId: "b", attempts: 2, solved: 2, incorrectKeystrokes: 5 }),
    ];
    expect(selectWeakQuestions(stats)).toEqual(["a"]);
  });

  it("returns questions with accuracy under 80% (boundary exclusive)", () => {
    const stats = [
      stat({ questionId: "a", attempts: 5, solved: 4 }),
      stat({ questionId: "b", attempts: 5, solved: 3 }),
    ];
    expect(selectWeakQuestions(stats)).toEqual(["b"]);
  });

  it("ignores questions never attempted and does not duplicate ids", () => {
    const stats = [
      stat({ questionId: "a", attempts: 0 }),
      stat({ questionId: "b", attempts: 1, solved: 0, skipped: 1, incorrectKeystrokes: 9 }),
    ];
    expect(selectWeakQuestions(stats)).toEqual(["b"]);
  });
});
