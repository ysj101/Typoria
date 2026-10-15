import { afterEach, describe, expect, it } from "vitest";
import type { Term, TermCategory } from "../types/term";
import { createLearnQuiz, type LearnQuizState } from "./learnQuiz";
import { beginTyping, createLearnRound, inputLearnChar } from "./learnRound";
import {
  LEARN_RESUME_STORAGE_KEY,
  captureLearnResume,
  clearLearnResume,
  emphasizeTermName,
  loadLearnResume,
  restoreLearnSession,
  saveLearnResume,
  shouldCollapseLearnExplanation,
} from "./learnResume";

function term(id: string, typingText: string, name: string): Term {
  const category = id.slice(0, id.lastIndexOf("-")) as TermCategory;
  return {
    id,
    category,
    level: 1,
    name,
    explanation: `${name}は、画面に残る解説です。続きの文もあります。`,
    typingText,
    quiz: {
      question: `${name}の質問`,
      choices: ["A", "B", "C", "D"],
      answerIndex: 0,
      explanation: `${name}のクイズ解説`,
    },
  };
}

const TERMS = [
  term("ai-001", "cat", "機械学習"),
  term("cloud-001", "saas", "SaaS"),
  term("web-001", "html", "HTML"),
];

describe("learn resume", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("collapses the explanation only while typing on a short or keyboard viewport", () => {
    expect(shouldCollapseLearnExplanation("reading", { short: true, keyboardInset: 300 })).toBe(
      false,
    );
    expect(shouldCollapseLearnExplanation("typing", { short: false, keyboardInset: 0 })).toBe(
      false,
    );
    expect(shouldCollapseLearnExplanation("typing", { short: true, keyboardInset: 0 })).toBe(true);
    expect(shouldCollapseLearnExplanation("typing", { short: false, keyboardInset: 80 })).toBe(
      true,
    );
    expect(shouldCollapseLearnExplanation("roundEnd", { short: true, keyboardInset: 200 })).toBe(
      false,
    );
  });

  it("emphasizes every occurrence of the term name", () => {
    expect(emphasizeTermName("機械学習は機械学習の一種です。", "機械学習")).toEqual([
      { text: "機械学習", term: true },
      { text: "は", term: false },
      { text: "機械学習", term: true },
      { text: "の一種です。", term: false },
    ]);
    expect(emphasizeTermName("用語は出てきません。", "機械学習")).toEqual([
      { text: "用語は出てきません。", term: false },
    ]);
  });

  it("round-trips the same term, phase, and cursor through sessionStorage", () => {
    let round = beginTyping(createLearnRound(TERMS));
    round = inputLearnChar(round, "c").state;
    const snapshot = captureLearnResume(round, null);
    saveLearnResume(snapshot);

    expect(loadLearnResume()).toEqual(snapshot);
    const restored = restoreLearnSession(snapshot, TERMS);
    expect(restored?.quiz).toBeNull();
    expect(restored?.round.phase).toBe("typing");
    expect(restored?.round.index).toBe(0);
    expect(restored?.round.terms.map((item) => item.id)).toEqual([
      "ai-001",
      "cloud-001",
      "web-001",
    ]);
    expect(restored?.round.typing?.cursor).toBe(1);
    expect(restored?.round.typing?.answer).toBe("cat");
  });

  it("restores a later term in the reading phase", () => {
    let round = beginTyping(createLearnRound(TERMS));
    round = inputLearnChar(round, "c").state;
    round = inputLearnChar(round, "a").state;
    round = inputLearnChar(round, "t").state;
    const snapshot = captureLearnResume(round, null);
    const restored = restoreLearnSession(snapshot, TERMS);
    expect(restored?.round.phase).toBe("reading");
    expect(restored?.round.index).toBe(1);
    expect(restored?.round.typing).toBeNull();
    expect(restored?.round.terms[1]?.name).toBe("SaaS");
  });

  it("restores an answered quiz on the same round", () => {
    const round = {
      ...createLearnRound(TERMS),
      phase: "roundEnd" as const,
      index: TERMS.length,
      typing: null,
    };
    const quiz: LearnQuizState = {
      ...createLearnQuiz(TERMS, { rng: () => 0 }),
      phase: "feedback",
      selectedSourceIndex: 0,
      result: { termId: "ai-001", correct: true, answeredAt: "2026-10-14T09:00:00.000Z" },
    };
    const snapshot = captureLearnResume(round, quiz);
    saveLearnResume(snapshot);
    const restored = restoreLearnSession(loadLearnResume()!, TERMS);
    expect(restored?.round.phase).toBe("roundEnd");
    expect(restored?.quiz?.phase).toBe("feedback");
    expect(restored?.quiz?.result).toEqual(quiz.result);
    expect(restored?.quiz?.question.choices.map((choice) => choice.sourceIndex)).toEqual(
      quiz.question.choices.map((choice) => choice.sourceIndex),
    );
  });

  it("drops a snapshot whose terms or cursor cannot be resumed", () => {
    const round = beginTyping(createLearnRound(TERMS));
    const snapshot = captureLearnResume(round, null);
    expect(restoreLearnSession(snapshot, TERMS.slice(1))).toBeNull();
    expect(restoreLearnSession({ ...snapshot, cursor: 99 }, TERMS)).toBeNull();
    expect(restoreLearnSession({ ...snapshot, phase: "roundEnd", quiz: null }, TERMS)).toBeNull();
    sessionStorage.setItem(LEARN_RESUME_STORAGE_KEY, "{");
    expect(loadLearnResume()).toBeNull();
    sessionStorage.setItem(LEARN_RESUME_STORAGE_KEY, JSON.stringify({ v: 1 }));
    expect(loadLearnResume()).toBeNull();
    saveLearnResume(snapshot);
    clearLearnResume();
    expect(loadLearnResume()).toBeNull();
  });
});
