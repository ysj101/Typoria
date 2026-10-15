import { describe, expect, it } from "vitest";
import { makeTerm } from "../test/factories";
import {
  LEARN_NEXT_PHASE,
  LEARN_PHASES,
  beginTyping,
  createLearnRound,
  currentTerm,
  inputLearnChar,
  requestQuiz,
} from "./learnRound";

const term = (id: string, typingText: string, name = id) => makeTerm(id, { typingText, name });

const ROUND = [
  term("ai-001", "cat", "機械学習"),
  term("cloud-001", "I am", "IaaS"),
  term("security-001", "hash", "ハッシュ"),
];

describe("createLearnRound", () => {
  it("uses reading, typing, and roundEnd", () => {
    expect(LEARN_PHASES).toEqual(["reading", "typing", "roundEnd"]);
  });

  it("starts in reading at the first term", () => {
    const state = createLearnRound(ROUND);
    expect(state.phase).toBe("reading");
    expect(state.index).toBe(0);
    expect(state.typing).toBeNull();
    expect(currentTerm(state)?.id).toBe("ai-001");
    expect(state.terms.map((item) => item.id)).toEqual(["ai-001", "cloud-001", "security-001"]);
  });

  it("copies the term list so later edits do not change the round", () => {
    const terms = [...ROUND];
    const state = createLearnRound(terms);
    terms.pop();
    expect(state.terms).toHaveLength(3);
  });

  it("rejects an empty round", () => {
    expect(() => createLearnRound([])).toThrow(/terms must not be empty/);
  });
});

describe("beginTyping", () => {
  it("moves from reading to typing the term's typingText", () => {
    const started = beginTyping(createLearnRound(ROUND));
    expect(started.phase).toBe("typing");
    expect(started.index).toBe(0);
    expect(started.typing).toMatchObject({
      answer: "cat",
      cursor: 0,
      completed: false,
      correctKeystrokes: 0,
      incorrectKeystrokes: 0,
    });
  });

  it("does not mutate the reading state", () => {
    const reading = createLearnRound(ROUND);
    beginTyping(reading);
    expect(reading.phase).toBe("reading");
    expect(reading.typing).toBeNull();
  });

  it("is a no-op while typing or after the round ends", () => {
    const typing = beginTyping(createLearnRound(ROUND));
    expect(beginTyping(typing)).toBe(typing);

    let state = typing;
    for (const ch of "cat") state = inputLearnChar(state, ch).state;
    expect(state.phase).toBe("reading");
    for (const ch of "i am") state = inputLearnChar(beginTyping(state), ch).state;
    for (const ch of "hash") state = inputLearnChar(beginTyping(state), ch).state;
    expect(state.phase).toBe("roundEnd");
    expect(beginTyping(state)).toBe(state);
  });
});

describe("inputLearnChar", () => {
  it("ignores input while reading", () => {
    const reading = createLearnRound(ROUND);
    const outcome = inputLearnChar(reading, "c");
    expect(outcome.result).toBe("ignored");
    expect(outcome.termCompleted).toBe(false);
    expect(outcome.roundCompleted).toBe(false);
    expect(outcome.state).toBe(reading);
  });

  it("advances on a correct character and stays on an incorrect one", () => {
    const typing = beginTyping(createLearnRound(ROUND));
    const missed = inputLearnChar(typing, "x");
    expect(missed.result).toBe("incorrect");
    expect(missed.state.typing?.cursor).toBe(0);
    expect(missed.state.typing?.incorrectKeystrokes).toBe(1);
    expect(missed.state.phase).toBe("typing");

    const hit = inputLearnChar(missed.state, "C");
    expect(hit.result).toBe("correct");
    expect(hit.state.typing?.cursor).toBe(1);
    expect(hit.state.typing?.correctKeystrokes).toBe(1);
  });

  it("does not mutate the previous typing state", () => {
    const typing = beginTyping(createLearnRound(ROUND));
    inputLearnChar(typing, "c");
    expect(typing.typing?.cursor).toBe(0);
  });

  it("returns to reading for the next term when one word is finished", () => {
    const state = beginTyping(createLearnRound(ROUND));
    let outcome = inputLearnChar(state, "c");
    outcome = inputLearnChar(outcome.state, "a");
    outcome = inputLearnChar(outcome.state, "t");
    expect(outcome.result).toBe("completed");
    expect(outcome.termCompleted).toBe(true);
    expect(outcome.roundCompleted).toBe(false);
    expect(outcome.state.phase).toBe("reading");
    expect(outcome.state.index).toBe(1);
    expect(outcome.state.typing).toBeNull();
    expect(currentTerm(outcome.state)?.name).toBe("IaaS");
  });

  it("accepts spaces only where typingText has them", () => {
    let state = createLearnRound(ROUND);
    state = inputLearnChar(beginTyping(state), "c").state;
    state = inputLearnChar(state, "a").state;
    state = inputLearnChar(state, "t").state;
    state = beginTyping(state);
    const results = ["i", " ", "a", "m"].map((ch) => {
      const outcome = inputLearnChar(state, ch);
      state = outcome.state;
      return outcome.result;
    });
    expect(results).toEqual(["correct", "correct", "correct", "completed"]);
    expect(state.phase).toBe("reading");
    expect(state.index).toBe(2);
  });

  it("ends the round after the last term and ignores further input", () => {
    let state = createLearnRound(ROUND);
    for (const word of ["cat", "I am", "hash"]) {
      state = beginTyping(state);
      expect(state.phase).toBe("typing");
      for (const ch of word) {
        const outcome = inputLearnChar(state, ch);
        state = outcome.state;
        if (outcome.termCompleted) expect(outcome.result).toBe("completed");
      }
    }
    expect(state.phase).toBe("roundEnd");
    expect(state.index).toBe(3);
    expect(state.typing).toBeNull();
    expect(currentTerm(state)).toBeNull();

    const ignored = inputLearnChar(state, "x");
    expect(ignored.state).toBe(state);
    expect(ignored.result).toBe("ignored");
    expect(ignored.roundCompleted).toBe(false);
  });

  it("ignores control keys without leaving the typing phase", () => {
    const typing = beginTyping(createLearnRound(ROUND));
    const outcome = inputLearnChar(typing, "Backspace");
    expect(outcome.result).toBe("ignored");
    expect(outcome.state).toBe(typing);
  });
});

describe("requestQuiz", () => {
  it("is unavailable until the round has ended", () => {
    const reading = createLearnRound(ROUND);
    expect(requestQuiz(reading)).toBeNull();
    expect(requestQuiz(beginTyping(reading))).toBeNull();
  });

  it("hands the played terms to the quiz phase in order", () => {
    let state = createLearnRound(ROUND);
    for (const word of ["cat", "I am", "hash"]) {
      state = beginTyping(state);
      for (const ch of word) state = inputLearnChar(state, ch).state;
    }
    expect(requestQuiz(state)).toEqual({
      phase: LEARN_NEXT_PHASE,
      handoff: { terms: state.terms },
    });
    expect(LEARN_NEXT_PHASE).toBe("quiz");
  });
});
