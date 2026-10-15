import { describe, expect, it } from "vitest";
import { makeTerm } from "../test/factories";
import type { Term } from "../types/term";
import {
  answerLearnQuiz,
  createLearnQuiz,
  createLearnRoundResult,
  isLearnRoundResult,
  termSummary,
} from "./learnQuiz";

function term(
  id: string,
  name: string,
  options?: { answerIndex?: 0 | 1 | 2 | 3; choices?: [string, string, string, string] },
): Term {
  return makeTerm(id, {
    name,
    explanation: `${name}は基礎です。次の文で補足します。`,
    typingText: "term",
    quiz: {
      question: `${name}の質問`,
      choices: options?.choices ?? ["A", "B", "C", "D"],
      answerIndex: options?.answerIndex ?? 0,
      explanation: `${name}のクイズ解説`,
    },
  });
}

const ROUND = [
  term("ai-001", "機械学習"),
  term("cloud-001", "SaaS", {
    answerIndex: 2,
    choices: ["色", "電源", "例となるデータ", "手順書"],
  }),
  term("web-001", "HTML", { answerIndex: 3 }),
];

const NOW = () => new Date("2026-10-14T09:00:00.000Z");

function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe("termSummary", () => {
  it("keeps the first sentence", () => {
    expect(termSummary("  機械学習は技術です。次の文です。")).toBe("機械学習は技術です。");
  });

  it("keeps the whole text when there is no period", () => {
    expect(termSummary("句点なし")).toBe("句点なし");
  });
});

describe("createLearnQuiz", () => {
  it("rejects an empty round", () => {
    expect(() => createLearnQuiz([])).toThrow(/terms must not be empty/);
  });

  it("picks a term and shuffles choices with the injected rng", () => {
    const quiz = createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) });
    expect(quiz.phase).toBe("asking");
    expect(quiz.result).toBeNull();
    expect(quiz.question.termId).toBe("ai-001");
    expect(quiz.question.termName).toBe("機械学習");
    expect(quiz.question.question).toBe("機械学習の質問");
    expect(quiz.question.explanation).toBe("機械学習のクイズ解説");
    expect(quiz.question.answerSourceIndex).toBe(0);
    expect(quiz.question.choices.map((choice) => choice.sourceIndex)).toEqual([1, 2, 3, 0]);
    expect(quiz.question.choices.map((choice) => choice.text)).toEqual(["B", "C", "D", "A"]);
  });

  it("can pick a later term", () => {
    const quiz = createLearnQuiz(ROUND, { rng: sequence([0.999, 0.99, 0.99, 0.99]) });
    expect(quiz.question.termId).toBe("web-001");
    expect(quiz.question.answerSourceIndex).toBe(3);
    expect(quiz.question.choices.map((choice) => choice.sourceIndex)).toEqual([0, 1, 2, 3]);
  });

  it("is reproducible and does not mutate the asking state", () => {
    const first = createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) });
    const second = createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) });
    expect(second.question.choices.map((choice) => choice.sourceIndex)).toEqual(
      first.question.choices.map((choice) => choice.sourceIndex),
    );
    answerLearnQuiz(first, 0, NOW);
    expect(first.phase).toBe("asking");
    expect(first.result).toBeNull();
  });
});

describe("answerLearnQuiz", () => {
  it("grades the original answer after the choices are shuffled", () => {
    const quiz = createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) });
    const displayedFirst = quiz.question.choices[0];
    expect(displayedFirst?.sourceIndex).not.toBe(quiz.question.answerSourceIndex);

    const wrong = answerLearnQuiz(quiz, displayedFirst?.sourceIndex ?? 1, NOW);
    expect(wrong.phase).toBe("feedback");
    expect(wrong.selectedSourceIndex).toBe(1);
    expect(wrong.result).toEqual({
      termId: "ai-001",
      correct: false,
      answeredAt: "2026-10-14T09:00:00.000Z",
    });

    const right = answerLearnQuiz(quiz, quiz.question.answerSourceIndex, NOW);
    expect(right.result).toEqual({
      termId: "ai-001",
      correct: true,
      answeredAt: "2026-10-14T09:00:00.000Z",
    });
  });

  it("grades a non-zero answer index by source index, not display position", () => {
    const quiz = createLearnQuiz(ROUND, { rng: sequence([0.5, 0.99, 0.99, 0.99]) });
    expect(quiz.question.termId).toBe("cloud-001");
    expect(quiz.question.choices.map((choice) => choice.text)).toEqual([
      "色",
      "電源",
      "例となるデータ",
      "手順書",
    ]);
    const byDisplay = answerLearnQuiz(quiz, 0, NOW);
    expect(byDisplay.result?.correct).toBe(false);
    const bySource = answerLearnQuiz(quiz, 2, NOW);
    expect(bySource.result?.correct).toBe(true);
    expect(bySource.result?.termId).toBe("cloud-001");
  });

  it("ignores a second answer and an out-of-range index", () => {
    const quiz = createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) });
    const answered = answerLearnQuiz(quiz, 0, NOW);
    expect(answerLearnQuiz(answered, 1, () => new Date("2026-11-01T00:00:00.000Z"))).toBe(answered);
    expect(answerLearnQuiz(quiz, 4, NOW)).toBe(quiz);
    expect(answerLearnQuiz(quiz, -1, NOW)).toBe(quiz);
  });
});

describe("createLearnRoundResult", () => {
  it("returns the learned terms and the quiz result", () => {
    const quiz = answerLearnQuiz(
      createLearnQuiz(ROUND, { rng: sequence([0, 0, 0, 0]) }),
      0,
      NOW,
    ).result;
    expect(quiz).not.toBeNull();
    const result = createLearnRoundResult(ROUND, quiz!);
    expect(result.terms).toEqual([
      { termId: "ai-001", name: "機械学習", summary: "機械学習は基礎です。" },
      { termId: "cloud-001", name: "SaaS", summary: "SaaSは基礎です。" },
      { termId: "web-001", name: "HTML", summary: "HTMLは基礎です。" },
    ]);
    expect(result.quiz).toEqual({
      termId: "ai-001",
      correct: true,
      answeredAt: "2026-10-14T09:00:00.000Z",
    });
    expect(isLearnRoundResult(result)).toBe(true);
    expect(isLearnRoundResult({ session: {}, isNewRecord: true })).toBe(false);
    expect(isLearnRoundResult(null)).toBe(false);
  });
});
